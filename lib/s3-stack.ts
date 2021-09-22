import * as cdk from '@aws-cdk/core';
import { Vpc } from '@aws-cdk/aws-ec2';
import * as sqs from '@aws-cdk/aws-sqs';
import {BlockPublicAccess, Bucket, BucketEncryption} from '@aws-cdk/aws-s3';
import { RemovalPolicy } from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';


export class S3Stack extends cdk.Stack {
  
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);

      new Bucket(this, 'test-bucket-for-timxi', {
        versioned: false,
        bucketName: 'test-bucket-for-timxi',
        encryption: BucketEncryption.KMS_MANAGED,
        publicReadAccess: false,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy: RemovalPolicy.DESTROY
      });

      const dlq1 = new sqs.Queue(this, "dlq1", {
        queueName: "dlq1"
      });

      const transformQueue = new sqs.Queue(this, 'transform-queue', {
        queueName: "transform-queue",
        deadLetterQueue: {
          maxReceiveCount: 1,
          queue: dlq1
        }
      });

      const dlq2 = new sqs.Queue(this, "dlq2", {
        queueName: "dlq2"
      });

      const storeQueue = new sqs.Queue(this, 'store-queue', {
        queueName: "store-queue",
        deadLetterQueue: {
          maxReceiveCount: 1,
          queue: dlq2
        }
      });

      const mytable = new dynamodb.Table(this, 'People', {
        partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
        tableName: 'People',
        removalPolicy: cdk.RemovalPolicy.DESTROY
      });
    }    
}