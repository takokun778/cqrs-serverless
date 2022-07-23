import { Role } from 'aws-cdk-lib/aws-iam';
import { Function } from 'aws-cdk-lib/aws-lambda';

export type Lambda = {
    [index: string]: Function;
};

type LambdaProp = {
    name: string;
    memorySize: number;
    role?: Role;
};

export const lambdaProps: LambdaProp[] = [
    // {
    //     name: 'command',
    //     memorySize: 128,
    // },
    // {
    //     name: 'query',
    //     memorySize: 128,
    // },
    {
        name: 'consumer',
        memorySize: 128,
    },
];
