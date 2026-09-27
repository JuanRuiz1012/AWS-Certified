import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface StorageProps extends cdk.StackProps {
  autoDeleteObjects?: boolean;
}

export class StorageConstruct extends Construct {
  public readonly publicBucket: s3.Bucket;
  public readonly privateBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: StorageProps) {
    super(scope, id);

  ////Public
    this.publicBucket = new s3.Bucket(this, 'PublicPortfolioBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props?.autoDeleteObjects ?? true,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
    });

    //// private
    this.privateBucket = new s3.Bucket(this, 'PrivatePortfolioBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props?.autoDeleteObjects ?? true,
    });

    new cdk.CfnOutput(this, 'PublicBucketName', {
      value: this.publicBucket.bucketName,
      description: 'Nombre del bucket S3 público',
    });

    new cdk.CfnOutput(this, 'PrivateBucketName', {
      value: this.privateBucket.bucketName,
      description: 'Nombre del bucket S3 privado',
    });
  }
}