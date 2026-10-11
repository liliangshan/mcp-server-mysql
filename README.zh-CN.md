# MCP MySQL 服务器

一个支持DDL操作、权限控制和操作日志的MCP MySQL服务器。

## 版本历史

### v3.2.0 (最新版本)
- ✅ **只读保护加固**：检查完整 SQL，并使用只读事务阻止 SELECT 间接写入及危险语法。
- ✅ **可选 TLS**：`MYSQL_SSL=true` 启用证书和主机名校验，不再强制已有非 TLS 连接开启加密。
- ✅ **连接配置修复**：用有效的 `connectTimeout` 替换不支持的超时选项，初始化与重建连接池共享配置。
- ✅ **回归测试**：新增 SQL 权限、连接生命周期、TLS 配置及版本一致性测试。

### v3.1.1
- ✅ **Claude 技能支持**：新增 `SKILL.md`，用于 Claude 集成。

### v3.1.0
- ✅ **BIGINT 精度支持**：新增 `supportBigNumbers` 和 `bigNumberStrings` 选项，防止大整数（如 `order_id`、`user_id` > 2^53 - 1）精度丢失。大数值将以字符串形式返回，确保完整精度。

### v3.0.0
- ✅ **只读模式**：新增 `READONLY` 环境变量 - 启用后只允许执行 SELECT 和 SHOW 命令（最高优先级检查）
- ✅ **工具前缀支持**：新增 `TOOL_PREFIX` 环境变量，用于工具名称隔离和配置分离
- ✅ **项目品牌**：新增 `PROJECT_NAME` 环境变量，用于自定义工具描述
- ✅ **增强权限检查**：改进了 `check_permissions` 工具，包含详细消息和只读模式警告
- ✅ **默认日志路径**：将默认日志目录从 `./logs` 改为 `./.setting`（如果设置了前缀则为 `./.setting.<TOOL_PREFIX>`）
- ✅ **多实例支持**：完整支持运行多个 MySQL 服务器实例，配置相互隔离
- ✅ **改进 CLI**：更新 CLI 以支持所有新环境变量和日志路径配置

### v2.0.1
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
export MYSQL_SSL=false
export READONLY=false
export ALLOW_DDL=true
export ALLOW_DROP=false
export ALLOW_DELETE=false

# 可选：工具前缀，用于配置隔离
export TOOL_PREFIX="projA"

# 可选：项目品牌名称
export PROJECT_NAME="MyProject"
```

### SSL/TLS 连接

仅当 `MYSQL_SSL=true` 时启用 TLS。未设置或设置为 `false` 时保持非 TLS 连接。初始化和重建连接池使用相同配置；开启 TLS 后，握手或证书验证失败不会自动降级为明文连接。

TLS 会校验证书信任链及服务器主机名。`MYSQL_HOST` 请使用与证书匹配的数据库域名。私有 CA 或自签名 CA 场景，可在 MCP 进程环境中设置 `NODE_EXTRA_CA_CERTS=/absolute/path/to/ca.pem`，必须在 **Node.js 启动前**设置，并重启服务。CLI 和托管启动均会继承这些环境变量。不要通过关闭证书校验来绕过信任错误。

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

### 多 MySQL 服务器实例支持

您可以配置多个 MySQL 服务器实例，使用不同的 `TOOL_PREFIX` 和 `PROJECT_NAME` 来隔离工具和配置。这在需要同时连接到多个数据库时非常有用。

**示例：Cursor 编辑器配置**

创建 `.cursor/mcp.json` 文件：

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

**多实例的优势：**

- **工具隔离**：每个实例都有自己独立的工具名称（例如：`local_sql_query`、`online_sql_query`）
- **配置隔离**：日志和 DDL 文件存储在独立的目录中（例如：`./.setting.local/`、`./.setting.online/`）
- **不同权限**：为每个实例配置不同的权限级别（例如：生产环境只读，开发环境完全访问）
- **项目品牌**：每个实例可以有自己的项目名称，便于识别

**注意**：使用多个实例时，工具名称会带有 `TOOL_PREFIX` 前缀。例如：
- `local_sql_query` - 查询本地数据库
- `online_sql_query` - 查询在线数据库（只读）

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

## 只读模式的安全边界

`READONLY=true` 优先于所有 `ALLOW_*` 配置。只读请求只接受单条 `SELECT` 或 `SHOW`，并在同一连接的 `START TRANSACTION READ ONLY` 事务中执行；成功或失败后都会回滚。事务开启失败时不会执行用户 SQL，回滚失败的连接会被销毁而不是放回连接池。

- 全部模式显式禁用多语句，并在连接数据库前检查完整 SQL。允许末尾的一个分号，字符串和普通注释中的分号不会被当作语句分隔符。
- 拒绝 MySQL `/*! ... */` 和 MariaDB `/*M! ... */` 可执行注释；普通注释不影响语句类型判断，因此不能再通过前置注释绕过 DDL、DROP、DELETE 检查。
- 只读模式拒绝 `SELECT ... INTO OUTFILE/DUMPFILE`、`INTO @变量`、`:=` 赋值、`FOR UPDATE/SHARE`、`LOCK IN SHARE MODE` 和获取/释放命名锁的函数。
- 不同 `sql_mode` 对引号和反斜杠的解释不同；不能在所有支持的解释下安全校验的 SQL 会被保守拒绝。只读模式仍不接受 `WITH`、`EXPLAIN`、`CALL` 等其他起始命令。
- 单语句校验采用保守策略，不接受含内部分号的存储过程/函数定义等复合脚本；需要执行此类脚本时，请使用独立的受控迁移工具。

**应用层检查不能替代数据库权限。** 只读事务用于进一步阻止 SELECT 调用存储函数时修改普通表，但不是任意 UDF、外部副作用或临时表操作的完整沙箱。生产环境应使用专用的最小权限账号，只授予需要的查询和元数据读取权限，不授予写入、DDL、`FILE`、不必要的 `EXECUTE` 等权限，不要使用 `root` 作为只读账号。

修改后需重启实际使用的 MCP 服务。运行 `npx @liangshanli/mcp-server-mysql` 不会自动使用本地源码修改，需指向本地 `bin/cli.js` 或安装包含修复的版本。

## 连接池特性

- **自动创建**: 在`notifications/initialized`时自动创建连接池
- **健康检查**: 每5分钟检查连接池状态
- **自动重连**: 连接池失效时自动重新创建
- **连接复用**: 使用连接池提高性能
- **优雅关闭**: 服务器关闭时正确释放连接

## 日志

### 常规日志
日志文件位置：`./.setting/mcp-mysql.log` (如果设置了TOOL_PREFIX则为 `./.setting.<TOOL_PREFIX>/mcp-mysql.log`)

记录内容：
- 所有请求和响应
- SQL操作记录
- 错误信息
- 连接池状态变化

### DDL SQL 日志 (v2.0.1+)
DDL 日志文件位置：`./.setting/ddl.sql` (如果设置了TOOL_PREFIX则为 `./.setting.<TOOL_PREFIX>/ddl.sql`)

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
| MYSQL_SSL | false | 仅设置为'true'时启用 TLS，并校验证书和主机名；初始化与重建连接池均使用此设置 |
| NODE_EXTRA_CA_CERTS | | 可选，私有或自签名 CA 的 PEM 文件绝对路径；Node.js 在进程启动时读取 |
| READONLY | false | 如果设置为'true'，只允许执行SELECT和SHOW命令。此检查具有最高优先级，会覆盖所有其他权限设置 |
| ALLOW_DDL | false | 是否允许DDL操作（CREATE、ALTER、TRUNCATE、RENAME、COMMENT）。设置为'true'启用 |
| ALLOW_DROP | false | 是否允许DROP操作。设置为'true'启用 |
| ALLOW_DELETE | false | 是否允许DELETE操作。设置为'true'启用 |
| TOOL_PREFIX | | 可选工具前缀，用于工具名称和配置隔离。示例：`export TOOL_PREFIX="projA"` |
| PROJECT_NAME | | 可选项目品牌名称，用于工具描述 |
| MCP_LOG_DIR | ./.setting (如果设置了TOOL_PREFIX则为 ./.setting.<TOOL_PREFIX>) | 日志目录 |
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
export MYSQL_SSL=false
export READONLY=false
export ALLOW_DDL=false
export ALLOW_DROP=false
export ALLOW_DELETE=false

**权限控制示例：**
```bash
# 只读模式：只允许SELECT和SHOW命令（最高优先级）
export READONLY=true

# 默认：禁用所有破坏性操作（安全模式）
export READONLY=false
export ALLOW_DDL=false
export ALLOW_DROP=false
export ALLOW_DELETE=false

# 允许DDL但禁用DROP和DELETE
export READONLY=false
export ALLOW_DDL=true
export ALLOW_DROP=false
export ALLOW_DELETE=false

# 允许所有操作但禁用DELETE
export READONLY=false
export ALLOW_DDL=true
export ALLOW_DROP=true
export ALLOW_DELETE=false

# 启用所有操作（谨慎使用）
export READONLY=false
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