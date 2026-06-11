# Deploy the Vite/React frontend to Cloud Run (nginx container).
# nginx serves the SPA and proxies /api/** to the backend Cloud Run service,
# so the borrower only ever sees one URL.
#
# Manual fallback — primary deploy path is the Cloud Build trigger on git push to master.
# Run from project root in PowerShell:  .\scripts\deploy-frontend-cloudrun.ps1

$Project    = "kubar-protocol-main"
$Region     = "asia-south1"
$Service    = "kuber-frontend"
$Tag        = "v1"
$Image      = "asia-south1-docker.pkg.dev/$Project/kuber/frontend:$Tag"
$BackendUrl = "https://kuber-verification-ufzxw24k5a-el.a.run.app"

Write-Host "[1/2] Building frontend image..." -ForegroundColor Cyan
gcloud builds submit frontend/ --tag $Image --project $Project
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed; aborting." -ForegroundColor Red; exit 1 }

Write-Host "[2/2] Deploying $Service to Cloud Run..." -ForegroundColor Cyan
gcloud run deploy $Service `
  --image $Image `
  --region $Region `
  --project $Project `
  --set-env-vars "BACKEND_URL=$BackendUrl" `
  --allow-unauthenticated `
  --memory 256Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 5 `
  --timeout 900s `
  --port 8080

if ($LASTEXITCODE -ne 0) { Write-Host "Deploy failed." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Frontend deployed. Borrower URL:" -ForegroundColor Green
gcloud run services describe $Service --region $Region --project $Project --format "value(status.url)"
