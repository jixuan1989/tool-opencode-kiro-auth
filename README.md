# tool-opencode-kiro-auth

An [OpenCode](https://opencode.ai) plugin that provides access to Claude, Nova, GPT, Qwen, MiniMax, and Kimi models through [Kiro](https://kiro.dev) (AWS CodeWhisperer) using Google Account authentication.

## What This Does

This plugin lets you use Kiro's AI models (Claude Sonnet/Opus/Haiku, Nova SWE, GPT OSS 120B, Qwen3 Coder, MiniMax M2, Kimi K2, etc.) inside OpenCode by authenticating with your Google account — no AWS Builder ID required.

**Key features:**

- **Google Account login** — authenticate via Kiro's Google OAuth, no AWS credentials needed
- **Automatic token reuse** — reads existing sessions from the Kiro CLI local database, so you don't need to re-login if you already use Kiro IDE
- **Multi-account management** — supports multiple accounts with automatic health checking, failover, and rotation (sticky / round-robin / lowest-usage strategies)
- **Automatic token refresh** — tokens are refreshed transparently before they expire
- **Request translation** — converts OpenAI-format requests to AWS CodeWhisperer API format, including tool calls, images, and thinking mode

## Supported Models

| Model ID | Description |
|---|---|
| `claude-sonnet-4-6` | Claude Sonnet 4.6 |
| `claude-sonnet-4-6-thinking` | Claude Sonnet 4.6 with thinking |
| `claude-sonnet-4-6-1m` | Claude Sonnet 4.6 (1M context) |
| `claude-opus-4-6` | Claude Opus 4.6 |
| `claude-opus-4-6-thinking` | Claude Opus 4.6 with thinking |
| `claude-opus-4-6-1m` | Claude Opus 4.6 (1M context) |
| `claude-sonnet-4-5` | Claude Sonnet 4.5 |
| `claude-opus-4-5` | Claude Opus 4.5 |
| `claude-sonnet-4` | Claude Sonnet 4 |
| `claude-haiku-4-5` | Claude Haiku 4.5 |
| `nova-swe` | Amazon Nova SWE |
| `gpt-oss-120b` | GPT OSS 120B |
| `qwen3-coder-480b` | Qwen3 Coder 480B |
| `minimax-m2` | MiniMax M2 |
| `kimi-k2-thinking` | Kimi K2 Thinking |

## Installation

### 1. Clone and build

```bash
git clone https://github.com/jixuan1989/tool-opencode-kiro-auth.git
cd tool-opencode-kiro-auth
bun install
bun run build
```

### 2. Configure OpenCode

Edit `~/.config/opencode/opencode.json`:

```jsonc
{
  "plugin": [
    "/absolute/path/to/tool-opencode-kiro-auth"
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
        // ... add more models from the table above as needed
      }
    }
  }
}
```

### 3. Login

```bash
opencode auth login
# Select "kiro" -> "Google Account (Kiro)"
```

If you already have an active Kiro IDE session, the plugin will automatically reuse that token — no browser login needed.

### 4. Use

Launch OpenCode and select any `kiro/*` model (e.g. `kiro/claude-sonnet-4-6`).

## How It Works

```
OpenCode -> Plugin intercepts request
  -> Select healthy account from pool
  -> Refresh token if expiring
  -> Convert OpenAI format -> CodeWhisperer API format
  -> POST q.{region}.amazonaws.com/generateAssistantResponse
  -> Convert streaming response -> OpenAI format
  -> Return to OpenCode
```

### Authentication flow

1. On `opencode auth login`, the plugin first checks `~/Library/Application Support/kiro-cli/data.sqlite3` for an existing Google session
2. If found, the token is reused directly (no browser needed)
3. If not found, a device-code OAuth flow is initiated via `https://prod.{region}.auth.desktop.kiro.dev`
4. Tokens are stored in `~/.config/opencode/kiro.db` and refreshed automatically

### Account management

- Accounts are stored in a local SQLite database with health tracking
- Failed accounts are automatically marked unhealthy and rotated out
- Three rotation strategies: `sticky` (default), `round-robin`, `lowest-usage`

## Configuration

Create `~/.config/opencode/kiro-config.json` (optional):

```json
{
  "default_region": "us-east-1",
  "auto_sync_kiro_cli": true,
  "account_selection_strategy": "sticky"
}
```

## License

Based on [@zhafron/opencode-kiro-auth](https://github.com/zhafron/opencode-kiro-auth). Modified to support Google Account authentication.
