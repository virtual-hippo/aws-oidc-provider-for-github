import {
  aws_iam as iam,
  aws_s3 as s3,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as cloudfront_origins,
  RemovalPolicy,
  Stack,
  StackProps,
  CfnOutput,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export interface AwsOIDCProviderForGithubStackProps extends StackProps {
  readonly githubAccountName: string;
  readonly repositryName: string;
}

export class AwsOIDCProviderForGithubStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AwsOIDCProviderForGithubStackProps
  ) {
    super(scope, id, props);

    const accountId = Stack.of(this).account;
    const region = Stack.of(this).region;

    const bucket = new s3.Bucket(this, "Bucket", {
      bucketName: `${props.repositryName}-assets-${accountId}-${region}`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const s3BucketOrigin =
      cloudfront_origins.S3BucketOrigin.withOriginAccessControl(bucket);
    new cloudfront.Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: s3BucketOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    const gitHubIdProvider = new iam.OpenIdConnectProvider(
      this,
      "GitHubIdProvider",
      {
        url: "https://token.actions.githubusercontent.com",
        clientIds: ["sts.amazonaws.com"],
      }
    );

    const oidcDeployRole = new iam.Role(this, "GitHubOidcRole", {
      roleName: `github-${props.repositryName}-oidc-role`,
      assumedBy: new iam.FederatedPrincipal(
        gitHubIdProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          },
          StringLike: {
            "token.actions.githubusercontent.com:sub": `repo:${props.githubAccountName}/${props.repositryName}:*`,
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    const deployPolicy = new iam.Policy(this, "DeployPolicy", {
      policyName: `github-${props.repositryName}-deploy-policy`,
      // 必要に応じてポリシーを追加する
      // 以下は Amazon S3 に静的コンテンツを配置するためのポリシー
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["s3:ListBucket", "s3:DeleteObject", "s3:PutObject"],
          resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
        }),
      ],
    });

    oidcDeployRole.attachInlinePolicy(deployPolicy);

    new CfnOutput(this, "DeployRoleArn", { value: oidcDeployRole.roleArn });
    new CfnOutput(this, "BucketName", { value: bucket.bucketName });
  }
}
