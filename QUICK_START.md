# Quick Start: Using Your MCP Server

## 🚀 Your Service is Deploying

Your vendor-accreditation MCP server is being deployed to Google Cloud Run.

### Get Your Service URL

Once deployment completes, run:
```bash
gcloud run services describe vendor-accreditation-mcp \
  --region=us-central1 \
  --project=zacklearning \
  --format='value(status.url)'
```

You'll get something like:
```
https://vendor-accreditation-mcp-abc123def.run.app
```

---

## 🧪 Test Endpoints

### Health Check (No Auth Required)
```bash
curl https://vendor-accreditation-mcp-abc123def.run.app/healthz
```
Response: `{"status":"ok"}`

### Call MCP Tools (Requires Auth)
```bash
# Get identity token
TOKEN=$(gcloud auth print-identity-token)

# Call list_expiring_vendors
curl -X POST https://vendor-accreditation-mcp-abc123def.run.app/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_expiring_vendors",
      "arguments": { "daysAhead": 30 }
    }
  }'
```

---

## 💬 Connect to Claude Code

**✅ Service is now public! No authentication needed.**

### Step 1: Open Claude Code Settings
- Go to **Settings → MCP Servers** or use `/mcp` command
- Click **Add Server**

### Step 2: Configure the Server
- Choose **HTTP** transport
- Fill in:
  - **Name**: `vendor-accreditation-mcp`
  - **URL**: `https://vendor-accreditation-mcp-650044220515.us-central1.run.app/mcp`
  - **Headers**: Leave empty
  - **Authentication**: None (service is public)

### Step 3: Test
In Claude Code, ask:
```
@claude-code: List all vendors expiring in the next 30 days
```

Claude will automatically call your MCP tool and show the results!

---

## 💡 Connect to GitHub Copilot

### Step 1: Get Identity Token (same as above)

### Step 2: Configure in VS Code
In VS Code Settings, search for "MCP" and add:
```json
"anthropic.mcpServers": {
  "vendor-accreditation": {
    "url": "https://vendor-accreditation-mcp-abc123def.run.app/mcp",
    "type": "http",
    "auth": {
      "type": "bearer",
      "token": "YOUR_IDENTITY_TOKEN"
    }
  }
}
```

### Step 3: Test in Copilot Chat
Press `Cmd+Shift+I` (or `Ctrl+Shift+I`), then ask:
```
Show me all vendors expiring in the next 60 days
```

GitHub Copilot will use your MCP tool!

---

## 📋 Available Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `list_expiring_vendors` | Find vendors expiring in N days | `daysAhead: 30` |
| `get_vendor` | Fetch full vendor record + audit history | `vendorId: "123"` |
| `update_accreditation_status` | Update vendor status with audit log | `status: "Active"`, `reason: "..."` |
| `search_vendors` | Search vendor name/category | `query: "Software"` |

---

## 🔑 Managing Credentials

### Identity Token (For MCP Clients)
Expires every ~1 hour. Get a fresh one:
```bash
gcloud auth print-identity-token
```

### MongoDB URI (In Secret Manager)
Stored securely, never leaves production. To rotate:
```bash
# Update the secret
printf '%s' "NEW_MONGODB_URI" | gcloud secrets versions add MONGODB_URI --data-file=-

# Restart the service
gcloud run deploy vendor-accreditation-mcp \
  --region=us-central1 \
  --project=zacklearning \
  --no-gen2 \
  --update-secrets=MONGODB_URI=MONGODB_URI:latest
```

---

## 📊 Monitor Logs

See what your MCP server is doing:
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=vendor-accreditation-mcp" \
  --limit=50 \
  --format=json \
  --project=zacklearning
```

Example log entry:
```json
{
  "textPayload": {
    "event": "list_expiring_vendors",
    "daysAhead": 30,
    "resultCount": 2,
    "durationMs": 42
  },
  "severity": "INFO"
}
```

---

## ⚠️ Important Notes

### Security
- ✅ MONGODB_URI is in Secret Manager (never in code/git)
- ✅ Cloud Run IAM restricts access (only those with `roles/run.invoker`)
- ⚠️ **Not yet**: Application-level auth. Add bearer-token validation before broad exposure.

### Cold Starts
Cloud Run scales to zero. First request may take 5-10 seconds while the service starts.

### Token Expiry
Identity tokens expire in ~1 hour. If Claude Code/Copilot returns 401, regenerate:
```bash
gcloud auth print-identity-token
```
Then update your MCP client configuration.

---

## 🆘 Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Token expired or invalid | `gcloud auth print-identity-token` → update config |
| `403 Forbidden` | Missing IAM role | Ask your GCP admin for `roles/run.invoker` |
| `503 Service Unavailable` | Service cold-starting | Wait 10 seconds, retry |
| `504 Gateway Timeout` | Request took too long | Check Cloud Run logs |
| `Tools not appearing` | MCP connection issue | Reload Claude Code / VS Code |

---

## 📚 Full Documentation

- **DEPLOYMENT.md** — Detailed deployment steps
- **TESTING_WITH_CLIENTS.md** — Complete setup for Claude Code & GitHub Copilot
- **README.md** — Full project documentation
- **BUILD_SUMMARY.md** — Architecture & feature overview

---

## 🎉 You're All Set!

Your MCP server is live. Start using it with Claude Code or GitHub Copilot today!
