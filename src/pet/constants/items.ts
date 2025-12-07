import { ItemDefinition } from '../types';

export const ITEM_DEFINITIONS: ItemDefinition[] = [
    // Omelette varieties
    {
        id: 'omelette_plain',
        name: 'Plain Omelette',
        hungerRestoration: 20
    },
];

export function getItemById(id: string): ItemDefinition | undefined {
    return ITEM_DEFINITIONS.find(item => item.id === id);
}

export function getRandomOmelette(): ItemDefinition {
    const omelettes = ITEM_DEFINITIONS.filter(item => item.id.startsWith('omelette_'));
    const randomIndex = Math.floor(Math.random() * omelettes.length);
    return omelettes[randomIndex];
}

export function getAllOmelettes(): ItemDefinition[] {
    return ITEM_DEFINITIONS.filter(item => item.id.startsWith('omelette_'));
}

