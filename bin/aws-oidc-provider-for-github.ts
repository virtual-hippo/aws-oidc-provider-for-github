#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AwsOIDCProviderForGithubStack } from "../lib/stacks/aws-oidc-provider-for-github-stack";
import { awsOIDCProviderForGithubStackParam } from "../lib/parameters";

const app = new cdk.App();
new AwsOIDCProviderForGithubStack(
  app,
  "AwsOIDCProviderForGithubStack",
  awsOIDCProviderForGithubStackParam
);
