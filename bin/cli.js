#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 日志配置
const getLogConfig = () => {
  const logDir = process.env.MCP_LOG_DIR || './logs';
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

// Start MCP server
const env = {
  ...process.env,
  // Ensure environment variables are passed
  MYSQL_HOST: process.env.MYSQL_HOST || 'localhost',
  MYSQL_PORT: process.env.MYSQL_PORT || '3306',
  MYSQL_USER: process.env.MYSQL_USER || 'root',
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '',
  MYSQL_DATABASE: process.env.MYSQL_DATABASE || '',
  ALLOW_DDL: process.env.ALLOW_DDL || 'true',
  MCP_LOG_DIR: process.env.MCP_LOG_DIR || './logs',
  MCP_LOG_FILE: process.env.MCP_LOG_FILE || 'mcp-mysql.log',
};

writeLog('INFO', 'Starting MCP MySQL server with environment:', {
  MYSQL_HOST: env.MYSQL_HOST,
  MYSQL_PORT: env.MYSQL_PORT,
  MYSQL_USER: env.MYSQL_USER,
  MYSQL_DATABASE: env.MYSQL_DATABASE,
  ALLOW_DDL: env.ALLOW_DDL
});

const server = spawn('node', [serverPath], {
  stdio: ['inherit', 'inherit', 'inherit'],
  env: env
});

writeLog('INFO', `MCP MySQL server process started with PID: ${server.pid}`);

// Handle process exit
server.on('close', (code) => {
  writeLog('INFO', `MCP MySQL server exited with code: ${code}`);
  process.exit(code);
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
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  writeLog('INFO', 'Received SIGTERM, shutting down server...');
  server.kill('SIGTERM');
});

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