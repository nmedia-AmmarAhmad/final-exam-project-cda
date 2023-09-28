import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export class WebappStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'TheVPC', {
      cidr: '10.20.0.0/16',
    });

    // Create an Internet Gateway and attach it to the VPC
    const igw = new ec2.CfnInternetGateway(this, 'MyIgw');
    const igwAttachment = new ec2.CfnVPCGatewayAttachment(this, 'MyIgwAttachment', {
      vpcId: vpc.vpcId,
      internetGatewayId: igw.ref,
    });

    // Create a public route table and add a default route to the Internet Gateway
    const publicRouteTable = new ec2.CfnRouteTable(this, 'PublicRouteTable', {
      vpcId: vpc.vpcId,
    });

    new ec2.CfnRoute(this, 'DefaultRoute', {
      routeTableId: publicRouteTable.attrRouteTableId,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: igw.ref,
    });

    // Create subnets in AZs with dynamic public IPs
    const subnet1 = new ec2.Subnet(this, 'Subnet1', {
      vpcId: vpc.vpcId,
      availabilityZone: 'us-east-1a', // Replace with your desired AZ
      cidrBlock: '10.20.1.0/24',
      mapPublicIpOnLaunch: true,
    });

    const subnet2 = new ec2.Subnet(this, 'Subnet2', {
      vpcId: vpc.vpcId,
      availabilityZone: 'us-east-1b', // Replace with your desired AZ
      cidrBlock: '10.20.2.0/24',
      mapPublicIpOnLaunch: true,
    });

    const subnet3 = new ec2.Subnet(this, 'Subnet3', {
      vpcId: vpc.vpcId,
      availabilityZone: 'us-east-1c', // Replace with your desired AZ
      cidrBlock: '10.20.3.0/24',
      mapPublicIpOnLaunch: true,
    });

    const subnet4 = new ec2.Subnet(this, 'Subnet4', {
      vpcId: vpc.vpcId,
      availabilityZone: 'us-east-1d', // Replace with your desired AZ
      cidrBlock: '10.20.4.0/24',
      mapPublicIpOnLaunch: true,
    });

    // Create a NAT Gateway in the public subnet1 and associate an Elastic IP
    const eip = new ec2.CfnEIP(this, 'EIP');

    const natGateway = new ec2.CfnNatGateway(this, 'NATGateway', {
      subnetId: subnet1.subnetId,
      allocationId: eip.attrAllocationId,
    });

    // Create a private route table and add a route to the NAT Gateway
    const privateRouteTable = new ec2.CfnRouteTable(this, 'PrivateRouteTable', {
      vpcId: vpc.vpcId,
    });

    new ec2.CfnRoute(this, 'PrivateRoute', {
      routeTableId: privateRouteTable.attrRouteTableId,
      destinationCidrBlock: '0.0.0.0/0',
      natGatewayId: natGateway.ref,
    });

    // Create a security group for EC2 instances
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'Ec2SecurityGroup', {
      vpc,
      description: 'Allow SSH and HTTP inbound traffic',
    });

    ec2SecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH');
    ec2SecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP');

    // Create an EC2 key pair
    const ec2KeyPair = new ec2.CfnKeyPair(this, 'MyEC2KeyPairAMMAR', {
      keyName: 'MyKeyPairNameAMMAR', // Replace with your desired key pair name
    });

    // Create an EC2 instance in a public subnet
    const ec2InstancePublic = new ec2.Instance(this, 'Ec2InstancePublic', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux(),
      keyName: ec2KeyPair.keyName,
      securityGroup: ec2SecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // Create an Application Load Balancer (ALB)
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
    });

    // Create a target group for the ALB
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      port: 80, // Assuming your EC2 instances listen on port 80
      vpc,
    });
    
        // Create an Auto Scaling group
    const asg = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux(),
      minCapacity: 2, // Minimum number of instances
      maxCapacity: 4, // Maximum number of instances
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Add instances to the target group for Auto Scaling
    targetGroup.addTarget(asg);

    // Create a listener for the ALB and attach the target group
    const listener = alb.addListener('Listener', {
      port: 80, // ALB listens on port 80
      defaultAction: elbv2.ListenerAction.fixedResponse(200, {
        contentType: 'text/plain',
        messageBody: 'Hello from the ALB!',
      }),
    });

    listener.addTargets('TargetGroup', {
      targets: [asg],
      port: 80,
      priority: 1,
    });

    // Open the ALB security group to the world (customize as needed)
    alb.connections.allowFromAnyIpv4(ec2.Port.tcp(80), 'Allow HTTP inbound');

    // Output the DNS name of the ALB for reference
    new cdk.CfnOutput(this, 'ALBDNSName', {
      value: alb.loadBalancerDnsName,
    });
  }
}

const app = new cdk.App();
new WebappStack(app, 'MyStack');
