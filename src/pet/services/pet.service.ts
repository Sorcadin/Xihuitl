import { dynamoDBService } from "../../services/dynamodb.service";
import { Profile, Pet, HungerState } from "../types";
import { randomUUID } from 'crypto';

const tableName = process.env.PETS_TABLE || "xiuh-pets";

const HUNGER_DECAY_RATE = 1; // points per hour
const HUNGER_MAX = 100;

/**
 * Calculate current hunger value based on last_fed_at timestamp
 */
function calculateHungerValue(currentTime: number, lastHunger: number, lastFedAt: number): number {
    const hoursSinceFed = (currentTime - lastFedAt) / (1000 * 60 * 60);
    const hungerLost = hoursSinceFed * HUNGER_DECAY_RATE;
    return Math.max(0, lastHunger - hungerLost);
}

/**
 * Convert numeric hunger value to hunger state
 */
export function getHungerState(hungerValue: number): HungerState {
    if (hungerValue > 80) return 'full';
    if (hungerValue > 60) return 'satisfied';
    if (hungerValue > 40) return 'fine';
    if (hungerValue > 20) return 'hungry';
    return 'starving';
}

/**
 * Service for managing pet data in DynamoDB
 */
export class PetService {
    private petCache: Map<string, Pet> = new Map();
    private cacheTTL = 1000 * 60 * 60; // 1 hour

    private isFresh(petId: string): boolean {
        const item = this.petCache.get(petId);
        if (!item) return false;
        const cachedAt = (item as any).cached_at;
        if (!cachedAt) return false;
        return (Date.now() - cachedAt) < this.cacheTTL;
    }

    public async getProfile(userId: string): Promise<Profile | null> {
        const PK = `User#${userId}`;
        const SK = 'Profile'

        const profile = await dynamoDBService.getEntity<Profile>(tableName, {PK: PK, SK: SK});

        return profile
    }

    public async getPet(userId:string, petId: string): Promise<Pet | null> {
        if (this.isFresh(petId)) {
            return this.petCache.get(petId)!;
        }

        const PK = `User#${userId}`;
        const SK = `Pet#${petId}`

        const pet = await dynamoDBService.getEntity<Pet>(tableName, {PK: PK, SK: SK});
        
        if (pet) {
            (pet as any).cached_at = Date.now();
            this.petCache.set(petId, pet);
        }
        
        return pet;
    }

    /**
     * Adopt a new pet for a user
     * Enforces one pet per user limit via DynamoDB transaction conditions
     * @throws TransactionCanceledException if user already has a pet
     */
    public async adoptPet(userId: string, name: string, species: string): Promise<void> {
        const now = Date.now();
        
        const pet: Pet = {
            species: species,
            name: name,
            hunger: HUNGER_MAX,
            lastFedAt: now,
            adoptedAt: now
        };

        const PK = `User#${userId}`;
        const petId = randomUUID();
        const newPetSK = `Pet#${petId}`;

        const transactItems = [
            {
                Put: {
                    TableName: tableName,
                    Item: {PK: PK, SK: newPetSK, ...pet},
                    ConditionExpression: "attribute_not_exists(SK)",
                },
            },
            {
                Put: {
                    TableName: tableName,
                    Item: { PK: PK, SK: "Profile", activePetId: petId },
                    // Ensure user doesn't already have a pet (enforces 1 pet per user limit)
                    // This works for: 1) New users (Profile doesn't exist), 2) Existing users without pet
                    // Remove this condition if you want to allow multiple pets per user
                    ConditionExpression: "attribute_not_exists(activePetId)",
                },
            },
        ];

        await dynamoDBService.transactWriteItems(transactItems);

        (pet as any).cached_at = Date.now();
        this.petCache.set(petId, pet);
    }

    public async renamePet(userId: string, petId: string, newName: string): Promise<void> {
        const PK = `User#${userId}`;
        const SK = `Pet#${petId}`

        await dynamoDBService.updateEntity(
            tableName, 
            // Key: PK and SK identify the specific Pet Entity
            { PK: PK, SK: SK },
            "SET #name = :newName",
            {":newName": newName},
            "attribute_exists(PK)", 
        ); 

        const updatedPet: Pet = {
            ...this.petCache.get(petId)!,
            name: newName
        };
        (updatedPet as any).cached_at = Date.now();
        this.petCache.set(petId, updatedPet);
    }

    public async feedPet(userId: string, petId: string, hungerRestoration: number): Promise<{ newHunger: number; newState: HungerState }> {
        // Get lastFedAt from cache or DB
        let pet: Pet | null;
        if (this.isFresh(petId)) {
            pet = this.petCache.get(petId)!;
        } else {
            pet = await this.getPet(userId, petId);
        }

        if (!pet) {
            throw new Error(`Pet ${petId} not found for user ${userId}`);
        }

        const currentTime = Date.now();

        // Apply hunger restoration
        const currentHunger = calculateHungerValue(currentTime, pet.hunger, pet.lastFedAt);
        
        const newHunger = Math.min(HUNGER_MAX, currentHunger + hungerRestoration);
        const newState = getHungerState(newHunger);

        const PK = `User#${userId}`;
        const SK = `Pet#${petId}`;

        // Step 5: Update lastFedAt in DynamoDB
        await dynamoDBService.updateEntity(
            tableName, 
            { PK: PK, SK: SK },
            "SET lastFedAt = :t",
            { ":t": currentTime },
            "attribute_exists(PK)", 
        );

        // Step 6: Update the cache
        const updatedPet: Pet = {
            ...pet,
            hunger: newHunger,
            lastFedAt: currentTime
        };
        (updatedPet as any).cached_at = Date.now();
        this.petCache.set(petId, updatedPet);

        return { newHunger, newState };
    }

    public getCurrentHunger(pet: Pet): { value: number; state: HungerState } {
        const value = calculateHungerValue(Date.now(), pet.hunger, pet.lastFedAt);
        const state = getHungerState(value);
        return { value, state };
    }
}

export const petService = new PetService();

