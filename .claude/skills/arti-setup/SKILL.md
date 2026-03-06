---
name: arti-setup
description: Setup and validation guide for the NCI Research Optimizer (arti) local dev environment. Use when onboarding to this project, restarting the server, or validating the chat with agent-browser.
---

# ARTI Local Dev Setup & Chat Validation

## What This App Is

NCI Research Optimizer (`nci-webtools-ctri-arti`) — a Node.js monorepo AI chat platform backed by AWS Bedrock (Claude Sonnet 4.6 via cross-region inference profiles). No Docker required.

**Stack:**
- Node.js monorepo (npm workspaces): `shared`, `database`, `gateway`, `cms`, `agents`, `server`
- SolidJS buildless frontend (CDN import maps, no webpack/vite)
- PGlite embedded PostgreSQL (no external DB)
- AWS Bedrock via SSO profile `eagle`
- Local OIDC provider (`oidc-provider` package) — or bypass with API key

## Prerequisites

1. **AWS SSO login** (required for Bedrock):
   ```bash
   aws sso login --profile eagle
   ```

2. **Dependencies** (from repo root):
   ```bash
   npm install
   ```

3. **`server/.env`** must exist. Key values:
   ```
   AWS_PROFILE=eagle
   AWS_DEFAULT_REGION=us-east-1
   PORT=3000
   HOSTNAME=localhost
   NODE_TLS_REJECT_UNAUTHORIZED=0
   CLIENT_FOLDER=../client
   SESSION_SECRET=local-dev-session-secret-change-in-prod
   DB_STORAGE=../data
   OAUTH_PROVIDER_ENABLED=true
   OAUTH_CLIENT_ID=oauth-client-id
   OAUTH_CLIENT_SECRET=oauth-client-secret
   OAUTH_DISCOVERY_URL=http://localhost:3000/api/oauth/.well-known/openid-configuration
   OAUTH_CALLBACK_URL=http://localhost:3000/api/login
   S3_BUCKETS=rh-eagle-files
   TEST_API_KEY=test-integration-api-key
   DEFAULT_USAGE_LIMIT=100
   USAGE_RESET_SCHEDULE="0 0 * * 0"
   ```

4. **`server/polyfills.js`** must exist (patches missing DOM globals for pdfjs-dist on Node < 20.19).

## Starting the Server

```bash
# From repo root:
npm start -w server

# Or from server/ directory:
cd server && npm start
```

Server starts at **http://localhost:3000**

## Accessing the App

**Browser URL (API key bypass — no login required):**
```
http://localhost:3000/?apiKey=test-integration-api-key
```

This logs you in as the seeded test admin user. The OIDC browser login flow exists but requires HTTPS setup — the API key bypass is the recommended local dev path.

## Validating Chat with agent-browser

Prerequisite: `agent-browser` installed globally, `~/.agent-browser/config.json` set to `{"ignoreHttpsErrors": true}`.

On Windows without WSL, prefix all commands with `AGENT_BROWSER_NO_WSL=1`.

### Full validation flow:

```bash
# 1. Open app with API key bypass
AGENT_BROWSER_NO_WSL=1 agent-browser navigate "http://localhost:3000/?apiKey=test-integration-api-key"

# 2. Accept privacy notice
AGENT_BROWSER_NO_WSL=1 agent-browser snapshot   # find "I Accept" button ref
AGENT_BROWSER_NO_WSL=1 agent-browser click "@e17"  # adjust ref as needed

# 3. Navigate to chat
AGENT_BROWSER_NO_WSL=1 agent-browser navigate "http://localhost:3000/tools/chat"

# 4. Type the FAC 2025-06 validation question
AGENT_BROWSER_NO_WSL=1 agent-browser snapshot   # find chat input ref
AGENT_BROWSER_NO_WSL=1 agent-browser fill "@e12" "What are the simplified acquisition threshold and micro-purchase threshold under FAC 2025-06?"

# 5. Send
AGENT_BROWSER_NO_WSL=1 agent-browser snapshot   # find Send button ref
AGENT_BROWSER_NO_WSL=1 agent-browser click "@e20"

# 6. Wait for response (~30s) and screenshot
sleep 30 && AGENT_BROWSER_NO_WSL=1 agent-browser screenshot
```

### Expected correct answer:
- **Simplified Acquisition Threshold (SAT): $350,000**
- **Micro-Purchase Threshold (MPT): $15,000**

Source: `HHS_PMR_Threshold_Matrix.txt` in `rh-eagle-files` S3 bucket (also confirmed via acquisition.gov FAR 2.101).

## Key Architecture Notes

- **Models**: AWS Bedrock cross-region inference profiles (`us.` prefix). See `database/data/models.csv`.
- **S3 data tool**: `/api/v1/data?bucket=rh-eagle-files&key=<file>` — gated by `S3_BUCKETS` env var.
- **DB**: PGlite persisted at `../data` relative to `server/`. Auto-migrates on startup.
- **Test admin user**: seeded from `TEST_API_KEY` env var at startup.
- **Husky hooks**: disabled (placeholder only — `echo "husky hello world"`).

## Troubleshooting

| Problem | Fix |
|---|---|
| `DOMMatrix is not defined` | Ensure `polyfills.js` exists and `--import=./polyfills.js` is in start script |
| AWS credential errors | Run `aws sso login --profile eagle` |
| Port already in use | `netstat -ano \| grep ":3000"` then `taskkill //PID <pid> //F` |
| OIDC issuer mismatch | Use API key bypass instead of browser login |
