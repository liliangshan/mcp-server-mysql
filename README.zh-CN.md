# MCP MySQL 服务器

一个支持DDL操作、权限控制和操作日志的MCP MySQL服务器。

## 版本历史

### v2.0.1 (最新版本)
- ✅ **DDL SQL 日志记录**：新增专门的 DDL SQL 操作日志记录到 `ddl.sql` 文件
- ✅ **仅记录成功操作**：只有成功的 DDL 操作才会记录到 SQL 文件中
- ✅ **时间戳条目**：每个 DDL 操作都包含精确的时间戳注释
- ✅ **自动格式化**：SQL 语句自动格式化并添加分号结尾
- ✅ **新工具**：新增 `get_ddl_sql_logs` 工具用于查询 DDL 操作历史
- ✅ **增强日志**：改进日志配置，支持独立的 DDL 日志文件

### v2.0.0
- ✅ 初始版本，支持 DDL 操作
- ✅ 权限控制系统
- ✅ 操作日志记录
- ✅ 连接池管理

## 功能特性

- ✅ 支持SQL查询执行（DDL和DML）
- ✅ 数据库信息获取
- ✅ 操作日志记录
- ✅ 连接池管理
- ✅ 自动重连机制
- ✅ 健康检查
- ✅ 错误处理和恢复

## 安装

### 全局安装（推荐）
```bash
npm install -g @liangshanli/mcp-server-mysql
```

### 本地安装
```bash
npm install @liangshanli/mcp-server-mysql
```

### 从源码安装
```bash
git clone https://github.com/liliangshan/mcp-server-mysql.git
cd mcp-server-mysql
npm install
```

## 配置

设置环境变量：

```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=your_password
export MYSQL_DATABASE=your_database
export ALLOW_DDL=true
export ALLOW_DROP=false
export ALLOW_DELETE=false
```

## 使用方法

### 1. 全局安装后直接运行
```bash
mcp-server-mysql
```

### 2. 使用 npx 运行（推荐）
```bash
npx @liangshanli/mcp-server-mysql
```

### 3. 直接启动（源码安装）
```bash
npm start
```

### 4. 托管启动（推荐用于生产环境）
```bash
npm run start-managed
```

托管启动提供以下功能：
- 自动重启（最多10次）
- 错误恢复
- 进程管理
- 日志记录

### 5. 开发模式
```bash
npm run dev
```

## 编辑器集成

### Cursor 编辑器配置

1. 在项目根目录创建 `.cursor/mcp.json` 文件：

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
        "ALLOW_DDL": "false",
        "ALLOW_DROP": "false",
        "ALLOW_DELETE": "false"
      }
    }
  }
}
```

### VS Code 配置

1. 安装 VS Code 的 MCP 扩展
2. 创建 `.vscode/settings.json` 文件：

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
        "ALLOW_DDL": "false",
        "ALLOW_DROP": "false",
        "ALLOW_DELETE": "false"
      }
    }
  }
}
```

### 作为MCP服务器

服务器启动后，通过stdin/stdout与MCP客户端通信：

```json
{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}}
```

### 可用工具

1. **sql_query**: 执行SQL查询
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

2. **get_database_info**: 获取数据库信息
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

3. **get_operation_logs**: 获取操作日志
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

4. **get_ddl_sql_logs**: 获取 DDL SQL 操作日志 (v2.0.1+)
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

5. **check_permissions**: 检查数据库权限
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

## 连接池特性

- **自动创建**: 在`notifications/initialized`时自动创建连接池
- **健康检查**: 每5分钟检查连接池状态
- **自动重连**: 连接池失效时自动重新创建
- **连接复用**: 使用连接池提高性能
- **优雅关闭**: 服务器关闭时正确释放连接

## 日志

### 常规日志
日志文件位置：`./logs/mcp-mysql.log`

记录内容：
- 所有请求和响应
- SQL操作记录
- 错误信息
- 连接池状态变化

### DDL SQL 日志 (v2.0.1+)
DDL 日志文件位置：`./logs/ddl.sql`

功能特性：
- **仅记录成功操作**：只有成功的 DDL 操作才会被记录
- **时间戳条目**：每个操作都包含精确的时间戳注释
- **自动格式化**：SQL 语句自动格式化并添加分号结尾
- **可执行格式**：可以直接执行来重建数据库结构

DDL 日志格式示例：
```sql
# 2024-01-15 14:23:45
CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));
# 2024-01-15 14:24:12
ALTER TABLE users ADD COLUMN email VARCHAR(255);
# 2024-01-15 14:25:33
CREATE INDEX idx_email ON users(email);
```

#### DDL 日志记录优势

**🔄 数据库同步**
- **生产环境同步**：轻松将开发环境的数据库结构变更同步到生产环境
- **多环境部署**：在测试、预发布、生产等多个环境中应用相同的 DDL 变更
- **回滚支持**：维护完整的结构变更历史，便于快速回滚操作

**📋 开发工作流**
- **结构版本控制**：通过时间戳记录跟踪数据库演进历史
- **团队协作**：通过可执行的 SQL 文件与团队成员分享数据库结构变更
- **代码审查**：将数据库变更与应用程序代码变更一起进行审查

**🛡️ 运营卓越**
- **审计跟踪**：维护所有数据库结构修改的全面审计日志
- **合规性**：满足数据库变更跟踪的监管要求
- **灾难恢复**：在数据丢失情况下快速从 DDL 日志重建数据库结构

**⚡ 性能与可靠性**
- **清洁执行**：只记录成功操作，确保脚本执行的可靠性
- **错误预防**：排除失败操作，防止脚本执行错误
- **自动格式化**：一致的 SQL 格式化减少手动错误并提高可读性

## 错误处理

- 单个请求错误不会影响整个服务器
- 连接池错误会自动恢复
- 进程异常会自动重启（托管模式）

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| MYSQL_HOST | localhost | MySQL主机地址 |
| MYSQL_PORT | 3306 | MySQL端口 |
| MYSQL_USER | root | MySQL用户名 |
| MYSQL_PASSWORD | | MySQL密码 |
| MYSQL_DATABASE | | 数据库名 |
| ALLOW_DDL | false | 是否允许DDL操作（CREATE、ALTER、TRUNCATE、RENAME、COMMENT）。设置为'true'启用 |
| ALLOW_DROP | false | 是否允许DROP操作。设置为'true'启用 |
| ALLOW_DELETE | false | 是否允许DELETE操作。设置为'true'启用 |
| MCP_LOG_DIR | ./logs | 日志目录 |
| MCP_LOG_FILE | mcp-mysql.log | 日志文件名 |
| MCP_DDL_LOG_FILE | ddl.sql | DDL SQL 日志文件名 (v2.0.1+) |

## 开发

### 项目结构
```
mcpmysql/
├── src/
│   └── server-final.js    # 主服务器文件
├── start-server.js        # 托管启动脚本
├── package.json
└── README.md
```

### 测试
```bash
npm test
```

## 快速开始

### 1. 安装包
```bash
npm install -g @liangshanli/mcp-server-mysql
```

### 2. 配置环境变量
```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=your_password
export MYSQL_DATABASE=your_database
export ALLOW_DDL=false
export ALLOW_DROP=false
export ALLOW_DELETE=false
```

**权限控制示例：**
```bash
# 默认：禁用所有破坏性操作（安全模式）
export ALLOW_DDL=false
export ALLOW_DROP=false
export ALLOW_DELETE=false

# 允许DDL但禁用DROP和DELETE
export ALLOW_DDL=true
export ALLOW_DROP=false
export ALLOW_DELETE=false

# 允许所有操作但禁用DELETE
export ALLOW_DDL=true
export ALLOW_DROP=true
export ALLOW_DELETE=false

# 启用所有操作（谨慎使用）
export ALLOW_DDL=true
export ALLOW_DROP=true
export ALLOW_DELETE=true
```

### 3. 运行服务器
```bash
mcp-server-mysql
```

## 许可证

MIT 