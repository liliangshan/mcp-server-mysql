const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// In-memory log storage
const operationLogs = [];
const ddlSqlLogs = [];
const MAX_LOGS = 1000;
const MAX_DDL_LOGS = 500;

// Get log directory and filename
const getLogConfig = () => {
  const logDir = process.env.MCP_LOG_DIR || './logs';
  const logFile = process.env.MCP_LOG_FILE || 'mcp-mysql.log';
  const ddlLogFile = process.env.MCP_DDL_LOG_FILE || 'ddl.sql';
  return {
    dir: logDir,
    file: logFile,
    fullPath: path.join(logDir, logFile),
    ddlFile: ddlLogFile,
    ddlFullPath: path.join(logDir, ddlLogFile)
  };
};

// Ensure log directory exists
const ensureLogDir = () => {
  const { dir } = getLogConfig();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Log recording function - record all requests and responses
const logRequest = (method, params, result, error = null) => {
  const logEntry = {
    id: Date.now(),
    method,
    params: JSON.stringify(params),
    result: result ? JSON.stringify(result) : null,
    error: error ? error.toString() : null,
    created_at: new Date().toISOString()
  };

  operationLogs.unshift(logEntry);
  if (operationLogs.length > MAX_LOGS) {
    operationLogs.splice(MAX_LOGS);
  }

  // Record request and response data
  const logLine = `${logEntry.created_at} | ${method} | ${logEntry.params} | ${error || 'SUCCESS'} | RESPONSE: ${logEntry.result || 'null'}\n`;

  try {
    ensureLogDir();
    const { fullPath } = getLogConfig();
    fs.appendFileSync(fullPath, logLine, 'utf8');
  } catch (err) {
    console.error('Failed to write log file:', err.message);
  }
};

// SQL operation log recording function
const logSqlOperation = (sql, result, error = null) => {
  const logEntry = {
    id: Date.now(),
    sql,
    result: result ? JSON.stringify(result) : null,
    error: error ? error.toString() : null,
    created_at: new Date().toISOString()
  };

  const logLine = `${logEntry.created_at} | SQL: ${sql} | ${error || 'SUCCESS'}\n`;

  try {
    ensureLogDir();
    const { fullPath } = getLogConfig();
    fs.appendFileSync(fullPath, logLine, 'utf8');
  } catch (err) {
    console.error('Failed to write log file:', err.message);
  }
};

// DDL SQL operation log recording function
const logDdlSqlOperation = (sql, result, error = null) => {
  const logEntry = {
    id: Date.now(),
    sql,
    result: result ? JSON.stringify(result) : null,
    error: error ? error.toString() : null,
    created_at: new Date().toISOString()
  };

  // Add to in-memory DDL logs (both success and error)
  ddlSqlLogs.unshift(logEntry);
  if (ddlSqlLogs.length > MAX_DDL_LOGS) {
    ddlSqlLogs.splice(MAX_DDL_LOGS);
  }

  // Only write successful DDL operations to SQL file
  if (!error) {
    try {
      ensureLogDir();
      const { ddlFullPath } = getLogConfig();
      
      // Add timestamp comment for each SQL statement
      const now = new Date();
      const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
      const timeComment = `# ${timestamp}\n`;
      
      // Clean SQL statement and ensure it ends with semicolon
      let cleanSql = sql.trim();
      if (!cleanSql.endsWith(';')) {
        cleanSql += ';';
      }
      
      // Write timestamp comment and SQL statement to DDL file
      fs.appendFileSync(ddlFullPath, timeComment + cleanSql + '\n', 'utf8');
      
    } catch (err) {
      console.error('Failed to write DDL SQL file:', err.message);
    }
  }
};

// MySQL connection configuration
const getDbConfig = () => ({
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || '',
});

const ALLOW_DDL = process.env.ALLOW_DDL === 'true';
const ALLOW_DROP = process.env.ALLOW_DROP === 'true';
const ALLOW_DELETE = process.env.ALLOW_DELETE === 'true';

// 启动日志
console.error('=== MCP MySQL Server Starting ===');
console.error(`Time: ${new Date().toISOString()}`);
console.error(`Environment: ALLOW_DDL=${ALLOW_DDL}, ALLOW_DROP=${ALLOW_DROP}, ALLOW_DELETE=${ALLOW_DELETE}`);
console.error(`Database: ${process.env.MYSQL_HOST || 'localhost'}:${process.env.MYSQL_PORT || '3306'}`);
console.error(`User: ${process.env.MYSQL_USER || 'root'}`);
console.error(`Database: ${process.env.MYSQL_DATABASE || 'default'}`);
console.error(`Started via: ${process.argv[1]}`);

// 显示 DDL 日志配置
const logConfig = getLogConfig();
console.error(`DDL SQL Log File: ${logConfig.ddlFullPath}`);
console.error('================================');

// Tool handlers - moved to class as methods

// Final MCP Server
class FinalMCPServer {
  constructor() {
    this.name = 'mysql-mcp-server';
    this.version = '1.0.0';
    this.initialized = false;
    this.connectionPool = null;
    this.keepAliveInterval = null;
    this.healthCheckInterval = null;
    this.restartCount = 0;
    this.maxRestarts = 5;
  }

  // Execute SQL query
  async sql_query(params) {
    const { sql } = params;

    if (!sql || typeof sql !== 'string') {
      throw new Error('Missing sql parameter');
    }

    const sqlTrimmed = sql.trim();
    
    // Check DDL operations
    const ddlRegex = /^(create|alter|truncate|rename|comment)\s/i;
    const isDdlOperation = ddlRegex.test(sqlTrimmed);
    if (isDdlOperation && !ALLOW_DDL) {
      throw new Error('DDL operations are not allowed');
    }
    
    // Check DROP operations
    const dropRegex = /^drop\s/i;
    if (dropRegex.test(sqlTrimmed) && !ALLOW_DROP) {
      throw new Error('DROP operations are not allowed');
    }
    
    // Check DELETE operations
    const deleteRegex = /^delete\s/i;
    if (deleteRegex.test(sqlTrimmed) && !ALLOW_DELETE) {
      throw new Error('DELETE operations are not allowed');
    }

    // Ensure connection pool is available
    await this.ensureConnectionPool();

    let conn;
    try {
      // Get connection from pool
      conn = await this.connectionPool.getConnection();
      const [result] = await conn.query(sql);

      // Log SQL operation
      logSqlOperation(sql, result);
      
      // If it's a DDL operation, also log to DDL logs
      if (isDdlOperation) {
        logDdlSqlOperation(sql, result);
      }

      return {
        result: result,
        affectedRows: result.affectedRows || 0,
        insertId: result.insertId,
      };
    } catch (err) {
      // Log SQL operation error
      logSqlOperation(sql, null, err.message);
      
      // If it's a DDL operation, also log to DDL logs
      if (isDdlOperation) {
        logDdlSqlOperation(sql, null, err.message);
      }
      
      throw new Error(`SQL execution error: ${err.message}`);
    } finally {
      if (conn) conn.release();
    }
  }

  // Get database information
  async get_database_info(params) {
    // Ensure connection pool is available
    await this.ensureConnectionPool();
    
    let conn;
    try {
      // Get connection from pool
      conn = await this.connectionPool.getConnection();
      const [databases] = await conn.query('SHOW DATABASES');
      const [tables] = await conn.query('SHOW TABLES');

      return {
        databases: databases.map(db => db.Database || Object.values(db)[0]),
        tables: tables.map(table => Object.values(table)[0]),
        config: {
          host: getDbConfig().host,
          port: getDbConfig().port,
          database: getDbConfig().database,
          allowDDL: ALLOW_DDL,
          allowDrop: ALLOW_DROP,
          allowDelete: ALLOW_DELETE,
        }
      };
    } catch (err) {
      throw new Error(`Failed to get database information: ${err.message}`);
    } finally {
      if (conn) conn.release();
    }
  }

  // Get operation logs
  async get_operation_logs(params) {
    const { limit = 50, offset = 0 } = params || {};

    // Validate parameters
    if (typeof limit !== 'number' || limit < 1 || limit > 1000) {
      throw new Error('limit parameter must be between 1-1000');
    }

    if (typeof offset !== 'number' || offset < 0) {
      throw new Error('offset parameter must be greater than or equal to 0');
    }

    // Return logs from memory
    const logs = operationLogs.slice(offset, offset + limit);

    return {
      logs: logs,
      total: operationLogs.length,
      limit: limit,
      offset: offset,
      hasMore: offset + limit < operationLogs.length
    };
  }

  // Get DDL SQL operation logs
  async get_ddl_sql_logs(params) {
    const { limit = 50, offset = 0 } = params || {};

    // Validate parameters
    if (typeof limit !== 'number' || limit < 1 || limit > 500) {
      throw new Error('limit parameter must be between 1-500');
    }

    if (typeof offset !== 'number' || offset < 0) {
      throw new Error('offset parameter must be greater than or equal to 0');
    }

    // Return DDL logs from memory
    const logs = ddlSqlLogs.slice(offset, offset + limit);

    return {
      logs: logs,
      total: ddlSqlLogs.length,
      limit: limit,
      offset: offset,
      hasMore: offset + limit < ddlSqlLogs.length
    };
  }

  // Check permissions for DDL, DROP, DELETE operations
    async check_permissions(params) {
    // Get environment variable configurations
    const allowDDL = process.env.ALLOW_DDL === 'true';
    const allowDrop = process.env.ALLOW_DROP === 'true';
    const allowDelete = process.env.ALLOW_DELETE === 'true';

    return {
      allowDDL: allowDDL,
      allowDrop: allowDrop,
      allowDelete: allowDelete,
      config: {
        host: getDbConfig().host,
        port: getDbConfig().port,
        database: getDbConfig().database,
        user: getDbConfig().user
      },
      environmentVariables: {
        ALLOW_DDL: allowDDL,
        ALLOW_DROP: allowDrop,
        ALLOW_DELETE: allowDelete
      }
    };
  }



  // Close connection pool
  async closeConnectionPool() {
    if (this.connectionPool) {
      try {
        await this.connectionPool.end();
        console.error('Database connection pool closed');
        logRequest('connection_pool_closed', {}, { status: 'closed' }, null);
      } catch (err) {
        console.error('Failed to close database connection pool:', err.message);
        logRequest('connection_pool_close_error', { error: err.message }, null, err.message);
      }
    }
  }

  // Check connection pool health
  async checkConnectionPoolHealth() {
    if (!this.connectionPool) {
      return false;
    }
    
    try {
      const conn = await this.connectionPool.getConnection();
      await conn.ping();
      conn.release();
      return true;
    } catch (err) {
      console.error('Connection pool health check failed:', err.message);
      return false;
    }
  }

  // Recreate connection pool if needed
  async ensureConnectionPool() {
    if (!this.connectionPool || !(await this.checkConnectionPoolHealth())) {
      console.error('Recreating database connection pool...');
      await this.closeConnectionPool();
      
      try {
        this.connectionPool = mysql.createPool({
          ...getDbConfig(),
          connectionLimit: 10,
          acquireTimeout: 60000,
          timeout: 60000,
          queueLimit: 0
        });
        
        // Test connection pool
        const testConn = await this.connectionPool.getConnection();
        await testConn.ping();
        testConn.release();
        
        console.error('Database connection pool recreated successfully');
        logRequest('connection_pool_recreated', { 
          host: getDbConfig().host,
          port: getDbConfig().port,
          database: getDbConfig().database
        }, { status: 'success' }, null);
      } catch (err) {
        console.error('Failed to recreate database connection pool:', err.message);
        logRequest('connection_pool_recreate_error', { error: err.message }, null, err.message);
        throw err;
      }
    }
  }

  // Handle JSON-RPC requests
  async handleRequest(request) {
    try {
      const { jsonrpc, id, method, params } = request;

      if (jsonrpc !== '2.0') {
        logRequest('Unsupported JSON-RPC version', { jsonrpc }, null, 'Unsupported JSON-RPC version');
        throw new Error('Unsupported JSON-RPC version');
      }

      
      let result = null;
      let error = null;

      try {
        if (method === 'initialize') {
          // If already initialized, return success but don't re-initialize
          if (!this.initialized) {
            this.initialized = true;
            
            // Record actual client information
            const clientInfo = params?.clientInfo || {};
            logRequest('initialize', { 
              protocolVersion: params?.protocolVersion || '2025-06-18', 
              capabilities: params?.capabilities || {}, 
              clientInfo: clientInfo 
            }, null, null);
          }
          
          // Build server capabilities to match client capabilities
          const serverCapabilities = {
            tools: {
              listChanged: false
            }
          };
          
          // If client supports prompts, we also support it
          if (params?.capabilities?.prompts) {
            serverCapabilities.prompts = {
              listChanged: false
            };
          }
          
          // If client supports resources, we also support it
          if (params?.capabilities?.resources) {
            serverCapabilities.resources = {
              listChanged: false
            };
          }
          
          // If client supports logging, we also support it
          if (params?.capabilities?.logging) {
            serverCapabilities.logging = {
              listChanged: false
            };
          }
          
          // If client supports roots, we also support it
          if (params?.capabilities?.roots) {
            serverCapabilities.roots = {
              listChanged: false
            };
          }
          
          result = {
            protocolVersion: params?.protocolVersion || '2025-06-18',
            capabilities: serverCapabilities,
            serverInfo: {
              name: this.name,
              version: this.version
            }
          };
        } else if (method === 'tools/list') {
          result = {
            tools: [
              {
                name: 'sql_query',
                description: 'Execute SQL query, supports DDL and DML operations',
                inputSchema: {
                  type: 'object',
                  properties: {
                    sql: {
                      type: 'string',
                      description: 'SQL statement to execute'
                    }
                  },
                  required: ['sql']
                }
              },
              {
                name: 'get_database_info',
                description: 'Get database information, including database list, table list and configuration information',
                inputSchema: {
                  type: 'object',
                  properties: {}
                }
              },
              {
                name: 'get_operation_logs',
                description: 'Get operation logs',
                inputSchema: {
                  type: 'object',
                  properties: {
                    limit: {
                      type: 'number',
                      description: 'Limit count, default 50'
                    },
                    offset: {
                      type: 'number',
                      description: 'Offset, default 0'
                    }
                  }
                }
              },
              {
                name: 'check_permissions',
                description: 'Check database permissions for DDL, DROP, DELETE and other operations',
                inputSchema: {
                  type: 'object',
                  properties: {}
                }
              },
              {
                name: 'get_ddl_sql_logs',
                description: 'Get DDL SQL operation logs',
                inputSchema: {
                  type: 'object',
                  properties: {
                    limit: {
                      type: 'number',
                      description: 'Limit count, default 50, max 500'
                    },
                    offset: {
                      type: 'number',
                      description: 'Offset, default 0'
                    }
                  }
                }
              },

            ],
            environment: {
              ALLOW_DDL: ALLOW_DDL,
              ALLOW_DROP: ALLOW_DROP,
              ALLOW_DELETE: ALLOW_DELETE,
              MYSQL_HOST: process.env.MYSQL_HOST || 'localhost',
              MYSQL_PORT: process.env.MYSQL_PORT || '3306',
              MYSQL_USER: process.env.MYSQL_USER || 'root',
              MYSQL_DATABASE: process.env.MYSQL_DATABASE || '',
              serverInfo: {
                name: this.name,
                version: this.version
              }
            }
          };
        } else if (method === 'prompts/list') {
          // Return empty prompts list since we don't provide prompts functionality
          // Ensure return format complies with MCP protocol standard
          result = {
            prompts: []
          };
        } else if (method === 'prompts/call') {
          // Handle prompts call, but we don't provide prompts functionality
          // Return error instead of throwing exception to maintain protocol consistency
          result = {
            messages: [
              {
                role: 'assistant',
                content: [
                  {
                    type: 'text',
                    text: 'Unsupported prompts call'
                  }
                ]
              }
            ]
          };
        } else if (method === 'resources/list') {
          // Return empty resources list since we don't provide resources functionality
          result = {
            resources: []
          };
        } else if (method === 'resources/read') {
          // Handle resources read, but we don't provide resources functionality
          // Return error instead of throwing exception to maintain protocol consistency
          result = {
            contents: [
              {
                uri: 'error://unsupported',
                text: 'Unsupported resources read'
              }
            ]
          };
        } else if (method === 'logging/list') {
          // Return empty logging list since we don't provide logging functionality
          result = {
            logs: []
          };
        } else if (method === 'logging/read') {
          // Handle logging read, but we don't provide logging functionality
          // Return error instead of throwing exception to maintain protocol consistency
          result = {
            contents: [
              {
                uri: 'error://unsupported',
                text: 'Unsupported logging read'
              }
            ]
          };
        } else if (method === 'roots/list') {
          // Return empty roots list since we don't provide roots functionality
          result = {
            roots: []
          };
        } else if (method === 'roots/read') {
          // Handle roots read, but we don't provide roots functionality
          // Return error instead of throwing exception to maintain protocol consistency
          result = {
            contents: [
              {
                uri: 'error://unsupported',
                text: 'Unsupported roots read'
              }
            ]
          };
        } else if (method === 'tools/call') {
          const { name, arguments: args } = params || {};

          if (!name) {
            throw new Error('Missing tool name');
          }

          // Check if method exists
          if (!this[name]) {
            throw new Error(`Unknown tool: ${name}`);
          }

          result = await this[name](args || {});

          // Tool call results need to be wrapped in content
          // Ensure return format complies with MCP protocol
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } else if (method === 'ping') {
          logRequest('ping', {}, { status: 'pong' }, null);
          result = { pong: true };
        } else if (method === 'shutdown') {
          // Handle shutdown request
          result = null;
          // Close connection pool
          await this.closeConnectionPool();
          // Delay exit to give client time to process response
          setTimeout(() => {
            process.exit(0);
          }, 100);
        } else if (method === 'notifications/initialized') {
          // Handle initialization notification - this is a standard notification in MCP protocol
          // Notifications don't need to return results, so result remains null
          
          // Create database connection pool
          try {
            this.connectionPool = mysql.createPool({
              ...getDbConfig(),
              connectionLimit: 10,
              acquireTimeout: 60000,
              timeout: 60000,
              queueLimit: 0
            });
            
            // Test connection pool
            const testConn = await this.connectionPool.getConnection();
            await testConn.ping();
            testConn.release();
            
            console.error('Database connection pool created successfully');
            logRequest('connection_pool_created', { 
              host: getDbConfig().host,
              port: getDbConfig().port,
              database: getDbConfig().database,
              connectionLimit: 10
            }, { status: 'success' }, null);
          } catch (err) {
            console.error('Failed to create database connection pool:', err.message);
            logRequest('connection_pool_error', { 
              error: err.message 
            }, null, err.message);
          }
        } else if (method === 'notifications/exit') {
          // Handle exit notification
          result = null;
          // Close connection pool
          await this.closeConnectionPool();
          process.exit(0);
        } else {
          throw new Error(`Unknown method: ${method}`);
        }
      } catch (err) {
        error = err.message;
        throw err;
      } finally {
        // Record all requests to log, ensure parameters are not undefined
        const safeParams = params || {};
        logRequest(method, safeParams, result, error);
      }

      // For notification methods, no response is needed
      if (method === 'notifications/initialized' || method === 'notifications/exit') {
        return null;
      }
      
      // shutdown method needs to return response
      if (method === 'shutdown') {
        return {
          jsonrpc: '2.0',
          id,
          result: null
        };
      }

      // Ensure all methods return correct response format
      return {
        jsonrpc: '2.0',
        id,
        result
      };
    } catch (error) {
      // Use standard MCP error codes
      let errorCode = -32603; // Internal error
      let errorMessage = error.message;
      
      if (error.message.includes('Server not initialized')) {
        errorCode = -32002; // Server not initialized
      } else if (error.message.includes('Unknown method')) {
        errorCode = -32601; // Method not found
      } else if (error.message.includes('Unsupported JSON-RPC version')) {
        errorCode = -32600; // Invalid Request
      }
      logRequest('error', { error: error.message, stack: error.stack }, null, error.message);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: errorCode,
          message: errorMessage
        }
      };
    }
  }

  // Start server
  async start() {
    console.error('MCP MySQL server started');

    // Display log configuration
    const logConfig = getLogConfig();
    console.error(`Log directory: ${logConfig.dir}`);
    console.error(`Log file: ${logConfig.fullPath}`);
    console.error(`DDL SQL log file: ${logConfig.ddlFullPath}`);

    // Listen to stdin
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', async (data) => {
      try {
        const lines = data.toString().trim().split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const request = JSON.parse(line);
              const response = await this.handleRequest(request);
              if (response) {
                console.log(JSON.stringify(response));
              }
            } catch (requestError) {
              console.error('Error processing individual request:', requestError.message);
              // Send error response instead of crashing the entire server
              const errorResponse = {
                jsonrpc: '2.0',
                id: null,
                error: {
                  code: -32603,
                  message: `Internal error: ${requestError.message}`
                }
              };
              console.log(JSON.stringify(errorResponse));
            }
          }
        }
      } catch (error) {
        console.error('Error processing data:', error.message);
        // Log error but don't exit server
        logRequest('data_processing_error', { error: error.message }, null, error.message);
      }
    });

    // Handle process signals
    process.on('SIGTERM', async () => {
      console.error('Received SIGTERM signal, shutting down server...');
      logRequest('SIGTERM', { signal: 'SIGTERM' }, { status: 'shutting_down' }, null);
      await this.closeConnectionPool();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.error('Received SIGINT signal, shutting down server...');
      logRequest('SIGINT', { signal: 'SIGINT' }, { status: 'shutting_down' }, null);
      await this.closeConnectionPool();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      logRequest('uncaughtException', { error: error.message, stack: error.stack }, null, error.message);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Promise rejection:', reason);
      logRequest('unhandledRejection', { reason: reason.toString(), promise: promise.toString() }, null, reason.toString());
      process.exit(1);
    });

    // Record server startup
    logRequest('server_start', {
      name: this.name,
      version: this.version,
      logDir: logConfig.dir,
      logFile: logConfig.fullPath
    }, { status: 'started' }, null);

    // Start periodic health checks
    this.startHealthCheck();
  }

  // Periodic health check
  startHealthCheck() {
    // Check connection pool health every 5 minutes
    setInterval(async () => {
      try {
        if (this.connectionPool) {
          const isHealthy = await this.checkConnectionPoolHealth();
          if (!isHealthy) {
            console.error('Connection pool unhealthy, attempting to recreate...');
            await this.ensureConnectionPool();
          }
        }
      } catch (err) {
        console.error('Health check failed:', err.message);
        logRequest('health_check_error', { error: err.message }, null, err.message);
      }
    }, 5 * 60 * 1000); // 5分钟
  }
}

// Start server
async function main() {
  console.error('Starting MCP MySQL server...');
  const server = new FinalMCPServer();
  await server.start();
  console.error('MCP MySQL server started successfully');
}

main().catch(error => {
  console.error(error);
  // Write to log
  logRequest('main', { error: error.message, stack: error.stack }, null, error.message);
  process.exit(1);
}); 