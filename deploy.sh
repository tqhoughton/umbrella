#!/bin/bash
aws cloudformation package --template-file template.yaml --s3-bucket $DEPLOYMENT_BUCKET --output-template-file output.yaml
aws cloudformation deploy --template-file output.yaml --region $REGION --stack-name $STACK_NAME --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM