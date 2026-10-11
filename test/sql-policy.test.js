const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateSql } = require('../src/sql-policy');

const readonly = { readonly: true, allowDDL: true, allowDrop: true, allowDelete: true };
const restricted = { readonly: false, allowDDL: false, allowDrop: false, allowDelete: false };

const safeQueries = [
  'SELECT 1',
  'select(1)',
  'SELECT * FROM users WHERE id = 1;',
  'SHOW TABLES;',
  'SHOW CREATE TABLE users',
  'SHOW VARIABLES LIKE "sql_mode"',
  '-- ordinary comment\n/* SELECT ; DROP */ SELECT 1; # trailing comment',
  '# comment\rSELECT 1',
  'SELECT /*+ MAX_EXECUTION_TIME(1000) */ count(*) FROM users',
  "SELECT 'a; UPDATE users SET name = 1', 'INTO OUTFILE', 'FOR UPDATE'",
  "SELECT 'it''s; DROP TABLE users', `into`, `for` FROM `order`",
  'SELECT "a; DROP TABLE users", `x``; DELETE` FROM users',
  "SELECT 1--1, 'x'",
  'SELECT @value, @@sql_mode',
  'SELECT 1 UNION ALL SELECT 2; -- end',
  "SELECT * FROM (SELECT '/* not a comment */') AS nested"
];

for (const sql of safeQueries) {
  test(`readonly accepts a single read: ${sql}`, () => {
    assert.equal(validateSql(sql, readonly).isDdlOperation, false);
  });
}

const unsafeQueries = [
  'UPDATE users SET name = 1',
  'INSERT INTO users VALUES (1)',
  'REPLACE INTO users VALUES (1)',
  'DELETE FROM users',
  'CREATE TABLE x (id INT)',
  'DROP TABLE users',
  'ALTER TABLE users ADD x INT',
  'TRUNCATE TABLE users',
  'CALL change_data()',
  'SET TRANSACTION READ WRITE',
  'START TRANSACTION READ WRITE',
  'COMMIT',
  'EXPLAIN ANALYZE UPDATE users SET name = 1',
  'WITH x AS (SELECT 1) SELECT * FROM x',
  'SELECT 1; UPDATE users SET name = 1',
  'SELECT 1;\nDROP TABLE users;',
  'SHOW TABLES; ALTER TABLE users ADD x INT',
  'SELECT 1; /* hidden */ DELETE FROM users',
  'SELECT 1;;',
  "SELECT * FROM users INTO OUTFILE '/tmp/mcp-policy-output'",
  "SELECT 1 INTO/**/DUMPFILE '/tmp/mcp-policy-output'",
  'SELECT 1 INTO @value',
  'SELECT @value := 1',
  'SELECT * FROM users FOR/**/UPDATE',
  'SELECT * FROM users FOR SHARE',
  'SELECT * FROM users LOCK IN SHARE MODE',
  "SELECT GET_LOCK('test', 0)",
  "SELECT `GET_LOCK`('test', 0)",
  "SELECT RELEASE_LOCK('test')",
  'SELECT RELEASE_ALL_LOCKS()',
  "SELECT 1 /*!50000 INTO OUTFILE '/tmp/mcp-policy-output' */",
  'SELECT 1 /*M!100100 INTO @value */',
  '/*!50000 SELECT 1 */',
  'SELECT 1; /* unclosed',
  "SELECT 'unclosed",
  'SELECT `unclosed',
  'SELECT (1',
  'SELECT 1)',
  'SELECT /* outer /* inner */ 1',
  String.raw`SELECT '\' INTO OUTFILE '/tmp/mcp-policy-output' -- '`,
  String.raw`SELECT "\" INTO OUTFILE '/tmp/mcp-policy-output' -- "`,
  String.raw`SELECT '\'"; UPDATE users SET name = 1 -- '\'"`,
  String.raw`SELECT '\'; UPDATE users SET name = 1 -- '`,
  "SELECT 1--not-a-comment; UPDATE users SET name = 1"
];

for (const sql of unsafeQueries) {
  test(`readonly rejects unsafe or ambiguous SQL: ${sql}`, () => {
    assert.throws(() => validateSql(sql, readonly));
  });
}

for (const sql of [undefined, null, 12, {}, '', '  ', '-- comment only', '/**/', ';']) {
  test(`rejects missing SQL: ${JSON.stringify(sql)}`, () => {
    assert.throws(() => validateSql(sql, readonly), /Missing sql parameter/);
  });
}

const permissionCases = [
  ['/* comment */ CREATE TABLE x (id INT)', /DDL operations/],
  ['ALTER/**/TABLE users ADD x INT', /DDL operations/],
  ['# comment\nTRUNCATE TABLE users', /DDL operations/],
  ['RENAME TABLE users TO old_users', /DDL operations/],
  ['-- comment\nDROP TABLE users', /DROP operations/],
  ['DELETE/**/FROM users', /DELETE operations/],
  ['WITH x AS (SELECT 1) DELETE FROM users', /DELETE operations/],
  ['WITH RECURSIVE x (id) AS (SELECT 1), y AS (SELECT id FROM x) DELETE FROM users', /DELETE operations/],
  ['WITH `delete` AS (SELECT "; UPDATE") DELETE FROM users', /DELETE operations/],
  ['WITH "update" AS (SELECT 1) DELETE FROM users', /DELETE operations/],
  ['/*!50000 DROP TABLE users */', /Executable SQL comments/],
  ['SELECT 1; DELETE FROM users', /Only one SQL statement/]
];

for (const [sql, expected] of permissionCases) {
  test(`non-readonly permissions cannot be skipped: ${sql}`, () => {
    assert.throws(() => validateSql(sql, restricted), expected);
  });
}

test('non-readonly mode preserves permitted DML and classifies commented DDL', () => {
  assert.equal(validateSql('UPDATE users SET name = 1', restricted).command, 'UPDATE');
  assert.equal(validateSql('INSERT INTO users VALUES (1)', restricted).command, 'INSERT');
  assert.equal(validateSql('WITH x AS (SELECT 1) SELECT * FROM x', restricted).command, 'SELECT');
  const permissions = { ...restricted, allowDDL: true, allowDrop: true, allowDelete: true };
  assert.equal(validateSql('/* migration */ CREATE TABLE x (id INT)', permissions).isDdlOperation, true);
  assert.equal(validateSql('DROP TABLE x', permissions).command, 'DROP');
  assert.equal(validateSql('WITH x AS (SELECT 1) DELETE FROM users', permissions).command, 'DELETE');
});
