# appdex-mcp

MCP server for **iOS App Store revenue & download estimates** — ask any app's numbers straight from
Claude Desktop, Cursor, or any MCP-capable agent.

Every figure ships with a **confidence label** (`verified` · `calibrated` · `modeled`) instead of a
fake-precise single number, so an agent can tell the difference between a measured fact and an estimate.

```
> How much does Duolingo make?

  app:                Duolingo: Language Lessons
  category:           Education
  monthly_revenue:    $48.0M – $48.0M
  monthly_downloads:  5.0M – 5.0M
  confidence:         calibrated
  report_url:         https://app-dex.com/a/duolingo-language-lessons-570060128
```

## Install

**1. Get a free API key** → <https://app-dex.com/account> (50 requests/day, no card).

**2. Add the server to your MCP host.**

<details open>
<summary><b>Claude Desktop</b> — <code>claude_desktop_config.json</code></summary>

```json
{
  "mcpServers": {
    "appdex": {
      "command": "npx",
      "args": ["-y", "appdex-mcp"],
      "env": { "APPDEX_API_KEY": "adx_your_key_here" }
    }
  }
}
```
</details>

<details>
<summary><b>Cursor</b> — <code>.cursor/mcp.json</code></summary>

```json
{
  "mcpServers": {
    "appdex": {
      "command": "npx",
      "args": ["-y", "appdex-mcp"],
      "env": { "APPDEX_API_KEY": "adx_your_key_here" }
    }
  }
}
```
</details>

**3. Restart the host.** Ask: *“What does Calm earn per month on iOS?”*

## Tools

| Tool | What it does |
|---|---|
| `estimate_app` | Monthly revenue + downloads for one iOS app, with a confidence label. Accepts an app name or a numeric App Store id. |
| `search_apps` | Resolves a name to App Store ids (no figures) — use it to feed `estimate_app`. |

## Tiers

| | Free | Paid |
|---|---|---|
| Requests / day | 50 | 5,000 |
| Revenue & downloads | ranges | ranges **+ point estimates** |
| Confidence label | ✅ | ✅ |
| US chart rank, revenue-per-install | — | ✅ |

Upgrade at <https://app-dex.com/pricing>. The same key works for both tiers.

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `APPDEX_API_KEY` | — | **Required.** From <https://app-dex.com/account> |
| `APPDEX_API_URL` | `https://app-dex.com` | Override only for self-hosted/staging |

`APPINTEL_API_KEY` / `APPINTEL_API_URL` are still read as fallbacks for older setups.

## What the confidence labels mean

- **verified** — reported figure from a real data layer, not modeled.
- **calibrated** — modeled, but calibrated against verified panel data for that revenue class.
- **modeled** — limited public signal; treat as directional, read the range not the midpoint.

## Notes & limits

- iOS App Store only. Figures are **gross** (before store commission) unless stated otherwise.
- Estimates are recomputed nightly.
- Single-app lookups by design — there is no bulk export endpoint.
- Rate limits are per key, per day (Europe/Istanbul day boundary). The tools report your remaining quota.

## Links

- Product & live docs: <https://app-dex.com/welcome#api>
- Methodology: <https://app-dex.com/methodology>
- Machine-readable summary for agents: <https://app-dex.com/llms.txt>

MIT © Appdex
