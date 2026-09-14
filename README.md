# Vendor-Accreditation MCP Server

A TypeScript MCP (Model Context Protocol) server for a Procurement Agency's vendor-accreditation system, deployed as a stateless web service on Google Cloud Run with a MongoDB Atlas backend.

## Features

Exposes four tools for managing vendor accreditation data:

- **`list_expiring_vendors(daysAhead: number)`** — Returns vendors whose accreditation will expire within the next N days (only returns active vendors).
- **`get_vendor(vendorId: string)`** — Retrieves the full vendor record including accreditation status, expiry date, and audit history.
- **`update_accreditation_status(vendorId: string, status: 'Active' | 'Expired' | 'Suspended', reason: string)`** — Updates a vendor's status and records the change in an audit log. Requires an `accreditationExpiryDate` in the future if setting status to `'Active'`.
- **`search_vendors(query: string, category?: string)`** — Performs case-insensitive free-text search across vendor names and categories.

## Prerequisites

- **Node.js** 22+ (for native `mongodb` driver and ES2022 support)
- **MongoDB Atlas** cluster (or any MongoDB instance reachable over the network)
- **Google Cloud** project (for Cloud Run deployment)

## Local Development

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your MongoDB Atlas connection string:
   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/<database>?retryWrites=true&w=majority
   PORT=8080
   LOG_LEVEL=info
   ```

### Run the server

```bash
npm run dev
```

The server listens on `http://localhost:8080` and exposes:
- `/healthz` — Health check endpoint (returns `200 {status: 'ok'}` if MongoDB is reachable)
- `/mcp` — MCP HTTP transport endpoint (accepts POST requests with MCP JSON-RPC messages)

### Seed sample data

Before testing the tools, populate the database with sample vendors:

```bash
MONGODB_URI=mongodb+srv://<your-credentials>@<cluster>/<db> npm run seed
```

**Important:** Only run the seed script against a **test or development database** that you control. The script clears any existing `vendors` collection and replaces it with sample data.

### Test the tools

Use an MCP client (such as the Claude Code CLI with MCP support) to call the tools via `POST /mcp`.

Or, manually test with `curl`:

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
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

## Architecture

### Project Structure

```
src/
├── server.ts                  # Express app, MCP server setup, HTTP endpoints
├── db.ts                      # MongoDB connection, query helpers
├── logger.ts                  # Structured JSON logging (pino)
├── types.ts                   # TypeScript types and serialization
└── tools/
    ├── listExpiringVendors.ts
    ├── getVendor.ts
    ├── updateAccreditationStatus.ts
    └── searchVendors.ts

scripts/
└── seed.ts                    # Manual script to initialize sample data

Dockerfile                     # Multi-stage build for Cloud Run
```

### Data Model

The `vendors` collection stores vendor documents with embedded audit logs:

```typescript
{
  vendorId: string;              // Stable external ID (UUID)
  vendorName: string;
  category: string;
  contactEmail: string;
  accreditationStatus: 'Active' | 'Expired' | 'Suspended';
  accreditationExpiryDate: Date;
  auditLog: Array<{              // Embedded audit history
    timestamp: Date;
    previousStatus: string;
    newStatus: string;
    reason: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Indexes

Created automatically by the seed script:
- `{ vendorId: 1 }` (unique) — for lookups and updates
- `{ accreditationStatus: 1, accreditationExpiryDate: 1 }` — for expiring-vendors queries
- `{ category: 1 }` — for category filtering and discovery

### Logging

Uses structured JSON logging via `pino`. **Sensitive data is never logged** — logs only include:
- Non-sensitive identifiers: `vendorId`, tool name, operation, status codes
- Metrics: `durationMs`, `resultCount`, `queryLength`
- Errors: error type (never the full message if it could contain credentials)

Logs **never** include: full vendor records, contact emails, category values from queries, or the `reason` field (free text could contain PII).

### Security Notes

- **No request-level authentication is implemented yet.** Cloud Run IAM (via `--no-allow-unauthenticated`) is the only perimeter. See *Follow-up: Authentication* below.
- Credentials are **never hardcoded**. The `MONGODB_URI` must be supplied via environment variables, backed by Google Secret Manager in production.
- Input validation uses `zod` on every tool parameter.
- Regex queries are escaped to prevent ReDoS attacks.

## Cloud Run Deployment

### Prerequisites

- `gcloud` CLI installed and authenticated
- A GCP project with Cloud Run and Artifact Registry enabled
- A MongoDB Atlas cluster (or another reachable MongoDB instance)

### Step 1: Store credentials in Secret Manager

```bash
gcloud secrets create MONGODB_URI --replication-policy="automatic"
printf '%s' "$MONGODB_URI" | gcloud secrets versions add MONGODB_URI --data-file=-
```

### Step 2: Build and push the Docker image

```bash
# Configure Docker authentication (one-time)
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build the image
docker build -t us-central1-docker.pkg.dev/PROJECT_ID/vendor-accreditation/mcp-server:latest .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/PROJECT_ID/vendor-accreditation/mcp-server:latest
```

Replace `PROJECT_ID` with your GCP project ID.

### Step 3: Deploy to Cloud Run

```bash
gcloud run deploy vendor-accreditation-mcp \
  --image=us-central1-docker.pkg.dev/PROJECT_ID/vendor-accreditation/mcp-server:latest \
  --region=us-central1 \
  --platform=managed \
  --no-allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=5 \
  --set-secrets=MONGODB_URI=MONGODB_URI:latest \
  --set-env-vars=LOG_LEVEL=info
```

The `--no-allow-unauthenticated` flag ensures that only principals with `roles/run.invoker` can invoke the service. This is the current security perimeter until app-level auth is added.

### Step 4: Test the deployment

```bash
gcloud run services describe vendor-accreditation-mcp --region=us-central1

# Get the service URL and test the health endpoint
curl https://vendor-accreditation-mcp-RANDOM.run.app/healthz
```

### Optional: Private networking

If your MongoDB Atlas cluster requires private network access instead of a public IP allowlist:

1. Create a Serverless VPC Access connector:
   ```bash
   gcloud compute networks vpc-access connectors create vendor-mcp-connector \
     --region=us-central1 \
     --range=10.8.0.0/28
   ```

2. Set up **Atlas Network Peering** or **PrivateLink** between GCP and MongoDB Atlas.

3. Deploy with the connector:
   ```bash
   gcloud run deploy vendor-accreditation-mcp \
     ... \
     --vpc-connector=vendor-mcp-connector \
     ...
   ```

## Build & Test

```bash
# Type checking
npm run typecheck

# Build the project
npm run build

# Run the compiled server
npm start
```

## Follow-up: Authentication

**⚠️ No request-level authentication is implemented yet.**

Currently, Cloud Run IAM (via `--no-allow-unauthenticated`) is the only perimeter; the service is not callable without an explicit `roles/run.invoker` grant. This is sufficient for internal procurement tools but inadequate for public APIs or cross-organizational integrations.

Before any of the following, add bearer-token or IAM-identity validation in `src/server.ts` at the marked `// TODO(auth)` comment:

- Granting `allUsers` invoker access
- Allowing external vendors to call the service directly
- Consuming this MCP server via a public-facing LLM or agent

Suggested approaches:
- **Cloud Run IAM check**: Validate the `Authorization: Bearer` token against Cloud Run's default service account identity.
- **Shared bearer token**: Store a secret API key in Secret Manager and validate the request's Authorization header.
- **Mutual TLS**: Use Cloud Run's mTLS support for service-to-service calls.

See `src/server.ts` for the exact location and Cloud Run documentation for implementation patterns.

## License

MIT
