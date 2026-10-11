const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-mysql-readwrite-test-'));
process.env.READONLY = 'false';
process.env.ALLOW_DDL = 'true';
process.env.ALLOW_DROP = 'false';
process.env.ALLOW_DELETE = 'false';
process.env.MCP_LOG_DIR = logDir;
const { FinalMCPServer } = require('../src/server-final');
after(() => fs.rmSync(logDir, { recursive: true, force: true }));

/**
 * Create a non-readonly server with a recording mysql2-compatible connection.
 * @returns {{server: FinalMCPServer, calls: string[]}} Server and driver call history.
 */
function createServer() {
  const calls = [];
  const server = new FinalMCPServer();
  /** @returns {Promise<void>} Bypass real database access in the test. */
  server.ensureConnectionPool = async () => {};
  server.connectionPool = {
    /** @returns {Promise<object>} A connection exposing only non-readonly operations. */
    async getConnection() {
      return {
        /**
         * Record the submitted SQL and return write metadata.
         * @param {string} sql SQL to record.
         * @returns {Promise<Array>} Simulated mysql2 write result.
         */
        async query(sql) {
          calls.push(sql);
          return [{ affectedRows: 1, insertId: 7 }];
        },
        /** @returns {void} Record returning the connection to its pool. */
        release() { calls.push('release'); }
      };
    }
  };
  return { server, calls };
}

test('readwrite UPDATE preserves execution and response metadata without a readonly transaction', async () => {
  const { server, calls } = createServer();
  const sql = 'UPDATE users SET name = 1';
  const result = await server.sql_query({ sql });
  assert.equal(result.affectedRows, 1);
  assert.equal(result.insertId, 7);
  assert.deepEqual(calls, [sql, 'release']);
});

test('allowed DDL with a leading comment is executed and audited', async () => {
  const { server, calls } = createServer();
  const sql = '/* migration */ CREATE TABLE example (id INT)';
  await server.sql_query({ sql });
  assert.deepEqual(calls, [sql, 'release']);
  const logs = await server.get_ddl_sql_logs({});
  assert.equal(logs.logs[0].sql, sql);
  assert.ok(fs.readFileSync(path.join(logDir, 'ddl.sql'), 'utf8').includes(sql));
});

test('commented DROP and CTE DELETE remain blocked with readonly disabled', async () => {
  const { server, calls } = createServer();
  await assert.rejects(server.sql_query({ sql: '/* comment */ DROP TABLE users' }), /DROP operations/);
  await assert.rejects(server.sql_query({ sql: 'WITH x AS (SELECT 1) DELETE FROM users' }), /DELETE operations/);
  assert.deepEqual(calls, []);
});
