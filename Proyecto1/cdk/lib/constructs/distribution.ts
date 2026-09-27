import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface DistributionProps {
  publicBucket: s3.Bucket;
  privateBucket: s3.Bucket;
  priceClass?: cloudfront.PriceClass;
}

export class DistributionConstruct extends Construct {
  public readonly publicDistribution: cloudfront.Distribution;
  public readonly privateDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: DistributionProps) {
    super(scope, id);


    const s3OAC = new cloudfront.S3OriginAccessControl(this, 'S3OAC', {
      originAccessControlName: 'PortfolioS3OAC',
    });

    ////public
    const publicLogBucket = new s3.Bucket(this, 'CloudFrontLogsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
    });

    this.publicDistribution = new cloudfront.Distribution(
      this,
      'PublicDistribution',
      {
        comment: 'CDN para portafolios públicos',
        defaultBehavior: {
          origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(
            props.publicBucket,
            {
                originAccessControl: s3OAC,
            }
          ),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        },
        priceClass: props.priceClass ?? cloudfront.PriceClass.PRICE_CLASS_200,
        enableLogging: true,
        logBucket: publicLogBucket,
        minimumProtocolVersion:
          cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      }
    );

    props.publicBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        principals: [
          new iam.ServicePrincipal('cloudfront.amazonaws.com'),
        ],
        resources: [props.publicBucket.arnForObjects('*')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${
              cdk.Stack.of(this).account
            }:distribution/${this.publicDistribution.distributionId}`,
          },
        },
      })
    );

    //// private
    this.privateDistribution = new cloudfront.Distribution(
      this,
      'PrivateDistribution',
      {
        comment: 'CDN para portafolios privados (Signed URLs)',
        defaultBehavior: {
          origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(
            props.privateBucket,
            {
                originAccessControl: s3OAC,
                }
            ),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
        priceClass: props.priceClass ?? cloudfront.PriceClass.PRICE_CLASS_200,
        enableLogging: true,
        logBucket: publicLogBucket,
        minimumProtocolVersion:
          cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      }
    );


    //////
    props.privateBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        principals: [
          new iam.ServicePrincipal('cloudfront.amazonaws.com'),
        ],
        resources: [props.privateBucket.arnForObjects('*')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${
              cdk.Stack.of(this).account
            }:distribution/${this.privateDistribution.distributionId}`,
          },
        },
      })
    );

    new cdk.CfnOutput(this, 'PublicDistributionDomainName', {
      value: this.publicDistribution.domainName,
      description: 'URL de CloudFront para portafolios públicos',
    });

    new cdk.CfnOutput(this, 'PrivateDistributionDomainName', {
      value: this.privateDistribution.domainName,
      description: 'URL de CloudFront para portafolios privados',
    });
  }
}