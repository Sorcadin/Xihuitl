import { dynamoDBService } from "../../services/dynamodb.service";

const table = process.env.PETS_TABLE || "xiuh-pets";

interface DailyClaimItem {
    user_id: string;
    // last_claimed_at is stored as a number (milliseconds since epoch)
    last_claimed_at?: number; 
}

// Define the cooldown period (20 hours in milliseconds)
export const COOLDOWN_DURATION_MS = 20 * 60 * 60 * 1000;

export class DailyService {
    // public async checkRemainingTime(userId: string): Promise<number> {
    //     const lastClaimedAt = await dailyService.getLastClaimTime(userId);

    //     // Check if the cooldown period has passed
    //     if (lastClaimedAt) {
    //         const timeElapsed = Date.now() - lastClaimedAt.getTime(); 
    //         if (timeElapsed < COOLDOWN_DURATION_MS) {
    //             // The user is still on cooldown
    //             return COOLDOWN_DURATION_MS - timeElapsed;
    //         } 
    //     }
    //     return 0;
    // }

    // Fetches the last claim time
    public async getLastClaimTime(userId: string): Promise<Date | null> {
        const result = await dynamoDBService.getItem<DailyClaimItem>(table, { user_id: userId })

        if (result && result.last_claimed_at) {
            const lastClaimedTimestamp = result.last_claimed_at;
            return new Date(lastClaimedTimestamp);
        }
        
        // Return null if the user has no claim record
        return null;
    }
    
    // Updates the last claim time in the database
    public async setLastClaimTime(userId: string, timestamp: Date): Promise<void> {
        await dynamoDBService.updateItem(
            table,
            { user_id: userId }, 
            "SET last_claimed_at = :t",
            { ":t": timestamp.getTime() }
        );
    }
}

export const dailyService = new DailyService();
