import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import * as dotenv from "dotenv";
import { UserTimezone } from "../types";

dotenv.config();

const REGION = process.env.AWS_REGION;
const TABLE_NAME = process.env.DYNAMO_TABLE;

if (!REGION) {
    throw new Error("Missing AWS_REGION in environment. Set AWS_REGION in your .env file.");
}

if (!TABLE_NAME) {
    throw new Error("Missing DYNAMO_TABLE in environment. Set DYNAMO_TABLE in your .env file.");
}

const RESOLVED_REGION = REGION;
const RESOLVED_TABLE = TABLE_NAME;

const client = new DynamoDBClient({ region: RESOLVED_REGION });
const docClient = DynamoDBDocumentClient.from(client);

class AWSService {
    private cache: Map<string, UserTimezone> = new Map();
    private cacheTTL = 1000 * 60 * 60 * 24 * 7; // 7 Days

    private isFresh(userId: string): boolean {
        const item = this.cache.get(userId);
        if (!item || !item.fetched_at) return false;
        return (Date.now() - item.fetched_at) < this.cacheTTL;
    }

    public async getUsers(userIds: string[]): Promise<UserTimezone[]> {
        const finalResults: UserTimezone[] = [];
        const toFetch: string[] = [];

        for (const uid of userIds) {
            if (this.isFresh(uid)) {
                finalResults.push(this.cache.get(uid)!);
            } else {
                toFetch.push(uid);
            }
        }

        if (toFetch.length > 0) {
            const fetched = await this.batchFetch(toFetch);
            for (const item of fetched) {
                item.fetched_at = Date.now();
                this.cache.set(item.user_id, item);
                finalResults.push(item);
            }
        }
        return finalResults;
    }

    public async getSingleUser(userId: string): Promise<UserTimezone | null> {
        const res = await this.getUsers([userId]);
        return res.length > 0 ? res[0] : null;
    }

    public async saveUser(userId: string, timezone: string, location: string) {
        const item: UserTimezone = {
            user_id: userId,
            timezone: timezone,
            display_location: location,
            fetched_at: Date.now()
        };

        await docClient.send(new PutCommand({
            TableName: RESOLVED_TABLE,
            Item: { user_id: userId, timezone: timezone, display_location: location }
        }));

        this.cache.set(userId, item);
    }

    private async batchFetch(userIds: string[]): Promise<UserTimezone[]> {
        const results: UserTimezone[] = [];
        for (let i = 0; i < userIds.length; i += 100) {
            const chunk = userIds.slice(i, i + 100);
            const keys = chunk.map(id => ({ user_id: id }));

            try {
                const command = new BatchGetCommand({
                    RequestItems: { [RESOLVED_TABLE]: { Keys: keys } }
                });
                const response = await docClient.send(command);
                if (response.Responses && response.Responses[RESOLVED_TABLE]) {
                    results.push(...(response.Responses[RESOLVED_TABLE] as UserTimezone[]));
                }
            } catch (e) {
                console.error("DynamoDB Batch Error:", e);
            }
        }
        return results;
    }
}

export const awsService = new AWSService();