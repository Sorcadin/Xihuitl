import { PetSpecies } from '../types';

export const PET_SPECIES: Record<string, PetSpecies> = {
    SEEDLING: {
        id: 'seedling',
        name: 'Seedling',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/seedling.png',
        type: 'plant'
    },
}

export function getSpeciesById(id: string): PetSpecies | undefined {
    return PET_SPECIES[id]
}

export function getAllSpecies(): PetSpecies[] {
    return Object.values(PET_SPECIES);
}

