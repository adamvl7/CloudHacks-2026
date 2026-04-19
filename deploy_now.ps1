# Run this after setting AWS credentials in your shell:
#   $Env:AWS_ACCESS_KEY_ID="..."
#   $Env:AWS_SECRET_ACCESS_KEY="..."
#   $Env:AWS_SESSION_TOKEN="..."
#   $Env:AWS_DEFAULT_REGION="us-west-2"

if (-not $Env:AWS_ACCESS_KEY_ID) {
    Write-Host "ERROR: AWS credentials not set. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN first." -ForegroundColor Red
    exit 1
}

$Env:PATH = "C:\Program Files\Amazon\AWSCLIV2;C:\Program Files\Amazon\AWSSAMCLI\bin;$Env:PATH"

Set-Location "C:\Users\adaml\CloudHacks 2026\CloudHacks-2026"

Write-Host "==> sam build" -ForegroundColor Cyan
sam build
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED" -ForegroundColor Red; exit 1 }

Write-Host "==> sam deploy" -ForegroundColor Cyan
sam deploy
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 1) { Write-Host "DEPLOY FAILED" -ForegroundColor Red; exit 1 }
# exit code 1 with "No changes" is fine — continue to frontend sync

Write-Host "==> Fetching stack outputs" -ForegroundColor Cyan
$DASHBOARD_BUCKET = aws cloudformation describe-stacks --stack-name ecoshift --query "Stacks[0].Outputs[?OutputKey=='DashboardBucketName'].OutputValue" --output text
$API_BASE = aws cloudformation describe-stacks --stack-name ecoshift --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" --output text
$DASH_URL = aws cloudformation describe-stacks --stack-name ecoshift --query "Stacks[0].Outputs[?OutputKey=='DashboardUrl'].OutputValue" --output text
$DIST_ID = aws cloudformation describe-stacks --stack-name ecoshift --query "Stacks[0].Outputs[?OutputKey=='DashboardDistributionId'].OutputValue" --output text

Write-Host "DashboardBucket: $DASHBOARD_BUCKET"
Write-Host "ApiBaseUrl:      $API_BASE"
Write-Host "DashboardUrl:    $DASH_URL"
Write-Host "DistributionId:  $DIST_ID"

Write-Host "==> Building frontend" -ForegroundColor Cyan
Set-Location frontend
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path (Get-Location) ".env.production"), "VITE_API_BASE_URL=$API_BASE`n", $utf8NoBom)
npm install --silent
npm run build
Set-Location ..

Write-Host "==> Syncing to S3" -ForegroundColor Cyan
aws s3 sync frontend/dist/ "s3://$DASHBOARD_BUCKET/" --delete

if ($DIST_ID -and $DIST_ID -ne "None") {
    Write-Host "==> Invalidating CloudFront $DIST_ID" -ForegroundColor Cyan
    $INVALIDATION_ID = aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*" --query "Invalidation.Id" --output text
    Write-Host "InvalidationId: $INVALIDATION_ID"
}

Write-Host ""
Write-Host "DONE! Dashboard: $DASH_URL" -ForegroundColor Green
