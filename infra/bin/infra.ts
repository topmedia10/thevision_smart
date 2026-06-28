#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { TheVisionSmartStack } from "../lib/thevision-smart-stack";
import { REGION } from "../lib/constants";

const app = new cdk.App();

new TheVisionSmartStack(app, "TheVisionSmartStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: REGION,
  },
  description:
    "The Vision Smart — SMS & Push marketing automation (DynamoDB, SQS, Lambdas, API GW, EventBridge, Secrets, IAM).",
});

app.synth();
