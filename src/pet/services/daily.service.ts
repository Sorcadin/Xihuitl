import { dynamoDBService } from "../../services/dynamodb.service";
import { Profile } from "../types";

const table = process.env.PETS_TABLE || "xiuh-pets";
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
        const PK = `User#${userId}`;
        const SK = "Profile";

        const result = await dynamoDBService.getEntity<Profile>(table, {PK: PK, SK: SK})

        if (result && result.lastDailyReward) {
            const lastClaimedTimestamp = result.lastDailyReward;
            return new Date(lastClaimedTimestamp);
        }
        
        // Return null if the user has no claim record
        return null;
    }
    
    // Updates the last claim time in the database
    public async setLastClaimTime(userId: string, timestamp: Date): Promise<void> {
        const PK = `User#${userId}`;
        const SK = "Profile";

        await dynamoDBService.updateEntity(
            table, {PK: PK, SK: SK}, 
            "SET lastDailyReward = :t",
            { ":t": timestamp.getTime() },
            "attribute_exists(PK)",
        );
    }
}

export const dailyService = new DailyService();
