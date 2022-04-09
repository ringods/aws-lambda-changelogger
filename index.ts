import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as iam from "@thinkinglabs/aws-iam-policy";

import * as table from './logtable';

const awsConfig = new pulumi.Config('aws');

const logtable = new table.LogTable('ringo-s3-objects', {
    environment: pulumi.getStack(),
    readCapacity: 21,
    writeCapacity: 20,
})

const iamForLambda = new aws.iam.Role("iamForLambda", {
    assumeRolePolicy: new iam.PolicyDocument([
        new iam.Statement({
            effect: "Allow",
            actions: [
                "sts:AssumeRole",
            ],
            principals: [
                new iam.ServicePrincipal('lambda.amazonaws.com')
            ]
        })
    ]).json,
});

new aws.iam.RolePolicyAttachment("iamLambdaAccessTable", {
    role: iamForLambda,
    policyArn: logtable.accessPolicy,
});

const accountId = pulumi.output(aws.getCallerIdentity({})).accountId;
const cloudWatchLogsWritePolicy = accountId.apply((accountId) => {
    return new iam.PolicyDocument([
        new iam.Statement({
            effect: "Allow",
            actions: [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            resources: [
                `arn:aws:logs:${awsConfig.require('region')}:${accountId}:*`
            ]
        }),
        new iam.Statement({
            effect: "Allow",
            actions: [
                "logs:CreateLogGroup"
            ],
            resources: [
                "*"
            ]
        })
    ])
})

const cloudWatchLogsAccessPolicy = new aws.iam.Policy("iamLambdaAccessCloudWatchLogs", {
    description: `Access policy to write to CloudWatch Logs`,
    policy: cloudWatchLogsWritePolicy.json
})

new aws.iam.RolePolicyAttachment("iamLambdaAccessCloudWatchLogs", {
    role: iamForLambda,
    policyArn: cloudWatchLogsAccessPolicy.arn,
});

const bucket = new aws.s3.BucketV2("ringods-objects-test", {
    bucketPrefix: 'ringods'
});

const func = new aws.lambda.Function("changeLogFunction", {
    code: new pulumi.asset.AssetArchive({
        ".": new pulumi.asset.FileArchive("./app"),
    }),
    runtime: "nodejs14.x",
    role: iamForLambda.arn,
    handler: "index.handler",
    environment: {
        variables: {
            TABLE_NAME: logtable.tableName
        }
    }
});

const allowBucket = new aws.lambda.Permission("bucketCanTriggerLambda", {
    action: "lambda:InvokeFunction",
    "function": func.arn,
    principal: "s3.amazonaws.com",
    sourceArn: bucket.arn,
});

const bucketNotification = new aws.s3.BucketNotification("bucketObjectCreatedNotification", {
    bucket: bucket.id,
    lambdaFunctions: [{
        lambdaFunctionArn: func.arn,
        events: ["s3:ObjectCreated:*"],
    }],
}, {
    dependsOn: [allowBucket],
});

