/**
 * The photos: a private bucket, and the CDN a browser reads them through.
 *
 * The bucket is not public and never will be. A photo is uploaded straight to it with
 * a presigned PUT that the API issued, and it is read through CloudFront with an
 * origin access control — so the read path is cacheable, the write path is
 * authenticated, and the bucket itself answers to nobody.
 *
 * On a dev stage the bucket also expires what it holds after `photoRetentionDays`.
 * That is not a product feature; it is so a test album from March is not still being
 * paid for in December.
 */
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import type { StageConfig } from '../config';

export class MediaStack extends Stack {
  public readonly bucket: s3.Bucket;
  public readonly cdnDomain: string;

  constructor(scope: Construct, id: string, config: StageConfig, props?: StackProps) {
    super(scope, id, props);

    const removable = config.stage !== 'prod';

    this.bucket = new s3.Bucket(this, 'PhotosBucket', {
      bucketName: `foto-${config.stage}-photos-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: removable ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      autoDeleteObjects: removable,
      // A browser PUTs straight here, so the bucket has to answer a cross-origin
      // preflight for that PUT and for the range requests an image makes.
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      lifecycleRules:
        config.photoRetentionDays > 0
          ? [
              {
                id: 'expire-old-albums',
                enabled: true,
                expiration: Duration.days(config.photoRetentionDays),
              },
            ]
          : [],
    });

    /**
     * The CDN in front of it.
     *
     * One cache behaviour: every photo key is unique and immutable, so there is
     * nothing to invalidate and the only decision is how long to keep it — a year,
     * which is as long as a wedding album is looked at in the first flush.
     */
    const distribution = new cloudfront.Distribution(this, 'PhotosCdn', {
      comment: `foto ${config.stage} photos`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        compress: true,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    this.cdnDomain = `https://${distribution.distributionDomainName}`;

    new CfnOutput(this, 'PhotosBucketName', {
      value: this.bucket.bucketName,
      description: 'Where photo bytes are uploaded (private; presigned PUT only)',
    });
    new CfnOutput(this, 'PhotosCdnUrl', {
      value: this.cdnDomain,
      description: 'Where photos are read from',
    });
  }
}
