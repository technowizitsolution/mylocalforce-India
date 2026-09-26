$ErrorActionPreference = "Stop"

# ============================================================
# MY LOCAL FORCE WEB - DEPLOYMENT SCRIPT
# ============================================================
#
# Build:  npm run build  ->  vite build  ->  dist\
# Deploy: app.yaml (repo root) serves dist\ as static files
#         on Google App Engine.
#
# The target project and account are passed explicitly to gcloud,
# so this works even when the active gcloud config points at
# another project.
# ============================================================

$ExpectedProjectId = "mylocalforceweb-481310"
$ExpectedAccount = "mylocalforce@gmail.com"
$LiveUrl = "https://mylocalforceweb-481310.ts.r.appspot.com"

$DistPath = Join-Path $PSScriptRoot "dist"

function Write-Banner($Text) {
    Write-Host ""
    Write-Host "========================================="
    Write-Host "  $Text"
    Write-Host "========================================="
    Write-Host ""
}

function Stop-Deployment($Title, $Message) {
    Write-Banner $Title
    if ($Message) {
        Write-Host $Message
        Write-Host ""
    }
    Write-Host "Deployment stopped."
    Set-Location $PSScriptRoot
    exit 1
}

Write-Banner "   MY LOCAL FORCE WEB DEPLOYMENT"

Set-Location $PSScriptRoot


# ============================================================
# STEP 1 - CHECK GOOGLE CLOUD ACCOUNT & PROJECT
# ============================================================
# Done first so a missing login fails fast, before the build.

Write-Host "[1/4] Checking Google Cloud account and project..."
Write-Host ""

if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Stop-Deployment "GCLOUD NOT FOUND" "Install the Google Cloud SDK and try again."
}

$ErrorActionPreference = "Continue"
$Accounts = @(gcloud auth list --format="value(account)" 2>$null)
$ErrorActionPreference = "Stop"

if ($Accounts -notcontains $ExpectedAccount) {
    Stop-Deployment "ACCOUNT NOT LOGGED IN" ("$ExpectedAccount is not logged in to gcloud.`n" +
        "Run: gcloud auth login $ExpectedAccount")
}

$ErrorActionPreference = "Continue"
gcloud projects describe $ExpectedProjectId --account=$ExpectedAccount --format="table(name,projectId,projectNumber)"
$DescribeExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($DescribeExitCode -ne 0) {
    Stop-Deployment "PROJECT NOT ACCESSIBLE" ("Could not access project $ExpectedProjectId " +
        "with account $ExpectedAccount.")
}

Write-Host "Account and project verified."


# ============================================================
# STEP 2 - INSTALL DEPENDENCIES (IF NEEDED)
# ============================================================

Write-Host ""
Write-Host "[2/4] Checking dependencies..."
Write-Host ""

if (!(Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
    Write-Host "node_modules not found. Running npm install..."
    Write-Host ""

    npm install

    if ($LASTEXITCODE -ne 0) {
        Stop-Deployment "NPM INSTALL FAILED"
    }
}

Write-Host "Dependencies ready."


# ============================================================
# STEP 3 - BUILD FRONTEND (VITE -> dist\)
# ============================================================

Write-Host ""
Write-Host "[3/4] Building project..."
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
    Stop-Deployment "BUILD FAILED"
}

# Verify the output app.yaml serves from
if (!(Test-Path (Join-Path $DistPath "index.html"))) {
    Stop-Deployment "BUILD OUTPUT NOT FOUND" "Expected:`n$DistPath\index.html"
}

if (!(Test-Path (Join-Path $DistPath "assets"))) {
    Stop-Deployment "BUILD OUTPUT NOT FOUND" "Expected:`n$DistPath\assets"
}

Write-Host ""
Write-Host "Build successful."


# ============================================================
# FINAL CONFIRMATION
# ============================================================

Write-Banner "         READY TO DEPLOY"

Write-Host "Target Project:"
Write-Host $ExpectedProjectId
Write-Host ""
Write-Host "Account:"
Write-Host $ExpectedAccount
Write-Host ""

$confirmation = Read-Host "Continue deployment? (Y/N)"

if ($confirmation -notmatch '^[Yy]$') {
    Write-Banner "      DEPLOYMENT CANCELLED"
    Write-Host "Nothing was deployed to Google Cloud."
    Set-Location $PSScriptRoot
    exit 0
}


# ============================================================
# STEP 4 - DEPLOY TO GOOGLE APP ENGINE
# ============================================================

Write-Banner "           DEPLOYING..."

Write-Host "[4/4] Deploying to App Engine..."
Write-Host ""

$ErrorActionPreference = "Continue"
gcloud app deploy app.yaml --project=$ExpectedProjectId --account=$ExpectedAccount --quiet
$DeployExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($DeployExitCode -ne 0) {
    Stop-Deployment "DEPLOYMENT FAILED" "Check the Google Cloud error shown above."
}


# ============================================================
# SUCCESS
# ============================================================

Write-Banner "      DEPLOYMENT SUCCESSFUL"

Write-Host "My Local Force Web has been deployed successfully."
Write-Host ""
Write-Host "Live URL:"
Write-Host $LiveUrl
Write-Host ""
Write-Host "========================================="
Write-Host ""

Set-Location $PSScriptRoot
