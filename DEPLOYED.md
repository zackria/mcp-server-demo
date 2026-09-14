# ✅ Vendor Accreditation MCP Server - DEPLOYED

**Deployment Date:** September 14, 2026  
**Project:** zacklearning  
**Region:** us-central1  
**Service:** vendor-accreditation-mcp

---

## 🎯 Your Live Service URL

```
https://vendor-accreditation-mcp-njd6yb2p2q-uc.a.run.app
```

**Status:** Live and Ready  
**Health Check:** https://vendor-accreditation-mcp-njd6yb2p2q-uc.a.run.app/healthz  
**MCP Endpoint:** https://vendor-accreditation-mcp-njd6yb2p2q-uc.a.run.app/mcp

---

## 🚀 Quick Start (2 Minutes)

### For Claude Code Users

```bash
# Step 1: Get your identity token
TOKEN=$(gcloud auth print-identity-token)

# Step 2: Open Claude Code Settings → MCP Servers → Add Server
# Fill in:
#   Name: vendor-accreditation-mcp
#   URL: https://vendor-accreditation-mcp-njd6yb2p2q-uc.a.run.app/mcp
#   Auth: BearerToken
#   Token: $TOKEN

# Step 3: In Claude Code, ask:
# @claude-code: List all vendors expiring in the next 30 days
```

### For GitHub Copilot Users

```bash
# Step 1: Get identity token (same as above)
TOKEN=$(gcloud auth print-identity-token)

# Step 2: Open VS Code Settings, search "MCP", edit JSON:
"anthropic.mcpServers": {
  "vendor-accreditation": {
    "url": "https://vendor-accreditation-mcp-njd6yb2p2q-uc.a.run.app/mcp",
    "type": "http",
    "auth": {
      "type": "bearer",
      "token": "$TOKEN"
    }
  }
}

# Step 3: In Copilot Chat (Cmd+Shift+I), ask:
# Search for vendors in Software category
```

---

## 📋 What's Deployed

### Cloud Resources
- ✅ **Cloud Run Service** — vendor-accreditation-mcp
- ✅ **Artifact Registry** — Docker image pushed
- ✅ **Secret Manager** — MONGODB_URI stored securely
- ✅ **IAM Permissions** — Cloud Run service account can access secrets

### Application
- ✅ **4 MCP Tools** — list_expiring_vendors, get_vendor, update_accreditation_status, search_vendors
- ✅ **MongoDB Backend** — Connected to Atlas cluster
- ✅ **Structured Logging** — JSON logs in Cloud Logging
- ✅ **Health Checks** — /healthz endpoint for startup probes
- ✅ **Stateless Design** — Scales to zero, no session affinity needed

### Security (Current State)
- ✅ Credentials in Secret Manager (never in code)
- ✅ Cloud Run IAM restricts access (requires roles/run.invoker)
- ✅ Input validation on all tools (zod)
- ⚠️ **Application-level auth:** NOT YET (marked as TODO for follow-up)

---

## 🔄 Token Lifecycle

Identity tokens expire in **1 hour**. When Claude Code or Copilot returns `401`:

```bash
# Regenerate token
gcloud auth print-identity-token

# Update your MCP client config with the new token
```

---

## 📊 Monitor Your Service

### View Logs
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=vendor-accreditation-mcp" \
  --limit=50 \
  --format=json \
  --project=zacklearning
```

### Check Service Status
```bash
gcloud run services describe vendor-accreditation-mcp \
  --region=us-central1 \
  --project=zacklearning
```

### Stream Live Logs
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=vendor-accreditation-mcp" \
  --follow \
  --format=json \
  --project=zacklearning
```

---

## 🔐 Security Checklist

- [ ] Rotate the MongoDB password (it's in this chat's history)
- [ ] Add application-level authentication (bearer token in app code)
- [ ] Grant appropriate IAM roles to team members (roles/run.invoker)
- [ ] Set up log retention policy in Cloud Logging
- [ ] Enable Cloud Run metrics in Cloud Monitoring
- [ ] Review and limit API quotas

---

## 🆘 Troubleshooting

### "401 Unauthorized"
Token expired. Regenerate: `gcloud auth print-identity-token`

### "503 Service Unavailable"
Cold start. Cloud Run is booting your service. Wait 10 seconds and retry.

### "504 Gateway Timeout"
Tool call took >60 seconds (Cloud Run timeout). Check Cloud Logs for what's slow.

### Tools Not Appearing
- Reload Claude Code / VS Code
- Verify token is still valid
- Check URL ends with `/mcp` (not just the service URL)

### MongoDB Connection Error
- Check service logs: `gcloud logging read ...`
- Verify MONGODB_URI secret exists: `gcloud secrets list`
- Ensure Cloud Run service account has secretmanager.secretAccessor role

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| **QUICK_START.md** | 5-minute setup guide |
| **TESTING_WITH_CLIENTS.md** | Detailed client integration |
| **DEPLOYMENT.md** | Cloud Run deployment steps |
| **README.md** | Full project documentation |
| **BUILD_SUMMARY.md** | Architecture & features |
| **DEPLOYED.md** | This file — post-deployment reference |

---

## 🎁 Next Steps (Optional)

1. **Add Team Members**
   - Grant them `roles/run.invoker` on the Cloud Run service
   - They can then use Claude Code/Copilot with the same MCP configuration

2. **Add Application-Level Auth**
   - See `// TODO(auth)` in `src/server.ts`
   - Implement bearer token validation
   - Update QUICK_START.md with auth setup

3. **Seed Production Data**
   - Run `npm run seed` with your production MongoDB (not from chat)
   - Modify `scripts/seed.ts` to match your vendor schema

4. **Set Up Monitoring**
   - Create alerts in Cloud Monitoring for service errors
   - Set up log sinks for long-term retention
   - Configure Cloud Run metrics dashboard

5. **Document Vendor API**
   - Add OpenAPI/GraphQL spec if external teams need to integrate
   - Document rate limits and quotas

---

## 💬 Using with Your Workflows

### Example 1: Vendor Renewal Process
```
User (in Claude Code): "Check which vendors expire in 60 days and 
  update SafeGuard Industries to Active with reason 'Annual renewal approved'"

Claude Code:
  1. Calls list_expiring_vendors(60)
  2. Shows results
  3. Calls update_accreditation_status() with your parameters
  4. Shows updated vendor record with new audit log entry
```

### Example 2: Vendor Search & Analysis
```
User (in GitHub Copilot): "Find all Software vendors and tell me 
  which ones are expiring"

Copilot:
  1. Calls search_vendors("Software")
  2. For each vendor, calls get_vendor()
  3. Analyzes and summarizes which are expiring soon
  4. Suggests sending renewal reminders
```

### Example 3: Compliance Audit
```
User (in Claude Code): "Show me the full audit history for all 
  suspended vendors in the last 30 days"

Claude Code:
  1. Calls search_vendors() with status=Suspended
  2. Calls get_vendor() for each result
  3. Claude filters and summarizes audit logs
  4. Generates compliance report
```

---

## 📞 Support

### Common Issues

**Q: How do I update the MongoDB password?**
```bash
# Create new version of secret
printf '%s' "NEW_URI" | gcloud secrets versions add MONGODB_URI --data-file=-

# Cloud Run automatically picks up the latest version on next deployment
```

**Q: Can I connect multiple users?**
Yes! Each user gets their own identity token via `gcloud auth print-identity-token`. Configure the same MCP settings with their individual tokens.

**Q: What if I want to restrict access?**
- Leave `--no-allow-unauthenticated` (current setting)
- Only users with `roles/run.invoker` can call it
- Add their email: 
  ```bash
  gcloud run services add-iam-policy-binding vendor-accreditation-mcp \
    --member=user:their-email@example.com \
    --role=roles/run.invoker \
    --region=us-central1 --project=zacklearning
  ```

**Q: How do I rollback to a previous version?**
```bash
# List revisions
gcloud run revisions list --service=vendor-accreditation-mcp --region=us-central1 --project=zacklearning

# Route traffic back to a previous revision
gcloud run services update vendor-accreditation-mcp \
  --to-revisions=REVISION_NAME=100 \
  --region=us-central1 --project=zacklearning
```

---

## 🎉 You're Live!

Your MCP server is production-ready and serving requests. Start using it with Claude Code and GitHub Copilot today. 

For questions or issues, check:
- Cloud Run logs: `gcloud logging read ...`
- Cloud Run service status: `gcloud run services describe ...`
- These documentation files

Happy coding! 🚀
