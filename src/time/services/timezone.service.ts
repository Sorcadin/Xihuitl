import { dynamoDBService } from "../../services/dynamodb.service";
import { UserTimezone } from "../types";

// Table name caches
const table = process.env.TIMEZONE_TABLE || "xiuh-timezones";

/**
 * Service for managing user timezone data in DynamoDB
 */
export class UserTimezoneService {
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

    public async saveUser(userId: string, timezone: string, location: string): Promise<void> {
        const item: UserTimezone = {
            user_id: userId,
            timezone: timezone,
            display_location: location,
            fetched_at: Date.now()
        };

        await dynamoDBService.putEntity(table, {
            user_id: userId,
            timezone: timezone,
            display_location: location
        });

        this.cache.set(userId, item);
    }

    private async batchFetch(userIds: string[]): Promise<UserTimezone[]> {
        const keys = userIds.map(id => ({ user_id: id }));
        return dynamoDBService.batchGetEntities<UserTimezone>(table, keys);
    }
}

export const userTimezoneService = new UserTimezoneService();
