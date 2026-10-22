/**
 * The API.
 *
 * One Lambda per domain — auth, events, photos, join, rolls, challenges — all built
 * from the same entry (`services/api/src/lambda.ts`) and told which slice of the route
 * table they answer for. Every route in that table becomes an API Gateway route here,
 * and which ones are behind the Cognito authorizer is the table's `authorized` flag,
 * not a second list to keep in step.
 *
 * HTTP API rather than REST API because this surface is a plain proxy: HTTP API brings
 * CORS preflight, cheaper requests and JWT authorizers with it, and there is no
 * request/response mapping template anywhere in this design for a REST API to be
 * useful for.
 */
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { DOMAINS, ROUTES } from '../../../services/api/src/routes';
import type { StageConfig } from '../config';
import { servicePath } from './auth-stack';
import { DataStack } from './data-stack';
import { MediaStack } from './media-stack';

export class ApiStack extends Stack {
  public readonly apiUrl: string;

  constructor(
    scope: Construct,
    id: string,
    config: StageConfig,
    { data, media }: { data: DataStack; media: MediaStack },
    props?: StackProps,
  ) {
    super(scope, id, props);

    const removable = config.stage !== 'prod';

    /**
     * The key guest sessions are signed with.
     *
     * A secret rather than an environment variable: a signing key in a function's
     * environment is a key readable in the console from every function that never
     * signs anything, and this one is the only credential a guest has.
     */
    const guestSecret = new secretsmanager.Secret(this, 'GuestTokenSecret', {
      secretName: `foto/${config.stage}/guest-token`,
      description: 'HMAC key the foto API signs guest session tokens with',
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
      removalPolicy: removable ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    /** What every function is told, whatever domain it serves. */
    const sharedEnvironment: Record<string, string> = {
      FOTO_STAGE: config.stage,
      APP_BASE_URL: config.appUrl,
      CORS_ORIGIN: config.corsOrigin,
      PHOTOS_BUCKET: media.bucket.bucketName,
      PHOTOS_CDN_URL: media.cdnDomain,
      GUEST_TOKEN_SECRET_NAME: guestSecret.secretName,
      ...data.tableNames,
    };

    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `foto-${config.stage}`,
      description: 'foto — events, photos, rolls and the guest door',
      corsPreflight: {
        allowOrigins: [config.corsOrigin],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Foto-Guest'],
        exposeHeaders: ['ETag'],
        maxAge: Duration.hours(1),
      },
    });

    /**
     * The pool, read from Parameter Store rather than from the auth stack.
     *
     * A cross-stack reference would tie this stack's template to a specific app
     * client, and an export that a client id hangs off cannot be deleted while it is
     * imported — so replacing a client would mean tearing down the API too. Resolved at
     * deploy time, rotating a client is a parameter write and a redeploy of this stack.
     */
    const issuer = ssm.StringParameter.valueForStringParameter(
      this,
      `/foto/${config.stage}/cognito/issuer`,
    );
    const clientId = ssm.StringParameter.valueForStringParameter(
      this,
      `/foto/${config.stage}/cognito/client-id`,
    );

    const authorizer = new HttpJwtAuthorizer('HostAuthorizer', issuer, {
      jwtAudience: [clientId],
      identitySource: ['$request.header.Authorization'],
    });

    // --- one function per domain ---------------------------------------------
    const functions = new Map<string, NodejsFunction>();

    for (const domain of DOMAINS) {
      const fn = new NodejsFunction(this, `${domain}Function`, {
        entry: servicePath('src', 'lambda.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: Duration.seconds(29),
        memorySize: 512,
        description: `foto ${config.stage} — ${domain}`,
        environment: { ...sharedEnvironment, FOTO_DOMAIN: domain },
        // Everything is bundled: the AWS SDK the runtime ships is not the version
        // this code is typechecked against, and a mismatch between them is a bug that
        // only appears in the cloud.
        bundling: {
          externalModules: [],
          minify: false,
          sourceMap: true,
          target: 'node22',
        },
      });

      // The same grants for every domain. In a bigger service these would be per
      // function; here every domain reads and writes the same seven tables and the
      // same bucket, and pretending otherwise would be a policy that says something
      // the code does not.
      for (const table of data.tables) table.grantReadWriteData(fn);
      media.bucket.grantPut(fn);
      media.bucket.grantRead(fn);
      guestSecret.grantRead(fn);

      functions.set(domain, fn);
    }

    // --- a gateway route per line of the route table --------------------------
    const integrations = new Map<string, HttpLambdaIntegration>();
    for (const domain of DOMAINS) {
      integrations.set(
        domain,
        new HttpLambdaIntegration(`${domain}Integration`, functions.get(domain)!),
      );
    }

    for (const route of ROUTES) {
      const method = apigwv2.HttpMethod[route.method];
      httpApi.addRoutes({
        // HTTP API paths use the same `{param}` syntax the route table is written in.
        path: `/${route.path}`,
        methods: [method],
        integration: integrations.get(route.domain)!,
        // Host routes carry a Cognito authorizer; guest and public ones cannot — a
        // guest has no pool account — so they authenticate themselves inside the
        // handler with the token this API signed.
        authorizer: route.authorized ? authorizer : undefined,
      });
    }

    this.apiUrl = httpApi.apiEndpoint;

    // The function names are what a log search starts from, so they are output.
    new CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'NEXT_PUBLIC_API_URL for apps/web/.env.local',
    });
    new CfnOutput(this, 'GuestTokenSecretName', {
      value: guestSecret.secretName,
      description: 'Secrets Manager secret the guest-session HMAC key lives in',
    });
    for (const [domain, fn] of functions) {
      new CfnOutput(this, `${domain}FunctionName`, { value: fn.functionName });
    }

    void iam;
  }
}
