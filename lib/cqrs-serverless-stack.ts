import { aws_apigateway, aws_dynamodb, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { LogGroupLogDestination } from 'aws-cdk-lib/aws-apigateway';
import { StreamViewType } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, Policy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Function, FunctionProps, Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as path from 'path';

import { goCode } from './lambda/code';
import { Lambda, lambdaProps } from './lambda/lambda';

export class CQRSServerlessStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const bucket = new Bucket(this, `${id}-s3-bucket`, {
            bucketName: `${id}-s3-bucket`,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        });

        const eventTable = new aws_dynamodb.Table(this, `${id}-dynamodb-event-table`, {
            tableName: `${id}-dynamodb-event-table`,
            partitionKey: {
                name: 'id',
                type: aws_dynamodb.AttributeType.STRING,
            },
            billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            stream: StreamViewType.NEW_IMAGE,
        });

        const eventTablePolicy = new Policy(this, `${id}-dynamodb-event-table-policy`, {
            statements: [
                new PolicyStatement({
                    actions: ['dynamodb:*'],
                    effect: Effect.ALLOW,
                    resources: [eventTable.tableArn],
                }),
            ],
        });

        const eventTableRole = new Role(this, `${id}-dynamodb-event-table-role`, {
            assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
        });

        eventTableRole.attachInlinePolicy(eventTablePolicy);

        const eventPutIntegration = new aws_apigateway.AwsIntegration({
            service: 'dynamodb',
            action: 'PutItem',
            options: {
                credentialsRole: eventTableRole,
                requestTemplates: {
                    'application/json': `{
                        "TableName": "${eventTable.tableName}",
                        "Item": {
                            "id": {
                                "S": "$context.requestId"
                            },
                            "command": {
                                "S": "$input.path('$.command')"
                            }
                        }
                    }`,
                },
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseTemplates: {
                            'application/json': `{
                                "requestId": "$context.requestId"
                            }`,
                        },
                    },
                ],
            },
        });

        const lambda: Lambda = {};

        lambdaProps(this, id).forEach((prop) => {
            const cwd = path.join(__dirname, '..', `lambda/${prop.name}`);

            const lambdaProps: FunctionProps = {
                functionName: `${id}-lambda-${prop.name}`,
                architecture: Architecture.ARM_64,
                memorySize: prop.memorySize,
                timeout: Duration.seconds(10),
                logRetention: RetentionDays.ONE_WEEK,
                runtime: Runtime.PROVIDED_AL2,
                handler: 'bootstrap',
                code: goCode(cwd),
                role: prop.role,
                // TODO 環境変数の管理
                environment: {
                    S3_BUCKET_NAME: bucket.bucketName,
                },
            };

            const func = new Function(this, `${id}-lambda-${prop.name}`, lambdaProps);

            lambda[prop.name] = func;
        });

        lambda['consumer'].addEventSource(
            new DynamoEventSource(eventTable, {
                startingPosition: StartingPosition.LATEST,
            })
        );

        bucket.addToResourcePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['s3:PutObject'],
                principals: [lambda['consumer'].grantPrincipal],
                resources: [`${bucket.bucketArn}/*`],
            })
        );

        const apiLogGroup = new LogGroup(this, `${id}-log-group-apigateway`, {
            logGroupName: `/aws/apigateway/${id}-apigateway`,
            retention: RetentionDays.ONE_WEEK,
        });

        const root = new aws_apigateway.RestApi(this, `${id}-apigateway`, {
            restApiName: `${id}-api-gateway`,
            deployOptions: {
                accessLogDestination: new LogGroupLogDestination(apiLogGroup),
                loggingLevel: aws_apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
                metricsEnabled: true,
            },
        });

        const apiKey = root.addApiKey(`${id}-api-key`, {
            apiKeyName: `${id}-api-key`,
        });

        const usage = root.addUsagePlan(`${id}-api-usage-plan`);
        usage.addApiKey(apiKey);
        usage.addApiStage({
            stage: root.deploymentStage,
        });

        const api = root.root.addResource('api');

        const commandApi = api.addResource('command');

        commandApi.addMethod('POST', eventPutIntegration, {
            apiKeyRequired: true,
            methodResponses: [
                {
                    statusCode: '200',
                },
            ],
        });
    }
}
