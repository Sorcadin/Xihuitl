import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, BatchGetCommand, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import * as dotenv from "dotenv";

dotenv.config();

const REGION = process.env.AWS_REGION || "us-east-2";

if (!REGION) {
    throw new Error("Missing AWS_REGION in environment. Set AWS_REGION in your .env file.");
}

const RESOLVED_REGION = REGION;

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: RESOLVED_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Generic table name resolver that checks environment variables first,
 * then falls back to SSM Parameter Store
 */
export async function resolveTableName(
    envVarName: string,
    ssmParameterName: string,
    cache: { value: string | null }
): Promise<string> {
    if (cache.value) {
        return cache.value;
    }

    // Try environment variable first
    const envValue = process.env[envVarName];
    if (envValue) {
        cache.value = envValue;
        return cache.value;
    }

    throw new Error(
        `Missing ${envVarName} in environment and unable to fetch from SSM Parameter Store. ` +
        `Set ${envVarName} in your .env file or ensure ${ssmParameterName} parameter exists in SSM.`
    );
}

/**
 * Generic DynamoDB service for basic CRUD operations
 */
export class DynamoDBService {
    /**
     * Get a single item from a DynamoDB table
     */
    async getItem<T>(tableName: string, key: Record<string, string>): Promise<T | null> {
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
    async putItem(tableName: string, item: Record<string, any>): Promise<void> {
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
    async batchGetItems<T>(
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
    async queryItems<T>(
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
    async updateItem(
        tableName: string, 
        key: Record<string, string>, 
        updateExpression: string,
        expressionAttributeValues: Record<string, any>,
        expressionAttributeNames?: Record<string, string>
    ): Promise<void> {
        try {
            const command = new UpdateCommand({
                TableName: tableName,
                Key: key, // Primary key of the item to update
                UpdateExpression: updateExpression, // e.g., "SET last_claimed_at = :t"
                ExpressionAttributeValues: expressionAttributeValues, // e.g., { ":t": timestamp }
                ExpressionAttributeNames: expressionAttributeNames, // Optional: if attribute names are reserved words
                ReturnValues: "NONE" // We don't need to return the updated item
            });
            await docClient.send(command);
        } catch (e) {
            console.error(`DynamoDB Update Error (${tableName}):`, e);
            throw e;
        }
    }
}

export const dynamoDBService = new DynamoDBService();
