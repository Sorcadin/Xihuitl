import { ItemDefinition, ItemTrait } from '../types';

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
    // Omelette varieties
    OMELETTE_PLAIN: {
        id: 'OMELETTE_PLAIN',
        name: 'Plain Omelette',
        description: '',
        traits: ['edible'],
        hungerRestoration: 20
    },
    OMELETTE_MUSHROOM: {
        id: 'OMELETTE_MUSHROOM',
        name: 'Mushroom Omelette',
        description: '',
        traits: ['edible'],
        hungerRestoration: 20
    },
    OMELETTE_PEPPER: {
        id: 'OMELETTE_PEPPER',
        name: 'Pepper Omelette',
        description: '',
        traits: ['edible'],
        hungerRestoration: 20
    }
};

export function getItemById(id: string): ItemDefinition | undefined {
    // return ITEM_DEFINITIONS.find(item => item.id === id);
    return ITEM_DEFINITIONS[id]
}

export function getRandomOmelette(): ItemDefinition {
    const OMELETTE_IDS = ['OMELETTE_PLAIN', 'OMELETTE_MUSHROOM', 'OMELETTE_PEPPER'];
    const randomIndex = Math.floor(Math.random() * OMELETTE_IDS.length);
    return ITEM_DEFINITIONS[OMELETTE_IDS[randomIndex]];
}

/**
 * Check if an item has a specific trait
 */
export function hasTrait(item: ItemDefinition, trait: ItemTrait): boolean {
    return item.traits.includes(trait);
}
