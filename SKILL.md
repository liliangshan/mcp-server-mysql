---
name: mcp-server-mysql
description: Use this skill when configuring or operating the mcp-server-mysql MCP server for MySQL access, including generating Claude Code, Cursor, or VS Code MCP configuration, choosing safe permission settings, validating connectivity, and explaining available MySQL MCP tools.
---

# MCP Server MySQL

Use this skill to help users configure and operate the `mcp-server-mysql` project as a MySQL MCP server.

The local project path is `/Users/lls/wwwroot/github/mcp-server-mysql`. Prefer the local entrypoint when generating configuration:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["/Users/lls/wwwroot/github/mcp-server-mysql/bin/cli.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_user",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database",
        "READONLY": "true",
        "ALLOW_DDL": "false",
        "ALLOW_DROP": "false",
        "ALLOW_DELETE": "false",
        "TOOL_PREFIX": "",
        "PROJECT_NAME": "MySQL"
      }
    }
  }
}
```

An npm-based alternative is:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["@liangshanli/mcp-server-mysql"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_user",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database",
        "READONLY": "true",
        "ALLOW_DDL": "false",
        "ALLOW_DROP": "false",
        "ALLOW_DELETE": "false"
      }
    }
  }
}
```

## Workflow

1. Ask for the database connection target and the intended permission boundary before generating a final configuration.
2. Do not invent or guess credentials. Use placeholders unless the user explicitly provides values.
3. Default to read-only access:
   - `READONLY=true`
   - `ALLOW_DDL=false`
   - `ALLOW_DROP=false`
   - `ALLOW_DELETE=false`
4. Only enable DDL, DROP, or DELETE when the user explicitly authorizes that capability.
5. Recommend a low-privilege database account scoped to the specific database whenever possible.
6. After configuration, ask the user to restart or refresh the MCP client so the server is reloaded.
7. Validate with read-only SQL first, such as `SELECT 1` or `SHOW TABLES`.

## Environment variables

Required connection variables:

- `MYSQL_HOST`: MySQL host, default `localhost`.
- `MYSQL_PORT`: MySQL port, default `3306`.
- `MYSQL_USER`: MySQL username.
- `MYSQL_PASSWORD`: MySQL password.
- `MYSQL_DATABASE`: Default database.

Permission variables:

- `READONLY`: When `true`, only `SELECT` and `SHOW` SQL are allowed.
- `ALLOW_DDL`: Allows `CREATE`, `ALTER`, `TRUNCATE`, `RENAME`, and `COMMENT` when `true`.
- `ALLOW_DROP`: Allows `DROP` when `true`.
- `ALLOW_DELETE`: Allows `DELETE` when `true`.

Optional variables:

- `TOOL_PREFIX`: Prefixes tool names and isolates log configuration for multiple instances.
- `PROJECT_NAME`: Custom project label in tool descriptions.
- `MCP_LOG_DIR`: Log directory.
- `MCP_LOG_FILE`: Operation log file name.
- `MCP_DDL_LOG_FILE`: DDL SQL log file name.

## Safety rules

- Treat SQL write operations as high impact.
- Confirm with the user before enabling or running DDL, DROP, DELETE, or other destructive SQL.
- Do not store real passwords in files unless the user explicitly asks for that exact file change.
- Prefer session-local environment variables or secret managers for credentials.
- If the user asks for production access, recommend read-only mode first and require explicit authorization for write permissions.

## Local verification

From `/Users/lls/wwwroot/github/mcp-server-mysql`, verify the server can start with safe defaults:

```bash
READONLY=true ALLOW_DDL=false ALLOW_DROP=false ALLOW_DELETE=false node bin/cli.js
```

For package-based verification, use:

```bash
READONLY=true ALLOW_DDL=false ALLOW_DROP=false ALLOW_DELETE=false npm start
```

If the MCP client exposes tools after reload, run a harmless query first:

```sql
SELECT 1;
```
