# Testing the MCP Server with GitHub Copilot and Claude Code

This guide shows how to connect your deployed MCP server to GitHub Copilot and Claude Code for testing.

---

## Testing with Claude Code

Claude Code has built-in MCP client support. Once your server is deployed to Cloud Run, you can connect to it immediately.

### Step 1: Get Your Service URL

```bash
gcloud run services describe vendor-accreditation-mcp \
  --region=us-central1 --project=zacklearning \
  --format='value(status.url)'
```

Example: `https://vendor-accreditation-mcp-abc123.run.app`

### Step 2: Configure Claude Code MCP Client

In Claude Code, use the **MCP** command or sidebar to add an MCP server:

1. Open Claude Code
2. Go to **Settings → MCP Servers** (or use the `/mcp` command)
3. Click **Add Server**
4. Choose **HTTP** (or **Streamable HTTP**) transport
5. Enter your server details:
   - **Name**: `vendor-accreditation-mcp`
   - **URL**: `https://vendor-accreditation-mcp-abc123.run.app/mcp`
   - **Authentication**: 
     - Type: `BearerToken`
     - Token: Run this in your terminal to get a token:
       ```bash
       gcloud auth print-identity-token
       ```
       (Copy the output and paste it as the bearer token)

### Step 3: Test the Tools in Claude Code

Once connected, Claude will see all four tools:

```
Available Tools:
✓ list_expiring_vendors
✓ get_vendor
✓ update_accreditation_status
✓ search_vendors
```

**Try calling a tool:**

```
@claude-code list_expiring_vendors with daysAhead=30
```

Or use Claude's natural language:

> "Show me all vendors whose accreditation expires in the next 60 days"

Claude will automatically call `list_expiring_vendors` with `daysAhead: 60` and display the results.

### Step 4: Example Conversations with Claude Code

#### Example 1: Find Expiring Vendors
```
User: Which vendors are expiring in the next 30 days?
Claude Code: [calls list_expiring_vendors]
→ Returns JSON with vendor name, expiry date, contact email
```

#### Example 2: Update Vendor Status with Context
```
User: I need to suspend SafeGuard Industries due to compliance violations
Claude Code: [calls update_accreditation_status with:
  vendorId: <looked up from search_vendors>
  status: "Suspended"
  reason: "Compliance violations"
]
→ Returns updated vendor record with audit log entry
```

#### Example 3: Search and Analyze
```
User: Find all "Software" vendors and tell me their status
Claude Code: [calls search_vendors with query="Software"]
→ Returns matching vendors
→ Claude analyzes and summarizes their accreditation statuses
```

### Troubleshooting Claude Code Connection

| Issue | Solution |
|-------|----------|
| `401 Unauthorized` | Token expired. Re-run `gcloud auth print-identity-token` and update the MCP config. |
| `503 Service Unavailable` | Your Cloud Run service is cold-starting. Wait 10 seconds and retry. |
| `404 Not Found` | Check the service URL is correct and `/mcp` endpoint exists. |
| `Tools not appearing` | Refresh the MCP connection in Claude Code settings. |

---

## Testing with GitHub Copilot

GitHub Copilot has MCP support in VS Code (via the official VS Code extension) and Copilot Chat.

### Step 1: Install GitHub Copilot Extension

In VS Code:
1. Open Extensions (`Cmd+Shift+X`)
2. Search for "GitHub Copilot"
3. Install the official **GitHub Copilot** and **GitHub Copilot Chat** extensions

### Step 2: Configure MCP in VS Code

GitHub Copilot reads MCP server configurations from a `~/.anthropic/mcp.json` file (on macOS/Linux) or a JSON config in VS Code settings.

**Option A: Edit ~/.anthropic/mcp.json**

Create or edit `~/.anthropic/mcp.json`:

```json
{
  "mcpServers": {
    "vendor-accreditation": {
      "command": "custom",
      "url": "https://vendor-accreditation-mcp-abc123.run.app/mcp",
      "type": "http",
      "auth": {
        "type": "bearer",
        "token": "YOUR_IDENTITY_TOKEN_HERE"
      }
    }
  }
}
```

Replace `YOUR_IDENTITY_TOKEN_HERE` with output of:
```bash
gcloud auth print-identity-token
```

**Option B: VS Code Settings (Recommended)**

In VS Code, open Settings (`Cmd+,`) and search for "MCP":

1. Find **Anthropic: MCP Servers** setting
2. Click **Edit in settings.json**
3. Add:

```json
"anthropic.mcpServers": {
  "vendor-accreditation": {
    "url": "https://vendor-accreditation-mcp-abc123.run.app/mcp",
    "type": "http",
    "auth": {
      "type": "bearer",
      "token": "YOUR_IDENTITY_TOKEN_HERE"
    }
  }
}
```

### Step 3: Test in Copilot Chat

1. Open **Copilot Chat** in VS Code (`Cmd+Shift+I`)
2. Type a natural language request:

```
@github-copilot List all vendors expiring in the next 60 days
```

or

```
@github-copilot Search for vendors in the "Software & IT Services" category
```

Copilot will automatically invoke the appropriate MCP tool and show you the results.

### Step 4: Use MCP Tools in Code Suggestions

Copilot Chat can also suggest using your MCP tools when relevant:

- **In a procurement system codebase**: "How many vendors are expiring soon?" → Copilot offers to call `list_expiring_vendors`
- **While fixing audit logic**: "What's the audit history for vendor X?" → Copilot offers to call `get_vendor`

### Troubleshooting GitHub Copilot Connection

| Issue | Solution |
|-------|----------|
| `401 Unauthorized` | Token expired. Regenerate with `gcloud auth print-identity-token` and update config. |
| `Tools not showing up` | Reload VS Code window (`Cmd+Shift+P` → "Developer: Reload Window"). |
| `CORS errors` | Ensure your Cloud Run service allows cross-origin requests (it should by default). |
| `"MCP server offline"` | Check that the service URL is reachable. Test with `curl https://...run.app/healthz`. |

---

## Testing Without Authentication (Local Dev Only)

For **local development only**, you can test without IAM authentication:

1. Run the server locally: `npm run dev`
2. In Claude Code or GitHub Copilot, use URL: `http://localhost:8080/mcp`
3. Set auth to **None** or remove the auth section

**Never** run production Cloud Run with `--allow-unauthenticated` without adding application-level auth first.

---

## End-to-End Test Scenario

Here's a complete workflow you can try:

### Scenario: Vendor Accreditation Review

1. **List upcoming expirations**
   ```
   @claude-code: Show me all vendors expiring in the next 90 days
   ```
   → Tool: `list_expiring_vendors(daysAhead: 90)`

2. **Get details on a vendor**
   ```
   @claude-code: Tell me the full details and audit history for vendor "TechCorp Solutions"
   ```
   → Tool: `search_vendors(query: "TechCorp")` + `get_vendor(vendorId: "...")`

3. **Update vendor status**
   ```
   @claude-code: Reaccredit "TechCorp Solutions" with reason "Annual renewal and compliance verification complete"
   ```
   → Tool: `update_accreditation_status(vendorId: "...", status: "Active", reason: "...")`

4. **Verify the change**
   ```
   @claude-code: Show me the updated vendor record with the new audit log entry
   ```
   → Tool: `get_vendor(vendorId: "...")` (shows new audit entry)

---

## Monitoring Tool Calls

Check your Cloud Run logs to see the actual MCP requests and responses:

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=vendor-accreditation-mcp" \
  --limit=100 \
  --format=json \
  --project=zacklearning
```

Each tool call logs:
- Event type (e.g., `list_expiring_vendors`)
- Request parameters (structured, no sensitive data)
- Response time (`durationMs`)
- Result count or error code

Example log entry:
```json
{
  "textPayload": {
    "event": "list_expiring_vendors",
    "daysAhead": 30,
    "resultCount": 2,
    "durationMs": 45
  },
  "severity": "INFO"
}
```

---

## Next Steps

1. ✓ Deploy to Cloud Run (in progress)
2. ✓ Get the service URL
3. Get an identity token: `gcloud auth print-identity-token`
4. Configure Claude Code or GitHub Copilot MCP connection
5. Test the four tools with real vendor data
6. Add application-level authentication before exposing to external teams
7. Monitor logs in Cloud Run Logs Explorer

Happy testing!
