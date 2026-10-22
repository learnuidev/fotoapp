/**
 * The tables.
 *
 * Built from `services/api/src/types/collections.ts` rather than from a list here,
 * which is the one decision in this file worth explaining: an index the API can query
 * that the table cannot serve is a bug that only appears in the cloud, after a
 * deploy. Reading the same description the handlers read makes that impossible — the
 * collections file names the key and the indexes, and this stack turns each one into
 * a table.
 */
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';
import { COLLECTIONS } from '../../../services/api/src/types/collections';
import type { StageConfig } from '../config';

export class DataStack extends Stack {
  /** Table names by the environment variable the API reads them from. */
  public readonly tableNames: Record<string, string> = {};
  public readonly tables: dynamodb.Table[] = [];

  constructor(scope: Construct, id: string, config: StageConfig, props?: StackProps) {
    super(scope, id, props);

    const removable = config.stage !== 'prod';

    for (const collection of COLLECTIONS) {
      const table = new dynamodb.Table(this, `${capitalise(collection.name)}Table`, {
        tableName: `foto-${config.stage}-${collection.name}`,
        partitionKey: { name: collection.key, type: AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: !removable },
        removalPolicy: removable ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      });

      for (const [field, index] of Object.entries(collection.indexes)) {
        // The index's partition key is the attribute the handlers query by, and its
        // sort key — when it has one — is the attribute they order by.
        table.addGlobalSecondaryIndex({
          indexName: index.name,
          partitionKey: { name: field, type: AttributeType.STRING },
          ...(index.sortKey
            ? { sortKey: { name: index.sortKey, type: AttributeType.NUMBER } }
            : {}),
          projectionType: dynamodb.ProjectionType.ALL,
        });
      }

      this.tables.push(table);
      this.tableNames[collection.tableEnv] = table.tableName;

      new CfnOutput(this, `${capitalise(collection.name)}TableName`, {
        value: table.tableName,
        description: `DynamoDB table behind the ${collection.name} collection`,
      });
    }

    // A photo counts as slow if a query takes seconds; the console's analytics read
    // several tables per page, and this is what would tell us.
    void Duration;
  }
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
