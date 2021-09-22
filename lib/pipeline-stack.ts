import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import { Vpc } from '@aws-cdk/aws-ec2';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import * as codebuild from '@aws-cdk/aws-codebuild';
import { ManagedPolicy } from '@aws-cdk/aws-iam';
import { EcrSourceAction, CodeBuildAction, EcsDeployAction} from '@aws-cdk/aws-codepipeline-actions';
import { LocalCacheMode } from '@aws-cdk/aws-codebuild';
import { FargateService } from '@aws-cdk/aws-ecs';

export class PipelineStack extends cdk.Stack {

  sourceOutputs: Artifact[] = [new Artifact(), new Artifact(), new Artifact()];
  buildOutputs: Artifact[] = [new Artifact(), new Artifact(), new Artifact()];
  ecrRepositories: ecr.Repository[] = [];
  vpc: Vpc;
  repoNames: string[] = [];
  fargateServices: FargateService[] = [];

  
  constructor(scope: cdk.Construct, id: string, vpc: Vpc, repoNames: string[], ecrRepositories: ecr.Repository[], services:FargateService[], props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = vpc;
    this.repoNames = repoNames;
    this.ecrRepositories = ecrRepositories;
    this.fargateServices = services;
  }

  public build() {

    var sourceActions = [] as EcrSourceAction[];
    var buildActions = [] as CodeBuildAction[];
    var deployActions = [] as EcsDeployAction[];


    for (let i = 0; i < this.ecrRepositories.length; i++) {
      var sourceAction = this.createSourceAction(i);
      var pipelineProject = this.createPipelineProject(i);
      var buildAction = this.createBuildAction(pipelineProject, i);
      var deployAction = this.createEcsDeployAction(i);

      sourceActions.push(sourceAction)
      buildActions.push(buildAction);
      deployActions.push(deployAction);
    }

    var pipeline = new Pipeline(this, 'my_pipeline_', {
      stages: [
      {
          stageName: 'Source',
          actions: sourceActions
      },
      {
          stageName: 'Build',
          actions: buildActions
      },
        {
          stageName: 'Deploy',
          actions: deployActions
        },
      ],
      pipelineName: "my_pipeline",

    });
  }


  private createPipelineProject(index:number): codebuild.PipelineProject {
    var pipelineProject = new codebuild.PipelineProject(this, 'my-codepipeline'+index, {
      projectName: "my-codepipeline"+index,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_2_0,
        privileged: true
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          post_build: {
            commands: [
              "echo creating imagedefinitions.json dynamically",
              "printf '[{\"name\":\"" + this.repoNames[index] + "\",\"imageUri\": \"" + this.ecrRepositories[index].repositoryUriForTag() + ":latest\"}]' > imagedefinitions.json",
              "echo Build completed on `date`"
            ]
          }
        },
        artifacts: {
          files: [
            "imagedefinitions.json"
          ]
        }
      }),
      cache: codebuild.Cache.local(LocalCacheMode.DOCKER_LAYER, LocalCacheMode.CUSTOM)
    });

    pipelineProject.role?.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'));
    return pipelineProject;
  }

  private createSourceAction(index:number): EcrSourceAction {
    return new EcrSourceAction({
        actionName: "EcrSourceAction" + index,
        output: this.sourceOutputs[index],
        repository: this.ecrRepositories[index],
        imageTag: "latest",
    });
  }
    
  private createBuildAction(pipelineProject: codebuild.PipelineProject, index:number): CodeBuildAction {
    var buildAction = new CodeBuildAction({
      actionName: 'Build'+index,
      project: pipelineProject,
      input: this.sourceOutputs[index],
      outputs: [this.buildOutputs[index]],

    });
    return buildAction;
  }
    
  private createEcsDeployAction(index: number): EcsDeployAction {
    return new EcsDeployAction({
      actionName: 'EcsDeployAction'+index,
      service: this.fargateServices[index],
      input: this.buildOutputs[index],
    })
  };
}