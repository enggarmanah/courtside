#!/bin/bash
# Courtside Crawler - GCP Secret Manager + Cloud Run setup
# Run this in GCP Cloud Shell (Bash) after: gcloud config set project YOUR_PROJECT_ID

set -euo pipefail

PROJECT_ID=$(gcloud config get-value project)
REGION="asia-southeast1"  # Jakarta
SA_NAME="courtside-crawler-sa"
SERVICE_NAME="courtside-crawler"

echo "=== Using project: $PROJECT_ID ==="

# 1. Enable APIs
gcloud services enable secretmanager.googleapis.com run.googleapis.com cloudscheduler.googleapis.com artifactregistry.googleapis.com

# 2. Create single JSON secret with all config
cat << 'SECRET' | gcloud secrets create courtside-config --data-file=- --replication-policy=automatic
{
  "email": "kucaricintaku@gmail.com",
  "password": "caricinta83",
  "db_host": "34.101.246.70",
  "db_port": "5432",
  "db_user": "padelitics",
  "db_password": "P@del1tic5",
  "db_name": "padelitics",
  "db_ssl_mode": "disable",
  "locations": [
    "9eabebe9-6669-4313-8a21-a5e4edee3fa3",
    "9eabec07-6769-4b12-a2fd-05ab422b3119",
    "9fbd4556-22bb-4811-a81e-d6eb65e79b15",
    "9eabec41-5161-4bec-98bf-66d43f4150c8",
    "9eabec2c-f342-48e2-b005-565dd796aa84",
    "9eabec1b-e9c9-4f67-b9f5-f99c063a1a35"
  ]
}
SECRET

# 3. Create service account
gcloud iam service-accounts create $SA_NAME --display-name="Courtside Crawler" 2>/dev/null || true

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# 4. Grant secret access
gcloud secrets add-iam-policy-binding courtside-config \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

echo "=== Secret created and SA granted access ==="
echo ""
echo "Next steps:"
echo "  1. cd modules/batch && gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
echo "  2. Deploy Cloud Run with:"
echo ""
echo "gcloud run deploy ${SERVICE_NAME} \\"
echo "  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \\"
echo "  --region ${REGION} \\"
echo "  --service-account ${SA_EMAIL} \\"
echo "  --set-env-vars=CONFIG_SECRET_PATH=/secrets/config.json \\"
echo "  --update-secrets=/secrets/config=courtside-config:latest \\"
echo "  --no-allow-unauthenticated \\"
echo "  --memory 512Mi \\"
echo "  --timeout 3600"
echo ""
echo "  3. After deploy, get the URL then create Scheduler:"
echo ""
echo "gcloud scheduler jobs create http courtside-crawler-daily \\"
echo "  --schedule='0 */6 * * *' \\"
echo "  --uri=https://${SERVICE_NAME}-xxx-${REGION}.a.run.app \\"
echo "  --http-method=POST \\"
echo "  --oidc-service-account-email=${SA_EMAIL} \\"
echo "  --oidc-token-audience=https://${SERVICE_NAME}-xxx-${REGION}.a.run.app"
