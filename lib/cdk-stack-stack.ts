import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import { Vpc, SecurityGroup } from '@aws-cdk/aws-ec2';
import {S3Stack} from "./s3-stack";
import { EC2Stack } from './ec2-stack';
import { PipelineStack } from './pipeline-stack';
import { FargateService } from '@aws-cdk/aws-ecs';
import { Peer, Port } from '@aws-cdk/aws-ec2';
import { Cluster, TaskDefinition } from '@aws-cdk/aws-ecs';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as ecs from "@aws-cdk/aws-ecs";

const repoNames: string[] = ["microservice1", "microservice2", "microservice3"];
const ports: number[] = [7070, 8080, 9090];

export class CdkStackStack extends cdk.Stack {

  ecrRepositories: ecr.Repository[] = [];

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    //create ecr
    for(let i=0; i<repoNames.length; i++) {
      let ecrr = new ecr.Repository(this, repoNames[i], { repositoryName: repoNames[i]});
      ecrr.addLifecycleRule({
          maxImageCount: 1
      });
      this.ecrRepositories.push(ecrr);
    }

    //create s3 bucket and database
    new S3Stack(this, 'S3Stack', props);


    var ecsStack = new EC2Stack(this, 'EC2Stack',repoNames, props);
    ecsStack.createEC2Service(this.ecrRepositories, ports);

    
    // var ecsStack = new EC2Stack(this, 'EC2Stack', props);
    // var service = ecsStack.createEC2Service(vpc, repoNames, this.ecrRepositories, securityGroup);
    // this.services.push(service);


    // var pipelineStack = new PipelineStack(this, 'PipelineStack', vpc, repoNames, this.ecrRepositories, this.services, props);
    // pipelineStack.build();
  }
}
