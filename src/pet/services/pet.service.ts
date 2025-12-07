import { dynamoDBService, resolveTableName } from "../../services/dynamodb.service";
import { Pet, HungerState } from "../types";

// Table name cache
const petsTableCache: { value: string | null } = { value: null };

async function resolvePetsTableName(): Promise<string> {
    return resolveTableName("PETS_TABLE", "/xiuh/pets-table-name", petsTableCache);
}

const HUNGER_DECAY_RATE = 1; // points per hour
const HUNGER_MAX = 100;

/**
 * Calculate current hunger value based on last_fed_at timestamp
 */
function calculateHungerValue(lastFedAt: number): number {
    const now = Date.now();
    const hoursSinceFed = (now - lastFedAt) / (1000 * 60 * 60);
    const hungerLost = hoursSinceFed * HUNGER_DECAY_RATE;
    return Math.max(0, HUNGER_MAX - hungerLost);
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
    private cache: Map<string, Pet> = new Map();
    private cacheTTL = 1000 * 60 * 60; // 1 hour

    private isFresh(userId: string): boolean {
        const item = this.cache.get(userId);
        if (!item) return false;
        const cachedAt = (item as any).cached_at;
        if (!cachedAt) return false;
        return (Date.now() - cachedAt) < this.cacheTTL;
    }

    public async getPet(userId: string): Promise<Pet | null> {
        if (this.isFresh(userId)) {
            return this.cache.get(userId)!;
        }

        const tableName = await resolvePetsTableName();
        const pet = await dynamoDBService.getItem<Pet>(tableName, { user_id: userId });
        
        if (pet) {
            (pet as any).cached_at = Date.now();
            this.cache.set(userId, pet);
        }
        
        return pet;
    }

    public async adoptPet(userId: string, speciesId: string, name: string): Promise<void> {
        const tableName = await resolvePetsTableName();
        const now = Date.now();
        
        const pet: Pet = {
            user_id: userId,
            species_id: speciesId,
            name: name,
            last_fed_at: now,
            adopted_at: now
        };

        await dynamoDBService.putItem(tableName, pet);
        (pet as any).cached_at = Date.now();
        this.cache.set(userId, pet);
    }

    public async renamePet(userId: string, name: string): Promise<void> {
        const pet = await this.getPet(userId);
        if (!pet) {
            throw new Error("Pet not found");
        }
        
        const tableName = await resolvePetsTableName();
        const updatedPet: Pet = {
            ...pet,
            name: name
        };

        await dynamoDBService.putItem(tableName, updatedPet);
        (updatedPet as any).cached_at = Date.now();
        this.cache.set(userId, pet);
    }

    public async feedPet(userId: string, hungerRestoration: number): Promise<{ newHunger: number; newState: HungerState }> {
        const pet = await this.getPet(userId);
        if (!pet) {
            throw new Error("Pet not found");
        }

        const currentHunger = calculateHungerValue(pet.last_fed_at);
        const newHunger = Math.min(HUNGER_MAX, currentHunger + hungerRestoration);
        const newState = getHungerState(newHunger);

        const tableName = await resolvePetsTableName();
        const updatedPet: Pet = {
            ...pet,
            last_fed_at: Date.now()
        };

        await dynamoDBService.putItem(tableName, updatedPet);
        (updatedPet as any).cached_at = Date.now();
        this.cache.set(userId, updatedPet);

        return { newHunger, newState };
    }

    public getCurrentHunger(pet: Pet): { value: number; state: HungerState } {
        const value = calculateHungerValue(pet.last_fed_at);
        const state = getHungerState(value);
        return { value, state };
    }
}

export const petService = new PetService();

