import { PetSpecies } from '../types';

export const PET_SPECIES: PetSpecies[] = [
    {
        id: 'seedling',
        name: 'Seedling',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/seedling.png',
        type: 'plant'
    },
];

export function getSpeciesById(id: string): PetSpecies | undefined {
    return PET_SPECIES.find(species => species.id === id);
}

export function getAllSpecies(): PetSpecies[] {
    return PET_SPECIES;
}

