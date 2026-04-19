#!/usr/bin/env bash
# EcoShift one-shot deploy: SAM stack + frontend build + S3 sync + CloudFront invalidation.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

STACK_NAME="${STACK_NAME:-ecoshift}"

echo "==> sam build"
sam build

if [[ "${1:-}" == "--guided" ]] || [[ ! -f samconfig.toml ]]; then
  sam deploy --guided
else
  echo "==> sam deploy"
  sam deploy
fi

echo "==> fetching stack outputs"
DASHBOARD_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DashboardBucketName'].OutputValue" --output text)
API_BASE=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" --output text)
DASH_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DashboardUrl'].OutputValue" --output text)
DIST_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DashboardDistributionId'].OutputValue" --output text)

echo "    DashboardBucket: $DASHBOARD_BUCKET"
echo "    ApiBaseUrl:      $API_BASE"
echo "    DistributionId:  $DIST_ID"

echo "==> building frontend"
pushd frontend >/dev/null
echo "VITE_API_BASE_URL=$API_BASE" > .env.production
npm install --silent
npm run build
popd >/dev/null

echo "==> syncing dist/ to s3://$DASHBOARD_BUCKET"
aws s3 sync frontend/dist/ "s3://$DASHBOARD_BUCKET/" --delete

if [[ -n "$DIST_ID" && "$DIST_ID" != "None" ]]; then
  echo "==> invalidating CloudFront distribution $DIST_ID"
  aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths '/*' >/dev/null
fi

echo ""
echo "DONE. Dashboard: $DASH_URL"
