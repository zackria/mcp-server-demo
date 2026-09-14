# Cloud Run Deployment Guide

## Prerequisites

- `gcloud` CLI authenticated (run `gcloud auth login` if needed)
- GCP project: `zacklearning`
- MongoDB Atlas cluster access
- Service account with Cloud Run and Secret Manager permissions

## Step 1: Store MongoDB URI in Secret Manager

Replace `YOUR_MONGODB_URI` with your actual connection string:

```bash
gcloud secrets create MONGODB_URI --replication-policy="automatic" --project=zacklearning

# Add the secret (one-time, when creating)
printf '%s' "YOUR_MONGODB_URI" | gcloud secrets versions add MONGODB_URI --data-file=- --project=zacklearning
```

If the secret already exists, just add a new version:
```bash
printf '%s' "YOUR_MONGODB_URI" | gcloud secrets versions add MONGODB_URI --data-file=- --project=zacklearning
```

**⚠️ Security Warning**: Never commit the actual URI to git. Always use Secret Manager.

## Step 2: Deploy to Cloud Run

The Docker image is being built in Cloud Build. Once it completes, deploy with:

```bash
gcloud run deploy vendor-accreditation-mcp \
  --image=us-central1-docker.pkg.dev/zacklearning/vendor-accreditation/mcp-server:latest \
  --region=us-central1 \
  --platform=managed \
  --no-allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=5 \
  --set-secrets=MONGODB_URI=MONGODB_URI:latest \
  --set-env-vars=LOG_LEVEL=info \
  --project=zacklearning
```

This deployment:
- Uses the Docker image from Artifact Registry
- Runs on Cloud Run in `us-central1`
- Listens on port 8080
- Requires IAM `roles/run.invoker` to call (blocked from public)
- Pulls `MONGODB_URI` from Secret Manager
- Sets log level to `info`
- Scales from 0 to 5 instances

## Step 3: Get the Service URL

After deployment completes:

```bash
gcloud run services describe vendor-accreditation-mcp \
  --region=us-central1 \
  --project=zacklearning \
  --format='value(status.url)'
```

This returns your service URL, e.g.:
```
https://vendor-accreditation-mcp-abc123def.run.app
```

## Step 4: Test the Deployment

### Health Check
```bash
SERVICE_URL=$(gcloud run services describe vendor-accreditation-mcp \
  --region=us-central1 --project=zacklearning --format='value(status.url)')

curl -X GET "${SERVICE_URL}/healthz"
```

Expected response:
```json
{"status":"ok"}
```

### Call an MCP Tool
```bash
curl -X POST "${SERVICE_URL}/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
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

Note: The `Authorization` header uses an identity token (for IAM authentication). If you get a 401, ensure your account has `roles/run.invoker` on the service.

## View Logs

```bash
gcloud run services describe vendor-accreditation-mcp \
  --region=us-central1 --project=zacklearning

# Stream logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=vendor-accreditation-mcp" \
  --region=us-central1 \
  --limit=50 \
  --format=json \
  --project=zacklearning
```

## Next: Add Authentication

Before exposing this service to external callers or using `--allow-unauthenticated`, add bearer-token validation in `src/server.ts` at the marked `// TODO(auth)` location.

See the section "Follow-up: Authentication" in README.md for approaches.
