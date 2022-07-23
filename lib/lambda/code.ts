import { AssetHashType, AssetStaging } from 'aws-cdk-lib';
import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import { execSync } from 'child_process';
import * as path from 'path';

const handler = 'bootstrap';

export const goCode = (cwd: string) => {
    return Code.fromAsset(cwd, {
        assetHashType: AssetHashType.OUTPUT,
        bundling: {
            local: {
                tryBundle(outputDir: string): boolean {
                    try {
                        execSync('go version', {
                            stdio: ['ignore', process.stderr, 'inherit'],
                        });
                    } catch {
                        process.stderr.write('not found go');
                        return false;
                    }
                    execSync(
                        [`GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o ${path.join(outputDir, handler)}`].join(
                            ' && '
                        ),
                        {
                            stdio: ['ignore', process.stderr, 'inherit'],
                            cwd,
                        }
                    );
                    return true;
                },
            },
            image: Runtime.GO_1_X.bundlingImage,
            command: [
                'bash',
                '-c',
                `GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o ${path.join(
                    AssetStaging.BUNDLING_OUTPUT_DIR,
                    handler
                )}`,
            ],
            user: 'root',
        },
    });
};
