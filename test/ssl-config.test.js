const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mysql = require('mysql2/promise');

const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-mysql-ssl-test-'));
process.env.MCP_LOG_DIR = logDir;
const { FinalMCPServer } = require('../src/server-final');
after(() => fs.rmSync(logDir, { recursive: true, force: true }));

/**
 * Set an isolated SSL switch for a test and restore the inherited value afterward.
 * @param {object} t Node test context used to register cleanup.
 * @param {string|undefined} value Environment value, or undefined to unset the switch.
 * @returns {void}
 */
function setSslEnvironment(t, value) {
  const previous = process.env.MYSQL_SSL;
  if (value === undefined) delete process.env.MYSQL_SSL;
  else process.env.MYSQL_SSL = value;
  t.after(() => {
    if (previous === undefined) delete process.env.MYSQL_SSL;
    else process.env.MYSQL_SSL = previous;
  });
}

for (const value of [undefined, 'false', 'true', '', 'TRUE', '1']) {
  test(`MYSQL_SSL=${JSON.stringify(value)} controls initial and rebuilt pools consistently`, async (t) => {
    setSslEnvironment(t, value);
    const createPool = mysql.createPool;
    const configs = [];
    let closedPools = 0;
    t.mock.method(mysql, 'createPool', (config) => {
      configs.push(config);
      return {
        /** @returns {Promise<object>} A connection stub for the pool's initial health check. */
        async getConnection() {
          return {
            /** @returns {Promise<void>} Simulate a successful connection health check. */
            async ping() {},
            /** @returns {void} Simulate returning a healthy connection to its pool. */
            release() {}
          };
        },
        /** @returns {Promise<void>} Record disposal of the pool before rebuilding it. */
        async end() { closedPools++; }
      };
    });

    const server = new FinalMCPServer();
    assert.equal(await server.handleRequest({
      jsonrpc: '2.0', method: 'notifications/initialized'
    }), null);
    assert.equal(configs.length, 1);
    // Force the same server through its unhealthy-pool replacement path.
    t.mock.method(server, 'checkConnectionPoolHealth', async () => false);
    await server.ensureConnectionPool();
    assert.equal(configs.length, 2);
    assert.equal(closedPools, 1);

    const warnings = t.mock.method(console, 'error', () => {});
    for (const config of configs) {
      assert.equal(config.connectTimeout, 60000);
      assert.equal(config.multipleStatements, false);
      if (value === 'true') {
        assert.deepEqual(config.ssl, { rejectUnauthorized: true, verifyIdentity: true });
      } else {
        assert.ok(!Object.hasOwn(config, 'ssl'), 'disabled TLS must not be overridden by the pool');
      }
      const pool = createPool(config);
      try {
        const actual = pool.pool.config.connectionConfig;
        assert.equal(Boolean(actual.ssl), value === 'true');
        if (value === 'true') {
          assert.equal(actual.ssl.rejectUnauthorized, true);
          assert.equal(actual.ssl.verifyIdentity, true);
        }
      } finally {
        await pool.end();
      }
    }
    assert.equal(warnings.mock.callCount(), 0);
  });
}
