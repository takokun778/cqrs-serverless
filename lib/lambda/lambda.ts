import { Role } from 'aws-cdk-lib/aws-iam';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export type Lambda = {
    [index: string]: Function;
};

type LambdaProp = {
    name: string;
    memorySize: number;
    role?: Role;
};

type LambdaProps = (scope: Construct, id: string) => LambdaProp[];

export const lambdaProps: LambdaProps = (scope: Construct, id: string) => {
    return [
        {
            name: 'consumer',
            memorySize: 128,
        },
        {
            name: 'scan',
            memorySize: 128,
        },
    ];
};
