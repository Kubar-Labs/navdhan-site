# Deploy one already-built, digest-pinned collection backend image as a
# zero-traffic Cloud Run candidate. Run from the exact clean commit that the
# repository-connected Cloud Build trigger built. This script never builds
# source, runs database migrations, or promotes traffic.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{40}$')]
    [string]$CommitSha,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{40}-[0-9a-fA-F-]{36}$')]
    [string]$ImageTag,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[1-9][0-9]*$')]
    [string]$DbPasswordSecretVersion,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[1-9][0-9]*$')]
    [string]$EncryptionKeySecretVersion,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[1-9][0-9]*$')]
    [string]$LookupHmacKeySecretVersion,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[1-9][0-9]*$')]
    [string]$ApplyServiceTokenSecretVersion,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[1-9][0-9]*$')]
    [string]$ScanCallbackTokenSecretVersion
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Project = "kubardevops"
$Region = "asia-south1"
$Service = "navdhan-backend"
$Repository = "kuber"
$ImageBase = "${Region}-docker.pkg.dev/$Project/$Repository/navdhan-backend"
$ServiceAccount = "navdhan-backend-sa@${Project}.iam.gserviceaccount.com"
$SqlConnection = "kubardevops:asia-south1:navdhan-prod"
$Bucket = "navdhan-documents-prod"

function Invoke-Gcloud {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    & gcloud @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud command failed with exit code $LASTEXITCODE"
    }
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    throw "gcloud is required."
}

if (-not (Test-Path "dsa_portal/backend/Dockerfile" -PathType Leaf)) {
    throw "Run this script from the repository root."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git is required."
}

$WorktreeChanges = @(& git status --porcelain --untracked-files=normal)
if ($LASTEXITCODE -ne 0) {
    throw "Could not inspect the Git worktree."
}
if ($WorktreeChanges.Count -ne 0) {
    throw "Refusing to build a dirty or untracked worktree."
}

$CheckedOutCommit = (& git rev-parse HEAD).Trim().ToLowerInvariant()
if ($LASTEXITCODE -ne 0 -or $CheckedOutCommit -notmatch '^[0-9a-f]{40}$') {
    throw "Could not resolve the current Git commit."
}
$CommitSha = $CommitSha.ToLowerInvariant()
$ImageTag = $ImageTag.ToLowerInvariant()
if ($CheckedOutCommit -ne $CommitSha) {
    throw "The checked-out Git SHA does not equal the approved CommitSha."
}
if (-not $ImageTag.StartsWith("$CommitSha-")) {
    throw "ImageTag must start with the full approved Git SHA and Cloud Build ID."
}

$RequiredSecrets = [ordered]@{
    "navdhan-prod-db-password" = $DbPasswordSecretVersion
    "navdhan-prod-encryption-key" = $EncryptionKeySecretVersion
    "navdhan-prod-lookup-hmac-key" = $LookupHmacKeySecretVersion
    "navdhan-prod-apply-service-token" = $ApplyServiceTokenSecretVersion
    "navdhan-prod-document-scan-callback-token" = $ScanCallbackTokenSecretVersion
}

Write-Host "[1/3] Checking production deployment prerequisites..." -ForegroundColor Cyan
$SqlInstanceJson = (Invoke-Gcloud -Arguments @("sql", "instances", "describe", "navdhan-prod", "--project=$Project", "--format=json")) -join "`n"
$SqlInstance = $SqlInstanceJson | ConvertFrom-Json
if ($SqlInstance.connectionName -ne $SqlConnection -or $SqlInstance.databaseVersion -ne "POSTGRES_18" -or $SqlInstance.state -ne "RUNNABLE") {
    throw "Cloud SQL does not match the guarded production topology."
}

$BucketJson = (Invoke-Gcloud -Arguments @("storage", "buckets", "describe", "gs://$Bucket", "--project=$Project", "--format=json")) -join "`n"
$BucketInfo = $BucketJson | ConvertFrom-Json
$ActualBucketName = ([string]$BucketInfo.name).TrimEnd([char]'/')
$ActualBucketLocation = ([string]$BucketInfo.location).ToUpperInvariant()
if (($ActualBucketName -ne $Bucket -and $ActualBucketName -ne "gs://$Bucket") -or $ActualBucketLocation -ne "ASIA-SOUTH1") {
    throw "The document bucket name or location is incorrect."
}
$PublicAccessPrevention = ([string]$BucketInfo.public_access_prevention).ToLowerInvariant()
if (-not $BucketInfo.uniform_bucket_level_access -or $PublicAccessPrevention -ne "enforced") {
    throw "The document bucket must enforce uniform access and public access prevention."
}

$ActualServiceAccount = (Invoke-Gcloud -Arguments @("iam", "service-accounts", "describe", $ServiceAccount, "--project=$Project", "--format=value(email)")) -join ""
if ($ActualServiceAccount.Trim() -ne $ServiceAccount) {
    throw "Cloud Run service account mismatch."
}
foreach ($SecretEntry in $RequiredSecrets.GetEnumerator()) {
    $Secret = $SecretEntry.Key
    $Version = $SecretEntry.Value
    $SecretState = (Invoke-Gcloud -Arguments @("secrets", "versions", "describe", $Version, "--secret=$Secret", "--project=$Project", "--format=value(state)")) -join ""
    if ($SecretState.Trim() -ne "ENABLED") {
        throw "Secret $Secret version $Version is not enabled."
    }
}

Write-Host "[2/3] Resolving the trigger-built image to an immutable digest..." -ForegroundColor Cyan
$TaggedImage = "${ImageBase}:$ImageTag"
$ImageDigest = (Invoke-Gcloud -Arguments @(
    "artifacts", "docker", "images", "describe", $TaggedImage,
    "--project=$Project",
    "--format=value(image_summary.digest)"
)) -join ""
$ImageDigest = $ImageDigest.Trim().ToLowerInvariant()
if ($ImageDigest -notmatch '^sha256:[0-9a-f]{64}$') {
    throw "Artifact Registry did not return an immutable SHA-256 image digest."
}
$Image = "${ImageBase}@$ImageDigest"
$RevisionSuffix = "$($CommitSha.Substring(0, 12))-$($ImageDigest.Substring(7, 12))"

Write-Host "[3/3] Deploying a zero-traffic candidate revision..." -ForegroundColor Cyan
$EnvironmentVariables = "^@^APP_ENV=prod@HOST=0.0.0.0@LOG_LEVEL=INFO@GCS_BUCKET=$Bucket@GOOGLE_CLOUD_PROJECT=$Project@DB_HOST=/cloudsql/$SqlConnection@DB_USER=navdhan_collection_app@DB_NAME=navdhan_collection@DB_POOL_SIZE=4@DB_MAX_OVERFLOW=1@ALLOWED_ORIGINS=https://navdhan.app,https://www.navdhan.app"
$Secrets = "DB_PASSWORD=navdhan-prod-db-password:$DbPasswordSecretVersion,ENCRYPTION_KEY=navdhan-prod-encryption-key:$EncryptionKeySecretVersion,LOOKUP_HMAC_KEY=navdhan-prod-lookup-hmac-key:$LookupHmacKeySecretVersion,APPLY_SERVICE_TOKEN=navdhan-prod-apply-service-token:$ApplyServiceTokenSecretVersion,DOCUMENT_SCAN_CALLBACK_TOKEN=navdhan-prod-document-scan-callback-token:$ScanCallbackTokenSecretVersion"

Invoke-Gcloud -Arguments @(
    "run", "deploy", $Service,
    "--project=$Project",
    "--region=$Region",
    "--platform=managed",
    "--image=$Image",
    "--revision-suffix=$RevisionSuffix",
    "--service-account=$ServiceAccount",
    "--set-cloudsql-instances=$SqlConnection",
    "--set-env-vars=$EnvironmentVariables",
    "--set-secrets=$Secrets",
    "--allow-unauthenticated",
    "--ingress=all",
    "--no-traffic",
    "--execution-environment=gen2",
    "--port=8080",
    "--memory=1Gi",
    "--cpu=1",
    "--concurrency=20",
    "--min-instances=0",
    "--max-instances=4",
    "--timeout=120s"
)

Write-Host "Candidate created with zero traffic from $Image." -ForegroundColor Green
Write-Host "Do not promote it until database/runtime checks and the authenticated API smoke test in DEPLOYMENT.md pass."
