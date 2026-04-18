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
if ($LASTEXITCODE -ne 0) { Write-Host "DEPLOY FAILED" -ForegroundColor Red; exit 1 }

Write-Host "==> Fetching stack outputs" -ForegroundColor Cyan
$DASHBOARD_BUCKET = aws cloudformation describe-stacks --stack-name ecoshift --query "Stacks[0].Outputs[?OutputKey=='DashboardBucketName'].OutputValue" --output text
$API_BASE = aws cloudformation describe-stacks --stack-name ecoshift --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" --output text
$DASH_URL = aws cloudformation describe-stacks --stack-name ecoshift --query "Stacks[0].Outputs[?OutputKey=='DashboardUrl'].OutputValue" --output text

Write-Host "DashboardBucket: $DASHBOARD_BUCKET"
Write-Host "ApiBaseUrl:      $API_BASE"
Write-Host "DashboardUrl:    $DASH_URL"

Write-Host "==> Building frontend" -ForegroundColor Cyan
Set-Location frontend
"VITE_API_BASE_URL=$API_BASE" | Out-File -FilePath .env.production -Encoding utf8
npm install --silent
npm run build
Set-Location ..

Write-Host "==> Syncing to S3" -ForegroundColor Cyan
aws s3 sync frontend/dist/ "s3://$DASHBOARD_BUCKET/" --delete

$DIST_ID = aws cloudfront list-distributions --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, '$DASHBOARD_BUCKET')].Id" --output text
if ($DIST_ID) {
    Write-Host "==> Invalidating CloudFront $DIST_ID" -ForegroundColor Cyan
    aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*" | Out-Null
}

Write-Host ""
Write-Host "DONE! Dashboard: $DASH_URL" -ForegroundColor Green
