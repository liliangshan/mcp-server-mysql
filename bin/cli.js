#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get tool prefix for log directory
const TOOL_PREFIX = process.env.TOOL_PREFIX || '';

// 日志配置
const getLogConfig = () => {
  // Default log directory: .setting/ or .setting.<TOOL_PREFIX>/
  let defaultLogDir = './.setting';
  if (TOOL_PREFIX) {
    defaultLogDir = `./.setting.${TOOL_PREFIX}`;
  }
  
  const logDir = process.env.MCP_LOG_DIR || defaultLogDir;
  const logFile = process.env.MCP_LOG_FILE || 'mcp-mysql-cli.log';
  return {
    dir: logDir,
    file: logFile,
    fullPath: path.join(logDir, logFile)
  };
};

// 确保日志目录存在
const ensureLogDir = () => {
  const { dir } = getLogConfig();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 写入日志
const writeLog = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data: data ? JSON.stringify(data) : null
  };
  
  const logLine = `${timestamp} | ${level} | ${message}${data ? ` | ${JSON.stringify(data)}` : ''}\n`;
  
  try {
    ensureLogDir();
    const { fullPath } = getLogConfig();
    fs.appendFileSync(fullPath, logLine, 'utf8');
  } catch (err) {
    console.error('Failed to write log file:', err.message);
  }
  
  // 同时输出到控制台
  console.error(`[${level}] ${message}`);
};

// Get server script path
const serverPath = path.resolve(__dirname, '../src/server-final.js');

// Check if server file exists
if (!fs.existsSync(serverPath)) {
  const errorMsg = `Server file not found: ${serverPath}`;
  writeLog('ERROR', errorMsg);
  process.exit(1);
}

writeLog('INFO', `Starting MCP MySQL server from: ${serverPath}`);



let server = null;

// Function to start server
function startServer() {
  // Create environment object
  const env = {
    ...process.env,
    // Ensure environment variables are passed
    MYSQL_HOST: process.env.MYSQL_HOST || 'localhost',
    MYSQL_PORT: process.env.MYSQL_PORT || '3306',
    MYSQL_USER: process.env.MYSQL_USER || 'root',
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '',
    MYSQL_DATABASE: process.env.MYSQL_DATABASE || '',
    READONLY: process.env.READONLY || 'false',
    ALLOW_DDL: process.env.ALLOW_DDL || 'false',
    ALLOW_DROP: process.env.ALLOW_DROP || 'false',
    ALLOW_DELETE: process.env.ALLOW_DELETE || 'false',
    TOOL_PREFIX: process.env.TOOL_PREFIX || '',
    PROJECT_NAME: process.env.PROJECT_NAME || '',
    MCP_LOG_DIR: process.env.MCP_LOG_DIR || (process.env.TOOL_PREFIX ? `./.setting.${process.env.TOOL_PREFIX}` : './.setting'),
    MCP_LOG_FILE: process.env.MCP_LOG_FILE || 'mcp-mysql.log',
    MCP_DDL_LOG_FILE: process.env.MCP_DDL_LOG_FILE || 'ddl.sql',
  };

  writeLog('INFO', 'Starting MCP MySQL server with environment:', {
    MYSQL_HOST: env.MYSQL_HOST,
    MYSQL_PORT: env.MYSQL_PORT,
    MYSQL_USER: env.MYSQL_USER,
    MYSQL_DATABASE: env.MYSQL_DATABASE,
    READONLY: env.READONLY,
    ALLOW_DDL: env.ALLOW_DDL,
    ALLOW_DROP: env.ALLOW_DROP,
    ALLOW_DELETE: env.ALLOW_DELETE,
    TOOL_PREFIX: env.TOOL_PREFIX || '(not set)',
    PROJECT_NAME: env.PROJECT_NAME || '(not set)',
    MCP_LOG_DIR: env.MCP_LOG_DIR,
    MCP_DDL_LOG_FILE: env.MCP_DDL_LOG_FILE
  });

  server = spawn('node', [serverPath], {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: env
  });

  writeLog('INFO', `MCP MySQL server process started with PID: ${server.pid}`);

  // Add signal handling debug info
  writeLog('INFO', 'Signal handlers registered for SIGINT and SIGTERM');
  writeLog('INFO', 'Press Ctrl+C to gracefully shutdown the server');
  
}

// Start the server
startServer();

// Handle process exit
server.on('close', (code) => {
  writeLog('INFO', `MCP MySQL server exited with code: ${code}`);
  // Clear any pending shutdown timeout
  if (global.shutdownTimeout) {
    clearTimeout(global.shutdownTimeout);
  }
  
  // Check if this is a restart request
  if (code === 0) {
    writeLog('INFO', 'Server requested restart, restarting...');
    setTimeout(() => {
      startServer();
    }, 2000); // Wait 2 seconds before restart
  } else {
    // Exit CLI process when server exits with error
    setTimeout(() => {
      writeLog('INFO', 'CLI process exiting after server shutdown');
      process.exit(code);
    }, 1000);
  }
});

// Handle server error
server.on('error', (err) => {
  writeLog('ERROR', 'Server process error:', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

// Handle errors
server.on('error', (err) => {
  writeLog('ERROR', 'Failed to start MCP MySQL server:', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

// Handle signals
process.on('SIGINT', () => {
  writeLog('INFO', 'Received SIGINT, shutting down server...');
  gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  writeLog('INFO', 'Received SIGTERM, shutting down server...');
  gracefulShutdown('SIGTERM');
});

// Handle Windows specific signals
process.on('SIGBREAK', () => {
  writeLog('INFO', 'Received SIGBREAK, shutting down server...');
  gracefulShutdown('SIGTERM');
});

// Handle restart signal from server
process.on('SIGUSR1', () => {
  writeLog('INFO', 'Received restart signal from server...');
  restartServer();
});

// Handle process exit
process.on('exit', (code) => {
  writeLog('INFO', `CLI process exiting with code: ${code}`);
});

// Graceful shutdown function
function gracefulShutdown(signal) {
  // Set a timeout to force exit if server doesn't respond
  global.shutdownTimeout = setTimeout(() => {
    writeLog('WARN', 'Server shutdown timeout, forcing exit...');
    try {
      if (server) {
        server.kill('SIGKILL');
      }
    } catch (err) {
      writeLog('ERROR', 'Failed to force kill server:', {
        error: err.message
      });
    }
    process.exit(1);
  }, 10000); // 10 seconds timeout
  
  // Try graceful shutdown
  try {
    if (server) {
      server.kill(signal);
      writeLog('INFO', `Sent ${signal} signal to server process ${server.pid}`);
    } else {
      writeLog('WARN', 'No server process to shutdown');
      process.exit(0);
    }
  } catch (err) {
    writeLog('ERROR', `Failed to send ${signal} signal to server:`, {
      error: err.message
    });
    if (global.shutdownTimeout) {
      clearTimeout(global.shutdownTimeout);
    }
    process.exit(1);
  }
}

// Restart server function
function restartServer() {
  writeLog('INFO', 'Restarting MCP server...');
  if (server) {
    try {
      server.kill('SIGTERM');
      setTimeout(() => {
        if (server && !server.killed) {
          writeLog('WARN', 'Server not responding to SIGTERM, forcing kill...');
          server.kill('SIGKILL');
        }
        startServer();
      }, 3000); // Wait 3 seconds for graceful shutdown
    } catch (err) {
      writeLog('ERROR', 'Failed to stop server for restart:', { error: err.message });
      startServer();
    }
  } else {
    startServer();
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  writeLog('ERROR', 'Uncaught exception in CLI:', {
    error: err.message,
    stack: err.stack
  });
  server.kill('SIGTERM');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  writeLog('ERROR', 'Unhandled Promise rejection in CLI:', {
    reason: reason.toString(),
    promise: promise.toString()
  });
  server.kill('SIGTERM');
  process.exit(1);
}); 