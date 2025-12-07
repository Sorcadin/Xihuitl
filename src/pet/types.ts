// Pet system types
export type HungerState = 'full' | 'satisfied' | 'fine' | 'hungry' | 'starving';
export type PetType = 'beast' | 'plant' | 'insect' | 'construct' | 'undead' | 'fey' | 'dragon';

export interface Pet {
    user_id: string;
    name: string;
    species_id: string;
    last_fed_at: number;
    adopted_at: number;
}

export interface PetSpecies {
    id: string;
    name: string;
    type: PetType;
    image_url: string;
}

// Item traits determine what actions can be performed with items
export type ItemTrait = 'edible'; // In the future: 'edible' | 'tradable' | 'etc'

export interface InventoryItem {
    user_id: string;
    item_id: string;
    quantity: number;
    location: 'inventory' | 'storage';
}

export interface ItemDefinition {
    id: string;
    name: string;
    description: string;
    traits: ItemTrait[];
    // Optional properties based on traits
    hungerRestoration?: number; // Required if 'edible' trait is present
    // Future: value, rarity, etc.
}

// Constants
export const MAX_INVENTORY_CAPACITY = 50;
export const STORAGE_PAGE_SIZE = 20;
