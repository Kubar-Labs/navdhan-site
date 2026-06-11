# Deploy the backend (API only) to Cloud Run.
# Manual fallback — primary deploy path is the Cloud Build trigger on git push to master.
# Run from project root in PowerShell:  .\scripts\deploy-backend.ps1

$Project  = "kubar-protocol-main"
$Region   = "asia-south1"
$Service  = "kuber-verification"
$Tag      = "v1"
$Image    = "asia-south1-docker.pkg.dev/$Project/kuber/verification:$Tag"
$SA       = "kuber-backend-sa@$Project.iam.gserviceaccount.com"
$SqlInst  = "${Project}:${Region}:kuber-db"

$EnvVars = @(
  "APP_ENV=prod",
  "GCS_BUCKET=kuber-kyc-prod",
  "API_VERSION=v1",
  "ALLOWED_ORIGINS=https://dsa.kubar.tech"
) -join ","

$Secrets = @(
  "DATABASE_URL=database-url:latest",
  "ENCRYPTION_KEY=encryption-key:latest",
  "PERFIOS_USERNAME=perfios-username:latest",
  "PERFIOS_PASSWORD=perfios-password:latest",
  "PERFIOS_ORG_ID=perfios-org-id:latest"
) -join ","

Write-Host "[1/2] Building backend image..." -ForegroundColor Cyan
gcloud builds submit backend/ --tag $Image
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed; aborting." -ForegroundColor Red; exit 1 }

Write-Host "[2/2] Deploying $Service to Cloud Run..." -ForegroundColor Cyan
gcloud run deploy $Service `
  --image $Image `
  --region $Region `
  --service-account $SA `
  --add-cloudsql-instances $SqlInst `
  --set-env-vars $EnvVars `
  --set-secrets $Secrets `
  --allow-unauthenticated `
  --memory 1Gi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 5 `
  --timeout 900s
