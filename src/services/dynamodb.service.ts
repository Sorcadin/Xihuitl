import { DynamoDBClient, ReturnValue, UpdateItemCommandOutput } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, BatchGetCommand, GetCommand, QueryCommand, UpdateCommand, 
    TransactWriteCommandInput, TransactWriteCommandOutput, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-2";

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Generic DynamoDB service for basic CRUD operations
 */
export class DynamoDBService {
    /**
     * Get a single item from a DynamoDB table
     */
    async getEntity<T>(tableName: string, key: Record<string, string>): Promise<T | null> {
        try {
            const command = new GetCommand({
                TableName: tableName,
                Key: key
            });
            const response = await docClient.send(command);
            
            if (response.Item) {
                return response.Item as T;
            }
            return null;
        } catch (e) {
            console.error(`DynamoDB Get Error (${tableName}):`, e);
            return null;
        }
    }

    /**
     * Put an item into a DynamoDB table
     */
    async putEntity(tableName: string, item: Record<string, any>): Promise<void> {
        try {
            await docClient.send(new PutCommand({
                TableName: tableName,
                Item: item
            }));
        } catch (e) {
            console.error(`DynamoDB Put Error (${tableName}):`, e);
            throw e;
        }
    }

    /**
     * Batch get items from a DynamoDB table
     * Handles batching automatically (DynamoDB limit is 100 items per batch)
     */
    async batchGetEntities<T>(
        tableName: string,
        keys: Array<Record<string, string>>,
        batchSize: number = 100
    ): Promise<T[]> {
        const results: T[] = [];
        
        for (let i = 0; i < keys.length; i += batchSize) {
            const chunk = keys.slice(i, i + batchSize);

            try {
                const command = new BatchGetCommand({
                    RequestItems: { [tableName]: { Keys: chunk } }
                });
                const response = await docClient.send(command);
                if (response.Responses && response.Responses[tableName]) {
                    results.push(...(response.Responses[tableName] as T[]));
                }
            } catch (e) {
                console.error(`DynamoDB Batch Get Error (${tableName}):`, e);
            }
        }
        
        return results;
    }

    /**
     * Query items from a DynamoDB table
     */
    async queryEntity<T>(
        tableName: string,
        keyConditionExpression: string,
        expressionAttributeValues: Record<string, any>,
        limit?: number,
        exclusiveStartKey?: Record<string, any>
    ): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }> {
        try {
            const command = new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: keyConditionExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                Limit: limit,
                ExclusiveStartKey: exclusiveStartKey
            });
            const response = await docClient.send(command);
            
            return {
                items: (response.Items || []) as T[],
                lastEvaluatedKey: response.LastEvaluatedKey
            };
        } catch (e) {
            console.error(`DynamoDB Query Error (${tableName}):`, e);
            return { items: [] };
        }
    }

    /**
     * Update specific attributes of an existing item in a DynamoDB table.
     */
    async updateEntity<T extends Record<string, any>>(
        tableName: string, 
        key: Record<string, string>, 
        updateExpression: string,
        expressionAttributeValues?: Record<string, any>,
        conditionExpression?: string,
        returnValues: ReturnValue = "NONE"
    ): Promise<{Attributes: T} | UpdateItemCommandOutput> {
        try {
            const command = new UpdateCommand({
                TableName: tableName,
                Key: key, // Primary key of the item to update
                UpdateExpression: updateExpression, // e.g., "SET last_claimed_at = :t"
                ExpressionAttributeValues: expressionAttributeValues, // e.g., { ":t": timestamp }
                ConditionExpression: conditionExpression, // Optional: attribute_exists(PK)
                ReturnValues: returnValues // "NONE" for no return
            });
            const response = await docClient.send(command);
            return response as {Attributes: T};
        } catch (err) {
            console.error(`DynamoDB Update Error (${tableName}):`, err);
            throw err;
        }
    }

    /**
     * Executes a set of synchronous write operations (Put, Update, Delete) as a single transaction.
     * All operations succeed, or all operations fail.
     * @param transactItems The array of transaction operations to execute.
     */
    async transactWriteItems(transactItems: TransactWriteCommandInput["TransactItems"]): Promise<TransactWriteCommandOutput> {
        if (!transactItems || transactItems.length === 0) {
            throw new Error("TransactItems array cannot be empty.");
        }
        try {
            const command = new TransactWriteCommand({
                TransactItems: transactItems,
                // You can optionally add ClientRequestToken for idempotency here
            });
    
            return await docClient.send(command);
        } catch (err) {
            console.error("DynamoDB Transaction Error:", err);
            throw err; // Re-throw to be handled by the calling adoption/trade logic
        }
    }
}

export const dynamoDBService = new DynamoDBService();
