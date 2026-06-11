# Deploy the Vite/React frontend to Firebase Hosting.
# The hosting config (frontend/firebase.json) routes /api/** to the Cloud Run
# backend, so the frontend doesn't need a separate backend URL.
#
# One-time setup BEFORE running this script:
#   npm install -g firebase-tools
#   firebase login

$ErrorActionPreference = "Stop"

Push-Location frontend
try {
    Write-Host "[1/2] Building production bundle..." -ForegroundColor Cyan
    npm run build

    Write-Host "[2/2] Deploying to Firebase Hosting..." -ForegroundColor Cyan
    firebase deploy --only hosting --project kubar-protocol-main
}
finally {
    Pop-Location
}
