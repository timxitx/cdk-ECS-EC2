import * as cdk from '@aws-cdk/core';
import * as ecs from "@aws-cdk/aws-ecs";
import * as ecr from '@aws-cdk/aws-ecr';
import * as ec2 from '@aws-cdk/aws-ec2';
import { SecurityGroup, Vpc } from '@aws-cdk/aws-ec2';
import { Cluster, TaskDefinition } from '@aws-cdk/aws-ecs';
import { Duration } from '@aws-cdk/core';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import { ManagedPolicy } from '@aws-cdk/aws-iam';
import { Peer, Port } from '@aws-cdk/aws-ec2';


export class EC2Stack extends cdk.Stack {

    vpc: Vpc;
    securityGroup: SecurityGroup;
    repoNames: string[];
    cluster: Cluster;
  
    constructor(scope: cdk.Construct, id: string, repoNames: string[], props?: cdk.StackProps) {
        super(scope, id, props);

        //create vpc
        this.vpc = new Vpc(this, "MyVpc", {
            maxAzs: 2 // Default is all AZs in region
        });

        //create security group
        this.securityGroup = new SecurityGroup(this, 'mySG', {
            vpc: this.vpc,
            description: 'Allow port to connect to EC2',
            allowAllOutbound: true,
            securityGroupName: 'mySG',
        });
        this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'Allows SSH access from Internet');
        this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allows HTTP access from Internet');
        // this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(7070), 'Allows inbound traffic on this port');
        // this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(8080), 'Allows inbound traffic on this port');
        // this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(9090), 'Allows inbound traffic on this port');

        this.repoNames = repoNames; 

        //create ecr and cluster
        this.cluster = new Cluster(this, "project2", {
        clusterName: "project2",
        vpc: this.vpc
        });

        //create autoscallingGroup
        const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'asg', {
            vpc: this.vpc, 
            instanceType: new ec2.InstanceType('t2.micro'),
            machineImage: ecs.EcsOptimizedImage.amazonLinux(), 
            allowAllOutbound: true,
            minCapacity: 3,
            desiredCapacity: 3,
            maxCapacity: 4,
            healthCheck: autoscaling.HealthCheck.ec2(),
        });
        this.cluster.addAutoScalingGroup(autoScalingGroup);
    }

    public createEC2Service(ecrRepositories: ecr.Repository[], ports: number[]) {

        for(let i=0; i<this.repoNames.length; i++){
            //create task definition
            var taskDefinition = new ecs.Ec2TaskDefinition(this, "TaskDef"+this.repoNames[i]);
            taskDefinition.taskRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
            taskDefinition.executionRole?.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
            const container = taskDefinition.addContainer('Container'+this.repoNames[i], {
                image: ecs.ContainerImage.fromEcrRepository(ecrRepositories[i], "latest"),
                cpu:1000,
                memoryLimitMiB: 900,
                logging: ecs.LogDriver.awsLogs({streamPrefix: "cdk-ecs"}),
            });
            container.addPortMappings({
                containerPort: ports[i],
                hostPort: ports[i],
                protocol: ecs.Protocol.TCP,
            });
            //connect cluster with task using service
            const service = new ecs.Ec2Service(this, "service"+this.repoNames[i], {
                cluster: this.cluster,
                taskDefinition: taskDefinition,
            });

            //create load balancer
            const lb = new elbv2.ApplicationLoadBalancer(this, 'LB'+this.repoNames[i], {
                vpc: this.vpc,
                internetFacing: true,
                securityGroup: this.securityGroup,
            });
            const listener = lb.addListener('Listener'+this.repoNames[i], { 
                port: ports[i],
                protocol: elbv2.ApplicationProtocol.HTTP,
            });
            const target = listener.addTargets("t-"+this.repoNames[i], {
                port: ports[i],
                protocol: elbv2.ApplicationProtocol.HTTP,
                targets: [service],
                healthCheck: {
                    path: "/actuator/health",
                    healthyHttpCodes: "200",
                    interval: Duration.seconds(120),
                    timeout: Duration.seconds(20),
                    port: ""+ports[i]
                }
            });
        }
    }
}