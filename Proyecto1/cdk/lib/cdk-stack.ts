import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { StorageConstruct } from './constructs/storage';
import { DatabaseConstruct } from './constructs/database';
import { DistributionConstruct } from './constructs/distribution';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ============================================
    // 1. ALMACENAMIENTO (S3)
    // ============================================
    const storage = new StorageConstruct(this, 'Storage', {
      autoDeleteObjects: true,
    });

    // ============================================
    // 2. BASE DE DATOS (DynamoDB)
    // ============================================
    const database = new DatabaseConstruct(this, 'Database');

    // ============================================
    // 3. DISTRIBUCIÓN (CloudFront)
    // ============================================
    const distribution = new DistributionConstruct(this, 'Distribution', {
      publicBucket: storage.publicBucket,
      privateBucket: storage.privateBucket,
    });

    // ============================================
    // 4. ROLES IAM CON MÍNIMO PRIVILEGIO
    // ============================================

    // Role para escribir en S3 (subir portafolios)
    const portfolioUploaderRole = new iam.Role(this, 'PortfolioUploaderRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role para subir portafolios a S3',
    });

    storage.publicBucket.grantWrite(portfolioUploaderRole);
    storage.privateBucket.grantWrite(portfolioUploaderRole);
    database.table.grantWriteData(portfolioUploaderRole);

    // Role para leer de DynamoDB
    const portfolioReaderRole = new iam.Role(this, 'PortfolioReaderRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role para leer portafolios de DynamoDB',
    });

    database.table.grantReadData(portfolioReaderRole);

    // Role para generar Signed URLs (archivos privados)
    const signedUrlGeneratorRole = new iam.Role(
      this,
      'SignedUrlGeneratorRole',
      {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        description: 'Role para generar Signed URLs en CloudFront',
      }
    );

    signedUrlGeneratorRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'cloudfront:CreateSignedUrlAndCookie',
          'cloudfront:CreateInvalidation',
        ],
        resources: [
          `arn:aws:cloudfront::${this.account}:distribution/${distribution.privateDistribution.distributionId}`,
        ],
      })
    );

    // ============================================
    // 5. OUTPUTS FINALES
    // ============================================
    new cdk.CfnOutput(this, 'UploaderRoleArn', {
      value: portfolioUploaderRole.roleArn,
      description: 'ARN del role para subir portafolios',
    });

    new cdk.CfnOutput(this, 'ReaderRoleArn', {
      value: portfolioReaderRole.roleArn,
      description: 'ARN del role para leer portafolios',
    });

    new cdk.CfnOutput(this, 'SignedUrlGeneratorRoleArn', {
      value: signedUrlGeneratorRole.roleArn,
      description: 'ARN del role para generar Signed URLs',
    });

    new cdk.CfnOutput(this, 'DeploymentComplete', {
      value: '✅ Platform deployed successfully!',
      description: 'Estado del despliegue',
    });
  }
}