const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mysql = require('mysql2/promise');

const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-mysql-readonly-test-'));
process.env.READONLY = 'true';
process.env.ALLOW_DDL = 'true';
process.env.ALLOW_DROP = 'true';
process.env.ALLOW_DELETE = 'true';
process.env.MCP_LOG_DIR = logDir;
const { FinalMCPServer } = require('../src/server-final');
after(() => fs.rmSync(logDir, { recursive: true, force: true }));

/**
 * Create a server backed by a recording connection, without opening a real database.
 * @param {object} options Optional SQL to reject and simulated transaction errors.
 * @returns {{server: FinalMCPServer, calls: string[]}} Server and ordered driver calls.
 */
function createServer(options = {}) {
  const calls = [];
  const connection = {
    /**
     * Record a query and optionally simulate a database-side rejection.
     * @param {string} sql SQL sent to the driver.
     * @returns {Promise<Array>} Simulated mysql2 result tuple.
     */
    async query(sql) {
      calls.push(sql);
      if (sql === options.failSql) throw new Error(options.message || 'query failed');
      return [[{ value: 1 }]];
    },
    /** @returns {Promise<void>} Resolve unless rollback failure was requested. */
    async rollback() {
      calls.push('rollback');
      if (options.failRollback) throw new Error('rollback failed');
    },
    /** @returns {void} Record returning a clean connection to its pool. */
    release() {
      calls.push('release');
    },
    /** @returns {void} Record discarding a connection that cannot be reused safely. */
    destroy() {
      calls.push('destroy');
    }
  };
  const server = new FinalMCPServer();
  /** @returns {Promise<void>} Record the pool check without database I/O. */
  server.ensureConnectionPool = async () => { calls.push('ensurePool'); };
  server.connectionPool = {
    /** @returns {Promise<object>} The isolated recording connection. */
    async getConnection() {
      calls.push('getConnection');
      return connection;
    }
  };
  return { server, calls };
}

test('readonly rejects unsafe SQL before any database access', async () => {
  const { server, calls } = createServer();
  for (const sql of [
    'SELECT 1; UPDATE users SET name = 1',
    'SHOW TABLES; DROP TABLE users',
    "SELECT 1 INTO OUTFILE '/tmp/mcp-policy-output'",
    'SELECT 1 /*! INTO @value */',
    'UPDATE users SET name = 1'
  ]) {
    await assert.rejects(server.sql_query({ sql }));
  }
  assert.deepEqual(calls, []);
});

test('readonly SELECT runs inside a read-only transaction and rolls back before release', async () => {
  const { server, calls } = createServer();
  const result = await server.sql_query({ sql: 'SELECT 1' });
  assert.deepEqual(result.result, [{ value: 1 }]);
  assert.deepEqual(calls, [
    'ensurePool', 'getConnection', 'START TRANSACTION READ ONLY', 'SELECT 1', 'rollback', 'release'
  ]);
});

test('readonly SHOW uses the same transaction guard', async () => {
  const { server, calls } = createServer();
  await server.sql_query({ sql: 'SHOW CREATE TABLE users' });
  assert.deepEqual(calls.slice(2), [
    'START TRANSACTION READ ONLY', 'SHOW CREATE TABLE users', 'rollback', 'release'
  ]);
});

test('failed read-only setup never executes client SQL or releases an unsafe connection', async () => {
  const { server, calls } = createServer({ failSql: 'START TRANSACTION READ ONLY' });
  await assert.rejects(server.sql_query({ sql: 'SELECT 1' }), /query failed/);
  assert.deepEqual(calls, ['ensurePool', 'getConnection', 'START TRANSACTION READ ONLY', 'destroy']);
});

test('database rejection of a writing function is propagated and rolled back', async () => {
  const sql = 'SELECT mutate_data()';
  const { server, calls } = createServer({
    failSql: sql,
    message: 'Cannot execute statement in a READ ONLY transaction'
  });
  await assert.rejects(server.sql_query({ sql }), /READ ONLY transaction/);
  assert.deepEqual(calls.slice(2), ['START TRANSACTION READ ONLY', sql, 'rollback', 'release']);
});

test('rollback failure after a successful query destroys the connection and reports failure', async () => {
  const { server, calls } = createServer({ failRollback: true });
  await assert.rejects(server.sql_query({ sql: 'SELECT 1' }), /rollback failed/);
  assert.deepEqual(calls.slice(-2), ['rollback', 'destroy']);
  assert.ok(!calls.includes('release'));
});

test('rollback failure while handling a query error preserves the original error', async () => {
  const { server, calls } = createServer({ failSql: 'SELECT 1', failRollback: true });
  await assert.rejects(server.sql_query({ sql: 'SELECT 1' }), /query failed/);
  assert.deepEqual(calls.slice(-2), ['rollback', 'destroy']);
});

test('JSON-RPC sql_query uses the same policy before database access', async () => {
  const { server, calls } = createServer();
  const response = await server.handleRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'sql_query', arguments: { sql: 'SELECT 1; DROP TABLE users' } }
  });
  assert.match(response.error.message, /Only one SQL statement/);
  assert.deepEqual(calls, []);
});

test('MCP initialization reports the package version and matching lock metadata', async () => {
  const packageJson = require('../package.json');
  const lock = require('../package-lock.json');
  assert.equal(lock.name, packageJson.name);
  assert.equal(lock.version, packageJson.version);
  assert.equal(lock.packages[''].name, packageJson.name);
  assert.equal(lock.packages[''].version, packageJson.version);
  const server = new FinalMCPServer();
  const response = await server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' });
  assert.equal(response.result.serverInfo.version, packageJson.version);
});

test('initial and replacement pools use valid driver settings and disable multiple statements', async (t) => {
  const createPool = mysql.createPool;
  const configs = [];
  t.mock.method(mysql, 'createPool', (config) => {
    configs.push(config);
    return {
      /** @returns {Promise<object>} A health-check-only connection stub. */
      async getConnection() {
        return {
          /** @returns {Promise<void>} Simulate a successful pool health check. */
          async ping() {},
          /** @returns {void} Simulate releasing the health-check connection. */
          release() {}
        };
      },
      /** @returns {Promise<void>} Simulate closing the pool. */
      async end() {}
    };
  });
  const initial = new FinalMCPServer();
  await initial.handleRequest({ jsonrpc: '2.0', method: 'notifications/initialized' });
  const replacement = new FinalMCPServer();
  await replacement.ensureConnectionPool();
  assert.equal(configs.length, 2);
  assert.ok(configs.every(config => config.multipleStatements === false));

  // Real mysql2 pools parse configuration immediately without opening a connection.
  const driverWarnings = t.mock.method(console, 'error', () => {});
  for (const config of configs) {
    assert.equal(config.connectTimeout, 60000);
    assert.equal(config.supportBigNumbers, true);
    assert.equal(config.bigNumberStrings, true);
    assert.ok(!Object.hasOwn(config, 'acquireTimeout'));
    assert.ok(!Object.hasOwn(config, 'timeout'));
    const pool = createPool(config);
    try {
      assert.equal(pool.pool.config.connectionConfig.connectTimeout, 60000);
      assert.equal(pool.pool.config.connectionConfig.multipleStatements, false);
      assert.equal(pool.pool.config.connectionConfig.supportBigNumbers, true);
      assert.equal(pool.pool.config.connectionConfig.bigNumberStrings, true);
    } finally {
      await pool.end();
    }
  }
  assert.equal(driverWarnings.mock.callCount(), 0, 'mysql2 must accept both pool configurations without warnings');
});
