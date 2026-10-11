# MCP MySQL Server

A MCP MySQL server with DDL support, permission control and operation logs.

## Version History

### v3.1.0 (Latest)
- ✅ **BIGINT Precision Support**: Added `supportBigNumbers` and `bigNumberStrings` options to prevent precision loss for large integers (e.g., `order_id`, `user_id` > 2^53 - 1). Values are returned as strings to maintain full precision.

### v3.0.0
- ✅ **Readonly Mode**: Added `READONLY` environment variable - when enabled, only SELECT and SHOW commands are allowed (highest priority check)
- ✅ **Tool Prefix Support**: Added `TOOL_PREFIX` environment variable for tool name isolation and config separation
- ✅ **Project Branding**: Added `PROJECT_NAME` environment variable for custom tool descriptions
- ✅ **Enhanced Permission Check**: Improved `check_permissions` tool with detailed messages and readonly mode warnings
- ✅ **Default Log Path**: Changed default log directory from `./logs` to `./.setting` (or `./.setting.<TOOL_PREFIX>` if prefix is set)
- ✅ **Multiple Instance Support**: Full support for running multiple MySQL server instances with isolated configurations
- ✅ **Improved CLI**: Updated CLI to support all new environment variables and log path configuration

### v2.0.1
- ✅ **DDL SQL Logging**: Added dedicated DDL SQL operation logging to `ddl.sql` file
- ✅ **Success-Only Logging**: Only successful DDL operations are recorded to the SQL file
- ✅ **Timestamped Entries**: Each DDL operation includes precise timestamp comments
- ✅ **Auto-Formatting**: SQL statements are automatically formatted with semicolon endings
- ✅ **New Tool**: Added `get_ddl_sql_logs` tool for querying DDL operation history
- ✅ **Enhanced Logging**: Improved logging configuration with separate DDL log file support

### v2.0.0
- ✅ Initial release with DDL support
- ✅ Permission control system
- ✅ Operation logging
- ✅ Connection pool management

## Features

- ✅ SQL query execution (DDL and DML)
- ✅ Database information retrieval
- ✅ Operation logging
- ✅ Connection pool management
- ✅ Auto-reconnection mechanism
- ✅ Health checks
- ✅ Error handling and recovery

## Installation

### Global Installation (Recommended)
```bash
npm install -g @liangshanli/mcp-server-mysql
```

### Local Installation
```bash
npm install @liangshanli/mcp-server-mysql
```

### From Source
```bash
git clone https://github.com/liliangshan/mcp-server-mysql.git
cd mcp-server-mysql
npm install
```

## Configuration

Set environment variables:

```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=your_password
export MYSQL_DATABASE=your_database
export MYSQL_SSL=false
export READONLY=false
export ALLOW_DDL=true
export ALLOW_DROP=false
export ALLOW_DELETE=false

# Optional: Tool prefix for config isolation
export TOOL_PREFIX="projA"

# Optional: Project branding
export PROJECT_NAME="MyProject"
```

## Usage

### 1. Direct Run (Global Installation)
```bash
mcp-server-mysql
```

### 2. Using npx (Recommended)
```bash
npx @liangshanli/mcp-server-mysql
```

### 3. Direct Start (Source Installation)
```bash
npm start
```

### 4. Managed Start (Recommended for Production)
```bash
npm run start-managed
```

Managed start provides:
- Auto-restart (up to 10 times)
- Error recovery
- Process management
- Logging

### 5. Development Mode
```bash
npm run dev
```

## Editor Integration

### Cursor Editor Configuration

1. Create `.cursor/mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["@liangshanli/mcp-server-mysql"],
      "env": {
        "MYSQL_HOST": "your_host",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_user",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database",
        "MYSQL_SSL": "false",
        "READONLY": "false",
        "ALLOW_DDL": "false",
        "ALLOW_DROP": "false",
        "ALLOW_DELETE": "false",
        "TOOL_PREFIX": "projA",
        "PROJECT_NAME": "MyProject"
      }
    }
  }
}
```

### VS Code Configuration

1. Install the MCP extension for VS Code
2. Create `.vscode/settings.json` file:

```json
{
  "mcp.servers": {
    "mysql": {
      "command": "npx",
      "args": ["@liangshanli/mcp-server-mysql"],
      "env": {
        "MYSQL_HOST": "your_host",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_user",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database",
        "MYSQL_SSL": "false",
        "READONLY": "false",
        "ALLOW_DDL": "false",
        "ALLOW_DROP": "false",
        "ALLOW_DELETE": "false",
        "TOOL_PREFIX": "projA",
        "PROJECT_NAME": "MyProject"
      }
    }
  }
}
```

### Multiple MySQL Server Instances Support

You can configure multiple MySQL server instances with different `TOOL_PREFIX` and `PROJECT_NAME` to isolate tools and configurations. This is useful when you need to connect to multiple databases simultaneously.

**Example: Cursor Editor Configuration**

Create `.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "local-mysql": {
      "disabled": false,
      "timeout": 60,
      "command": "npx",
      "args": ["@liangshanli/mcp-server-mysql"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_user",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database",
        "MYSQL_SSL": "false",
        "ALLOW_DDL": "true",
        "ALLOW_DROP": "true",
        "ALLOW_DELETE": "false",
        "TOOL_PREFIX": "local",
        "PROJECT_NAME": "local-mysql"
      }
    },
    "online-mysql": {
      "disabled": false,
      "timeout": 60,
      "command": "npx",
      "args": ["@liangshanli/mcp-server-mysql"],
      "env": {
        "MYSQL_HOST": "your_remote_host",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_user",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database",
        "MYSQL_SSL": "true",
        "READONLY": "true",
        "ALLOW_DDL": "false",
        "ALLOW_DROP": "false",
        "ALLOW_DELETE": "false",
        "TOOL_PREFIX": "online",
        "PROJECT_NAME": "online-mysql"
      }
    }
  }
}
```

**Benefits of Multiple Instances:**

- **Tool Isolation**: Each instance has its own tool names (e.g., `local_sql_query`, `online_sql_query`)
- **Config Isolation**: Logs and DDL files are stored in separate directories (e.g., `./.setting.local/`, `./.setting.online/`)
- **Different Permissions**: Configure different permission levels for each instance (e.g., readonly for production, full access for development)
- **Project Branding**: Each instance can have its own project name for better identification

**Note**: When using multiple instances, tools will be prefixed with `TOOL_PREFIX`. For example:
- `local_sql_query` - queries the local database
- `online_sql_query` - queries the online database (readonly)

### As MCP Server

The server communicates with MCP clients via stdin/stdout after startup:

```json
{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}}
```

### Available Tools

1. **sql_query**: Execute SQL queries
   ```json
   {
     "jsonrpc": "2.0",
     "id": 2,
     "method": "tools/call",
     "params": {
       "name": "sql_query",
       "arguments": {
         "sql": "SELECT * FROM users LIMIT 10"
       }
     }
   }
   ```

2. **get_database_info**: Get database information
   ```json
   {
     "jsonrpc": "2.0",
     "id": 3,
     "method": "tools/call",
     "params": {
       "name": "get_database_info",
       "arguments": {}
     }
   }
   ```

3. **get_operation_logs**: Get operation logs
   ```json
   {
     "jsonrpc": "2.0",
     "id": 4,
     "method": "tools/call",
     "params": {
       "name": "get_operation_logs",
       "arguments": {
         "limit": 50,
         "offset": 0
       }
     }
   }
   ```

4. **get_ddl_sql_logs**: Get DDL SQL operation logs (v2.0.1+)
   ```json
   {
     "jsonrpc": "2.0",
     "id": 5,
     "method": "tools/call",
     "params": {
       "name": "get_ddl_sql_logs",
       "arguments": {
         "limit": 50,
         "offset": 0
       }
     }
   }
   ```

5. **check_permissions**: Check database permissions
   ```json
   {
     "jsonrpc": "2.0",
     "id": 6,
     "method": "tools/call",
     "params": {
       "name": "check_permissions",
       "arguments": {}
     }
   }
   ```

## Connection Pool Features

- **Auto-creation**: Automatically creates connection pool on `notifications/initialized`
- **Health checks**: Checks connection pool status every 5 minutes
- **Auto-reconnection**: Automatically recreates connection pool when it fails
- **Connection reuse**: Uses connection pool for better performance
- **Graceful shutdown**: Properly releases connections when server shuts down

## Logging

### General Logs
Log file location: `./.setting/mcp-mysql.log` (or `./.setting.<TOOL_PREFIX>/mcp-mysql.log` if TOOL_PREFIX is set)

Logged content:
- All requests and responses
- SQL operation records
- Error messages
- Connection pool status changes

### DDL SQL Logs (v2.0.1+)
DDL log file location: `./.setting/ddl.sql` (or `./.setting.<TOOL_PREFIX>/ddl.sql` if TOOL_PREFIX is set)

Features:
- **Success-Only Recording**: Only successful DDL operations are recorded
- **Timestamped Entries**: Each operation includes precise timestamp comments
- **Auto-Formatting**: SQL statements are automatically formatted with semicolon endings
- **Executable Format**: Can be directly executed to recreate database structure

Example DDL log format:
```sql
# 2024-01-15 14:23:45
CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));
# 2024-01-15 14:24:12
ALTER TABLE users ADD COLUMN email VARCHAR(255);
# 2024-01-15 14:25:33
CREATE INDEX idx_email ON users(email);
```

#### DDL Logging Benefits

**🔄 Database Synchronization**
- **Production Sync**: Easily synchronize database schema changes from development to production environments
- **Multi-Environment Deployment**: Apply the same DDL changes across staging, testing, and production databases
- **Rollback Support**: Maintain a complete history of schema changes for easy rollback operations

**📋 Development Workflow**
- **Schema Versioning**: Track database evolution with timestamped change history
- **Team Collaboration**: Share database structure changes with team members through executable SQL files
- **Code Review**: Review database changes alongside application code changes

**🛡️ Operational Excellence**
- **Audit Trail**: Maintain comprehensive audit logs of all database structure modifications
- **Compliance**: Meet regulatory requirements for database change tracking
- **Disaster Recovery**: Quickly rebuild database structure from DDL logs in case of data loss

**⚡ Performance & Reliability**
- **Clean Execution**: Only successful operations are recorded, ensuring reliable script execution
- **Error Prevention**: Failed operations are excluded, preventing script execution errors
- **Automated Formatting**: Consistent SQL formatting reduces manual errors and improves readability

## Error Handling

- Individual request errors don't affect the entire server
- Connection pool errors are automatically recovered
- Process exceptions are automatically restarted (managed mode)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| MYSQL_HOST | localhost | MySQL host address |
| MYSQL_PORT | 3306 | MySQL port |
| MYSQL_USER | root | MySQL username |
| MYSQL_PASSWORD | | MySQL password |
| MYSQL_DATABASE | | Database name |
| MYSQL_SSL | false | If set to 'true', enables SSL connection to MySQL server |
| READONLY | false | If set to 'true', only SELECT and SHOW commands are allowed. This check has the highest priority and overrides all other permission settings |
| ALLOW_DDL | false | Whether to allow DDL operations (CREATE, ALTER, TRUNCATE, RENAME, COMMENT). Set to 'true' to enable |
| ALLOW_DROP | false | Whether to allow DROP operations. Set to 'true' to enable |
| ALLOW_DELETE | false | Whether to allow DELETE operations. Set to 'true' to enable |
| TOOL_PREFIX | | Optional tool prefix for tool names and config isolation. Example: `export TOOL_PREFIX="projA"` |
| PROJECT_NAME | | Optional project branding for tool descriptions |
| MCP_LOG_DIR | ./.setting (or ./.setting.<TOOL_PREFIX> if TOOL_PREFIX is set) | Log directory |
| MCP_LOG_FILE | mcp-mysql.log | Log filename |
| MCP_DDL_LOG_FILE | ddl.sql | DDL SQL log filename (v2.0.1+) |

## Development

### Project Structure
```
mcpmysql/
├── src/
│   └── server-final.js    # Main server file
├── start-server.js        # Managed startup script
├── package.json
└── README.md
```

### Testing
```bash
npm test
```

## Quick Start

### 1. Install Package
```bash
npm install -g @liangshanli/mcp-server-mysql
```

### 2. Configure Environment Variables
```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=your_password
export MYSQL_DATABASE=your_database
export MYSQL_SSL=false
export READONLY=false
export ALLOW_DDL=false
export ALLOW_DROP=false
export ALLOW_DELETE=false
```

**Permission Control Examples:**
```bash
# Readonly mode: Only SELECT and SHOW commands allowed (highest priority)
export READONLY=true

# Default: Disable all destructive operations (safe mode)
export READONLY=false
export ALLOW_DDL=false
export ALLOW_DROP=false
export ALLOW_DELETE=false

# Allow DDL but disable DROP and DELETE
export READONLY=false
export ALLOW_DDL=true
export ALLOW_DROP=false
export ALLOW_DELETE=false

# Allow everything except DELETE
export READONLY=false
export ALLOW_DDL=true
export ALLOW_DROP=true
export ALLOW_DELETE=false

# Enable all operations (use with caution)
export READONLY=false
export ALLOW_DDL=true
export ALLOW_DROP=true
export ALLOW_DELETE=true
```

### 3. Run Server
```bash
mcp-server-mysql
```

## License

MIT 