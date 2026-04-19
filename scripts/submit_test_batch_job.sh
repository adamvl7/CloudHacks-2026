#!/usr/bin/env bash
# Submit a sample AWS Batch job to the Nimbus-managed queue.
# Jobs only execute when Nimbus has scaled the compute env up (green grid).
set -euo pipefail

STACK_NAME="${STACK_NAME:-ecoshift}"

QUEUE=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='BatchJobQueueName'].OutputValue" --output text)
JOBDEF=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='BatchJobDefinitionName'].OutputValue" --output text)

NAME="ecoshift-sample-$(date +%s)"
echo "submitting $NAME -> queue=$QUEUE definition=$JOBDEF"

aws batch submit-job \
  --job-name "$NAME" \
  --job-queue "$QUEUE" \
  --job-definition "$JOBDEF" \
  --query 'jobId' --output text
