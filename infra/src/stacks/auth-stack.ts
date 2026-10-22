/**
 * The host account.
 *
 * A Cognito user pool with email as the sign-in name, no password policy heroics, and
 * a pre-sign-up trigger that confirms the address without asking for a code. The
 * trigger is the interesting part: this is a product where somebody makes one account
 * to run one evening, and an email round trip between "make an account" and "print
 * the table card" is friction with nothing behind it on a dev stage. A production
 * stage would delete the trigger and send the code.
 *
 * Guests are not in this pool and never will be — that is the product's whole shape,
 * and it is why the API has a second kind of token for them.
 */
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';
import { resolve } from 'node:path';
import type { StageConfig } from '../config';

/**
 * A path inside `services/api`, from this file.
 *
 * The API's source is the Lambda entry point, so this app has to say where it is. It
 * is resolved from the stack file rather than from the working directory because
 * `cdk` can be run from the repository root or from `infra/`.
 */
export function servicePath(...parts: string[]): string {
  return resolve(__dirname, '..', '..', '..', 'services', 'api', ...parts);
}

export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, config: StageConfig, props?: StackProps) {
    super(scope, id, props);

    const removable = config.stage !== 'prod';

    /**
     * Confirms a new host without an email.
     *
     * A trigger function has no HTTP in front of it and no identity: it receives the
     * sign-up event, and what it writes into `response` is what happens next.
     */
    const preSignUp = new NodejsFunction(this, 'PreSignUp', {
      entry: servicePath('src', 'functions', 'auth.ts'),
      handler: 'preSignUpTrigger',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      description: `foto ${config.stage} pre-sign-up: confirm and verify an address without an email`,
      bundling: { externalModules: [] },
    });

    this.userPool = new cognito.UserPool(this, 'HostPool', {
      userPoolName: `foto-${config.stage}-hosts`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: false,
        requireLowercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      // Hosts are created by hosts, one per evening, and an admin does not exist here.
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      lambdaTriggers: { preSignUp },
      removalPolicy: removable ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'HostClient', {
      userPool: this.userPool,
      userPoolClientName: `foto-${config.stage}-app`,
      // A browser client with no secret: Amplify runs in the page, and a secret
      // shipped to a browser is not a secret.
      generateSecret: false,
      authFlows: { userSrp: true, userPassword: true },
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    // The trigger is the pool's to invoke; nothing else may.
    preSignUp.addPermission('InvokedByPool', {
      principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      sourceArn: this.userPool.userPoolArn,
    });

    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'NEXT_PUBLIC_COGNITO_USER_POOL_ID for apps/web/.env.local',
    });
    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'NEXT_PUBLIC_COGNITO_CLIENT_ID for apps/web/.env.local',
    });
    new CfnOutput(this, 'UserPoolIssuer', {
      value: this.userPool.userPoolProviderUrl,
      description: 'The JWT issuer the API authorizer trusts',
    });
  }
}
