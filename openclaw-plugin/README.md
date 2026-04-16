# @openclaw/wechat-filehelper

OpenClaw channel plugin for WeChat FileHelper (微信文件助手).

## Install

```bash
openclaw plugins install @openclaw/wechat-filehelper
```

## Configure

Edit `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "wechat-filehelper": {
      "enabled": true,
      "apiUrl": "http://localhost:23051"
    }
  }
}
```

## Prerequisites

Start the WeChat FileHelper API server and scan QR to login:

```bash
cd /path/to/wx-filehelper-api
python main.py
# Visit http://localhost:23051/webui to scan QR
```

## Config options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable channel |
| `apiUrl` | string | `http://localhost:23051` | WeChat API URL |
| `pollInterval` | integer | `2000` | Polling interval (ms) |
| `dmPolicy` | string | `"open"` | DM policy: `open` or `allowlist` |
| `allowFrom` | string[] | `[]` | Allowed sender IDs |

## File structure

```
openclaw-plugin/
├── package.json
├── openclaw.plugin.json
├── index.ts                # Plugin entry point
└── src/
    ├── accounts.ts         # Account resolution
    ├── channel.ts          # ChannelPlugin implementation
    ├── client.ts           # WeChat API client
    ├── monitor.ts          # Inbound message polling
    ├── outbound.ts         # Outbound message adapter
    └── types.ts            # Type definitions
```
