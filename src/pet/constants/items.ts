import { Item, ItemData, ItemTrait } from '../types';

export const ITEM_CATALOG: Record<string, ItemData> = {
    // Omelette varieties
    OMELETTE_PLAIN: {
        name: 'Plain Omelette',
        description: 'Simple and classic',
        traits: ['edible'],
        hungerRestoration: 20
    },
    OMELETTE_MUSHROOM: {
        name: 'Mushroom Omelette',
        description: 'Savory and subtle',
        traits: ['edible'],
        hungerRestoration: 20
    },
    OMELETTE_PEPPER: {
        name: 'Pepper Omelette',
        description: 'Vibrant and zesty',
        traits: ['edible'],
        hungerRestoration: 20
    }
};

const OMELETTE_IDS = ['OMELETTE_PLAIN', 'OMELETTE_MUSHROOM', 'OMELETTE_PEPPER'];

export function getItemDataById(id: string): ItemData | undefined {
    return ITEM_CATALOG[id]
}

export function getRandomOmelette(): Item {
    const randomIndex = Math.floor(Math.random() * OMELETTE_IDS.length);
    const omeletteData = ITEM_CATALOG[OMELETTE_IDS[randomIndex]];
    return {
        itemId: OMELETTE_IDS[randomIndex],
        quantity: 1,
        ...omeletteData
    } as Item;
}

/**
 * Check if an item has a specific trait
 */
export function hasTrait(item: ItemData, trait: ItemTrait): boolean {
    return item.traits.includes(trait);
}
