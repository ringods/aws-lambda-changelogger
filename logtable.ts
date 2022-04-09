
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as iam from "@thinkinglabs/aws-iam-policy";

export interface LogTableArgs {
    environment: string,
    readCapacity: number,
    writeCapacity: number,
}

export class LogTable extends pulumi.ComponentResource {

    public tableName: pulumi.Output<string>;
    public accessPolicy : pulumi.Output<string>;

    constructor(name: string, args: LogTableArgs, opts?: pulumi.ComponentResourceOptions) {
        super('ringods:db:LogTable',name, args, opts);

        const logTable = new aws.dynamodb.Table(name, {
            attributes: [
                {
                    name: "Filename",
                    type: "S",
                },
                {
                    name: "Timestamp",
                    type: "S",
                },
            ],
            billingMode: "PROVISIONED",
            globalSecondaryIndexes: [],
            hashKey: "Filename",
            rangeKey: "Timestamp",
            readCapacity: args.readCapacity,
            tags: {
                Environment: args.environment,
                Name: "bucket-changes",
            },
            // Lost time on this: https://github.com/hashicorp/terraform-provider-aws/issues/10304
            ttl: {
                attributeName: "TimeToExist",
                enabled: true,
            },
            writeCapacity: args.writeCapacity,
        },
        {
            parent: this
        });

        const policy = logTable.arn.apply((arn) => {
            return new iam.PolicyDocument(
                [new iam.Statement({
                    effect: "Allow",
                    actions: [
                        "dynamodb:BatchGetItem",
                        "dynamodb:GetItem",
                        "dynamodb:Query",
                        "dynamodb:Scan",
                        "dynamodb:BatchWriteItem",
                        "dynamodb:PutItem",
                        "dynamodb:UpdateItem"
                    ],
                    resources: [arn]
                })]
            ).json
        })

        const tableAccessPolicy = new aws.iam.Policy(`${name}-access`, {
            description: `Access policy to a specific LogTable`,
            namePrefix: name,
            policy: policy
        }, {
            parent: this
        })

        this.tableName = logTable.name;
        this.accessPolicy = tableAccessPolicy.arn;
        this.registerOutputs({
            accessPolicy: tableAccessPolicy.arn,
        });

    }
}
