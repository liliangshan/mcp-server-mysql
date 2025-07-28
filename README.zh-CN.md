# MCP MySQL 服务器

一个支持DDL操作、权限控制和操作日志的MCP MySQL服务器。

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
        "ALLOW_DDL": "true"
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
        "ALLOW_DDL": "true"
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

## 连接池特性

- **自动创建**: 在`notifications/initialized`时自动创建连接池
- **健康检查**: 每5分钟检查连接池状态
- **自动重连**: 连接池失效时自动重新创建
- **连接复用**: 使用连接池提高性能
- **优雅关闭**: 服务器关闭时正确释放连接

## 日志

日志文件位置：`./logs/mcp-mysql.log`

记录内容：
- 所有请求和响应
- SQL操作记录
- 错误信息
- 连接池状态变化

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
| ALLOW_DDL | true | 是否允许DDL操作 |
| MCP_LOG_DIR | ./logs | 日志目录 |
| MCP_LOG_FILE | mcp-mysql.log | 日志文件名 |

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
export ALLOW_DDL=true
```

### 3. 运行服务器
```bash
mcp-server-mysql
```

## 许可证

MIT 