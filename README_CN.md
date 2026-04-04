# tool-opencode-kiro-auth

[English](./README.md)

一个 [OpenCode](https://opencode.ai) 插件，通过 [Kiro](https://kiro.dev)（AWS CodeWhisperer）的 Google 账户认证，在 OpenCode 中使用 Claude、Nova、GPT、Qwen、MiniMax、Kimi 等模型。

## 这是什么

这个插件让你可以在 OpenCode 里使用 Kiro 提供的 AI 模型（Claude Sonnet/Opus/Haiku、Nova SWE、GPT OSS 120B、Qwen3 Coder、MiniMax M2、Kimi K2 等），只需要 Google 账户登录，不需要 AWS Builder ID。

**核心功能：**

- **Google 账户登录** — 通过 Kiro 的 Google OAuth 认证，无需 AWS 凭证
- **自动复用 Token** — 自动读取 Kiro IDE 本地数据库中的已有会话，如果你已经在用 Kiro IDE，无需重新登录
- **多账户管理** — 支持多账户自动健康检查、故障切换和轮换（sticky / round-robin / lowest-usage 三种策略）
- **自动刷新 Token** — Token 过期前自动刷新，无需手动操作
- **请求格式转换** — 将 OpenAI 格式请求自动转换为 AWS CodeWhisperer API 格式，支持工具调用、图片和思维模式

## 支持的模型

| 模型 ID | 说明 |
|---|---|
| `claude-sonnet-4-6` | Claude Sonnet 4.6 |
| `claude-sonnet-4-6-thinking` | Claude Sonnet 4.6（思维模式） |
| `claude-sonnet-4-6-1m` | Claude Sonnet 4.6（100万上下文） |
| `claude-opus-4-6` | Claude Opus 4.6 |
| `claude-opus-4-6-thinking` | Claude Opus 4.6（思维模式） |
| `claude-opus-4-6-1m` | Claude Opus 4.6（100万上下文） |
| `claude-sonnet-4-5` | Claude Sonnet 4.5 |
| `claude-opus-4-5` | Claude Opus 4.5 |
| `claude-sonnet-4` | Claude Sonnet 4 |
| `claude-haiku-4-5` | Claude Haiku 4.5 |
| `nova-swe` | Amazon Nova SWE |
| `gpt-oss-120b` | GPT OSS 120B |
| `qwen3-coder-480b` | Qwen3 Coder 480B |
| `minimax-m2` | MiniMax M2 |
| `kimi-k2-thinking` | Kimi K2 Thinking |

## 安装步骤

### 1. 克隆并构建

```bash
git clone https://github.com/jixuan1989/tool-opencode-kiro-auth.git
cd tool-opencode-kiro-auth
bun install
bun run build
```

### 2. 配置 OpenCode

编辑 `~/.config/opencode/opencode.json`：

```jsonc
{
  "plugin": [
    "/你的绝对路径/tool-opencode-kiro-auth"
  ],
  "provider": {
    "kiro": {
      "models": {
        "claude-sonnet-4-6": {
          "name": "Claude Sonnet 4.6",
          "limit": { "context": 200000, "output": 64000 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] }
        },
        "claude-opus-4-6": {
          "name": "Claude Opus 4.6",
          "limit": { "context": 200000, "output": 64000 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] }
        }
        // ... 按需从上面的模型表中添加更多模型
      }
    }
  }
}
```

### 3. 登录

```bash
opencode auth login
# 选择 "kiro" -> "Google Account (Kiro)"
```

如果你已经在 Kiro IDE 中登录过 Google 账户，插件会自动复用该 Token，无需打开浏览器。

### 4. 使用

启动 OpenCode，选择任意 `kiro/*` 模型（如 `kiro/claude-sonnet-4-6`）即可。

## 工作原理

```
OpenCode 发起请求
  -> 插件拦截请求
  -> 从账户池中选择健康账户
  -> 检查 Token 有效性，过期则自动刷新
  -> 将 OpenAI 格式转换为 CodeWhisperer API 格式
  -> POST q.{region}.amazonaws.com/generateAssistantResponse
  -> 将流式响应转换回 OpenAI 格式
  -> 返回给 OpenCode
```

### 认证流程

1. 执行 `opencode auth login` 时，插件首先检查 `~/Library/Application Support/kiro-cli/data.sqlite3` 中是否有已登录的 Google 会话
2. 如果找到，直接复用 Token（无需打开浏览器）
3. 如果没有，则发起设备码 OAuth 流程，通过 `https://prod.{region}.auth.desktop.kiro.dev` 完成认证
4. Token 存储在 `~/.config/opencode/kiro.db` 中，过期前自动刷新

### 账户管理

- 账户信息存储在本地 SQLite 数据库中，带有健康状态追踪
- 失败的账户会自动标记为不健康并切换到其他账户
- 三种轮换策略：`sticky`（粘性，默认）、`round-robin`（轮询）、`lowest-usage`（最低使用量优先）

## 可选配置

创建 `~/.config/opencode/kiro-config.json`：

```json
{
  "default_region": "us-east-1",
  "auto_sync_kiro_cli": true,
  "account_selection_strategy": "sticky"
}
```

## 许可

基于 [@zhafron/opencode-kiro-auth](https://github.com/zhafron/opencode-kiro-auth) 修改，增加了 Google 账户认证支持。
