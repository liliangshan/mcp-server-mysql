#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ServerManager {
  constructor() {
    this.serverProcess = null;
    this.restartCount = 0;
    this.maxRestarts = 10;
    this.restartDelay = 5000; // 5 seconds
    this.serverPath = path.resolve(__dirname, 'src/server-final.js');
  }

  start() {
    console.log('Starting MCP MySQL server...');
    this.spawnServer();
  }

  spawnServer() {
    // Set environment variables
    const env = {
      ...process.env,
      MYSQL_HOST: process.env.MYSQL_HOST || 'localhost',
      MYSQL_PORT: process.env.MYSQL_PORT || '3306',
      MYSQL_USER: process.env.MYSQL_USER || 'root',
      MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '',
      MYSQL_DATABASE: process.env.MYSQL_DATABASE || '',
      MCP_LOG_DIR: process.env.MCP_LOG_DIR || './logs',
      MCP_LOG_FILE: process.env.MCP_LOG_FILE || 'mcp-mysql.log'
    };

    this.serverProcess = spawn('node', [this.serverPath], {
      stdio: ['inherit', 'inherit', 'inherit'],
      env: env
    });

    console.log(`Server process started, PID: ${this.serverProcess.pid}`);

    this.serverProcess.on('close', (code) => {
      console.log(`Server process exited, exit code: ${code}`);
      this.handleServerExit(code);
    });

    this.serverProcess.on('error', (err) => {
      console.error('Server process error:', err.message);
      this.handleServerError(err);
    });

    // Handle process signals
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM signal, shutting down server...');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      console.log('Received SIGINT signal, shutting down server...');
      this.shutdown();
    });
  }

  handleServerExit(code) {
    if (code === 0) {
      console.log('Server exited normally');
      process.exit(0);
    } else {
      console.error(`Server exited abnormally, exit code: ${code}`);
      this.restartServer();
    }
  }

  handleServerError(err) {
    console.error('Server process error:', err.message);
    this.restartServer();
  }

  restartServer() {
    if (this.restartCount < this.maxRestarts) {
      this.restartCount++;
      console.log(`Restarting server... (${this.restartCount}/${this.maxRestarts})`);
      
      setTimeout(() => {
        this.spawnServer();
      }, this.restartDelay);
    } else {
      console.error(`Reached maximum restart count (${this.maxRestarts}), stopping restarts`);
      process.exit(1);
    }
  }

  shutdown() {
    if (this.serverProcess) {
      console.log('Sending SIGTERM signal to server process...');
      this.serverProcess.kill('SIGTERM');
      
              // Wait 5 seconds then force exit
      setTimeout(() => {
        if (this.serverProcess) {
          console.log('Force killing server process...');
          this.serverProcess.kill('SIGKILL');
        }
        process.exit(0);
      }, 5000);
    } else {
      process.exit(0);
    }
  }
}

// Start server manager
const manager = new ServerManager();
manager.start(); 