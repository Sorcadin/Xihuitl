// Pet system types
export type HungerState = 'full' | 'satisfied' | 'fine' | 'hungry' | 'starving';

export interface Pet {
    user_id: string;
    species_id: string;
    name: string;
    last_fed_at: number;
    adopted_at: number;
}

export interface PetSpecies {
    id: string;
    name: string;
    image_url: string;
}

export interface InventoryItem {
    user_id: string;
    item_id: string;
    quantity: number;
    location: 'inventory' | 'storage';
}

export interface ItemDefinition {
    id: string;
    name: string;
    hungerRestoration: number;
}

// Constants
export const MAX_INVENTORY_CAPACITY = 50;
export const STORAGE_PAGE_SIZE = 20;

