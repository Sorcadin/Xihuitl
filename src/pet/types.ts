// User profile types
export interface Profile {
    activePetId: string;
    lastDailyReward?: number;
}

// Pet system types
export type HungerState = 'full' | 'satisfied' | 'fine' | 'hungry' | 'starving';
export type PetType = 'beast' | 'plant' | 'insect' | 'construct' | 'undead' | 'fey' | 'dragon';

export interface Pet {
    name: string;
    species: string;
    hunger: number;
    lastFedAt: number;
    adoptedAt: number;
}

export interface SpeciesData {
    name: string;
    type: PetType;
}

// Item traits determine what actions can be performed with items
export type ItemTrait = 'edible'; // In the future: 'edible' | 'tradable' | 'etc'

/**
 * Inventory entity structure stored in DynamoDB
 * PK: User#${userId}
 * SK: Inventory#bag or Inventory#storage
 * items: Map of itemId to quantity for efficient atomic updates
 */
export interface Inventory {
    items: {
        [itemId: string]: number;
    };
}

/**
 * ItemEntity represents the structure of a single item with its quantity
 * Used as a component of the Item type
 */
export interface ItemEntity {
    itemId: string;
    quantity: number;
}

export interface ItemData {
    name: string;
    description: string;
    traits: ItemTrait[];
    // Optional properties based on traits
    hungerRestoration?: number; // Required if 'edible' trait is present
    // Future: value, rarity, etc.    
}

export interface Item extends ItemEntity, ItemData {}

// Constants
export const MAX_INVENTORY_CAPACITY = 50;
export const STORAGE_PAGE_SIZE = 20;
