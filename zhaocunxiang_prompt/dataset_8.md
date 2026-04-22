```markdown
## Supabase MCP 连接：让 AI 直接操作你的数据库

> 把我当傻子，先问清楚我用的是什么 AI 工具，再一步步教我连接 Supabase MCP。连接成功后，带我创建第一个 todos 表并插入一条测试数据。

---

### 第零阶段：确认你的 AI IDE 工具

**请先告诉我，你正在使用哪个 AI 编程工具？**

| 工具 | 配置文件位置 |
|------|-------------|
| Cursor | `.cursor/mcp.json`（项目级）或全局设置 |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）<br>`%APPDATA%\Claude\claude_desktop_config.json`（Windows） |
| VS Code + Cline | `.vscode/mcp.json` 或 Cline 插件设置 |
| Claude Code (CLI) | `~/.claude/settings.json` 或项目 `.mcp.json` |

（⚠️ 告诉我你的工具后，我会给你对应的配置方法）

---

### 第一阶段：获取 Supabase 连接凭证

#### 1.1 获取数据库连接字符串
- 进入 Supabase Dashboard → Project Settings → Database
- 找到 "Connection string" 区域
- 选择 "URI" 格式，复制完整连接字符串
- 格式如：`postgresql://postgres.[项目ID]:[密码]@aws-0-[区域].pooler.supabase.com:6543/postgres`

#### 1.2 获取 Service Role Key（可选，用于绕过 RLS）
- 进入 Project Settings → API
- 复制 `service_role` key（⚠️ 此 key 拥有完全权限，切勿泄露）

---

### 第二阶段：配置 Supabase MCP（按工具分）

#### 方案 A：Cursor

在项目根目录创建 `.cursor/mcp.json`：
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--supabase-url",
        "https://你的项目ID.supabase.co",
        "--supabase-key",
        "你的service_role_key"
      ]
    }
  }
}
```

或使用 Postgres 直连方式：
```json
{
  "mcpServers": {
    "supabase-postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://postgres.[项目ID]:[密码]@aws-0-[区域].pooler.supabase.com:6543/postgres"
      ]
    }
  }
}
```

配置后：重启 Cursor 或 `Cmd+Shift+P` → "Reload Window"

---

#### 方案 B：Windsurf

编辑 `~/.codeium/windsurf/mcp_config.json`：
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--supabase-url",
        "https://你的项目ID.supabase.co",
        "--supabase-key",
        "你的service_role_key"
      ]
    }
  }
}
```

配置后：完全关闭 Windsurf 再重新打开

---

#### 方案 C：Claude Desktop

编辑配置文件：
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--supabase-url",
        "https://你的项目ID.supabase.co",
        "--supabase-key",
        "你的service_role_key"
      ]
    }
  }
}
```

配置后：完全退出 Claude Desktop（托盘图标也要关），重新启动

---

#### 方案 D：Claude Code (CLI)

在项目根目录创建 `.mcp.json`：
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--supabase-url",
        "https://你的项目ID.supabase.co",
        "--supabase-key",
        "你的service_role_key"
      ]
    }
  }
}
```

或添加到全局 `~/.claude/settings.json`

---

### 第三阶段：验证 MCP 连接

#### 3.1 检查连接状态
在 AI 对话中输入：
```
列出我 Supabase 数据库中的所有表
```

#### 3.2 预期结果
- ✅ 成功：AI 返回表列表（可能为空）
- ❌ 失败："无法连接"或"MCP 服务器未找到"

#### 3.3 常见连接问题

| 症状 | 解决方案 |
|------|----------|
| "command not found" | 确保已安装 Node.js 18+，运行 `node -v` 检查 |
| "Invalid API key" | 确认使用的是 `service_role` key，不是 `anon` key |
| MCP 图标不显示 | 重启 IDE，检查 JSON 格式是否正确（可用 jsonlint.com 验证） |
| 连接超时 | 检查网络，确认 Supabase 项目未暂停 |

---

### 第四阶段：创建第一个 todos 表

#### 4.1 让 AI 帮你创建表
对 AI 说：
```
在我的 Supabase 数据库中创建一个 todos 表，包含以下字段：
- id: uuid 主键，自动生成
- user_id: uuid，关联 auth.users
- title: 文本，不能为空
- completed: 布尔值，默认 false
- created_at: 时间戳，自动生成

同时启用 RLS，添加策略：用户只能看到和操作自己的 todos
```

#### 4.2 或手动执行 SQL
进入 Supabase Dashboard → SQL Editor，运行：
```sql
-- 创建 todos 表
create table public.todos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  completed boolean default false,
  created_at timestamptz default now()
);

-- 启用 RLS
alter table public.todos enable row level security;

-- 用户只能查看自己的 todos
create policy "用户查看自己的 todos"
  on public.todos for select
  using (auth.uid() = user_id);

-- 用户只能插入自己的 todos
create policy "用户插入自己的 todos"
  on public.todos for insert
  with check (auth.uid() = user_id);

-- 用户只能更新自己的 todos
create policy "用户更新自己的 todos"
  on public.todos for update
  using (auth.uid() = user_id);

-- 用户只能删除自己的 todos
create policy "用户删除自己的 todos"
  on public.todos for delete
  using (auth.uid() = user_id);
```

---

### 第五阶段：添加第一条 Todo

#### 5.1 通过 MCP 让 AI 插入测试数据
```
在 todos 表中插入一条测试数据：
- title: "学会使用 Supabase MCP"
- completed: false
- user_id: 暂时留空或使用一个测试 UUID
```

#### 5.2 或手动插入（绕过 RLS 测试用）
```sql
insert into public.todos (title, completed)
values ('学会使用 Supabase MCP', false);
```

（⚠️ 如果 RLS 已启用且 user_id 为空，需要临时禁用 RLS 或使用 service_role）

#### 5.3 验证数据
对 AI 说：
```
查询 todos 表中的所有数据
```

预期返回：
```json
[
  {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "title": "学会使用 Supabase MCP",
    "completed": false,
    "created_at": "2025-01-02T..."
  }
]
```

---

### 第六阶段：前端连接 todos 表

创建 `src/lib/todos.js`：
```javascript
import { supabase } from './supabase'

// 获取当前用户的所有 todos
export const getTodos = async () => {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

// 添加 todo
export const addTodo = async (title) => {
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('todos')
    .insert({ title, user_id: user.id })
    .select()
    .single()
  
  if (error) throw error
  return data
}

// 切换完成状态
export const toggleTodo = async (id, completed) => {
  const { error } = await supabase
    .from('todos')
    .update({ completed })
    .eq('id', id)
  
  if (error) throw error
}

// 删除 todo
export const deleteTodo = async (id) => {
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
```

---

### 检查清单

| 步骤 | 验证方式 |
|------|----------|
| MCP 配置文件创建 | 文件存在且 JSON 格式正确 |
| IDE 重启 | MCP 图标/状态显示已连接 |
| AI 能列出表 | 问 "列出所有表" 有响应 |
| todos 表创建 | Dashboard → Table Editor 可见 |
| RLS 策略生效 | Dashboard → Authentication → Policies 显示 4 条 |
| 测试数据插入 | 查询返回刚插入的记录 |

---

### GEB 分形文档检查

完成 MCP 配置后，**必须执行**以下文档同步：

```
L3 检查 → 新创建的文件（todos.js 等数据库操作文件）头部是否添加 [INPUT]/[OUTPUT]/[POS] 注释？
L2 检查 → lib/CLAUDE.md 是否记录新增的数据库操作模块？
L1 检查 → 项目根目录 CLAUDE.md 是否更新 MCP 配置说明和数据库表结构？
```

确保代码与文档同构，完成后等待下一步指令。
