#!/bin/bash
# Cloud Run Deployment Script for Vendor Accreditation MCP Server

set -e

PROJECT_ID="zacklearning"
REGION="us-central1"
SERVICE_NAME="vendor-accreditation-mcp"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/vendor-accreditation/mcp-server:latest"

echo "=========================================="
echo "Vendor Accreditation MCP - Cloud Run Deploy"
echo "=========================================="
echo ""
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo "Image: $IMAGE"
echo ""

# Step 1: MongoDB URI
if [ -z "$MONGODB_URI" ]; then
  echo "STEP 1: MongoDB URI"
  echo "-------------------"
  echo "Your MongoDB URI is not set in the MONGODB_URI environment variable."
  echo "Please provide your MongoDB Atlas connection string:"
  echo ""
  echo "Example: mongodb+srv://user:password@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority"
  echo ""
  read -sp "Enter MongoDB URI: " MONGODB_URI
  echo ""
else
  echo "✓ MONGODB_URI is set (using provided value)"
fi

# Step 2: Create/Update Secret
echo ""
echo "STEP 2: Creating Secret in Secret Manager"
echo "-------------------------------------------"

SECRET_EXISTS=$(gcloud secrets list --project=$PROJECT_ID --format='value(name)' | grep -c "^MONGODB_URI\$" || true)

if [ "$SECRET_EXISTS" -eq 0 ]; then
  echo "Creating new secret: MONGODB_URI"
  gcloud secrets create MONGODB_URI \
    --replication-policy="automatic" \
    --project=$PROJECT_ID
fi

echo "Adding MongoDB URI to Secret Manager..."
printf '%s' "$MONGODB_URI" | gcloud secrets versions add MONGODB_URI \
  --data-file=- \
  --project=$PROJECT_ID

echo "✓ Secret created/updated"

# Step 3: Deploy to Cloud Run
echo ""
echo "STEP 3: Deploying to Cloud Run"
echo "-------------------------------"

gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE \
  --region=$REGION \
  --platform=managed \
  --no-allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=5 \
  --set-secrets=MONGODB_URI=MONGODB_URI:latest \
  --set-env-vars=LOG_LEVEL=info \
  --project=$PROJECT_ID

# Step 4: Get Service URL
echo ""
echo "STEP 4: Getting Service URL"
echo "----------------------------"

SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

echo ""
echo "=========================================="
echo "✓ Deployment Successful!"
echo "=========================================="
echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "Next Steps:"
echo "1. Test the health endpoint:"
echo "   curl $SERVICE_URL/healthz"
echo ""
echo "2. Get an identity token for MCP clients:"
echo "   gcloud auth print-identity-token"
echo ""
echo "3. Configure Claude Code or GitHub Copilot with:"
echo "   URL: $SERVICE_URL/mcp"
echo "   Auth: Bearer <identity-token>"
echo ""
echo "See TESTING_WITH_CLIENTS.md for detailed setup instructions."
echo ""
