import { PetSpecies } from '../types';

export const PET_SPECIES: Record<string, PetSpecies> = {
    VIGILUP: {
        id: 'vigilup',
        name: 'Vigilup',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/vigilup.png',
        type: 'beast'
    },
    ARCHINO: {
        id: 'archino',
        name: 'Archino',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/archino.png',
        type: 'beast'
    },
    ANOBITE: {
        id: 'anobite',
        name: 'Anobite',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/anobite.png',
        type: 'insect'
    },
    CLADILY: {
        id: 'cladily',
        name: 'Cladily',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/cladily.png',
        type: 'plant'
    },
    HULLET: {
        id: 'hullet',
        name: 'Hullet',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/hullet.png',
        type: 'plant'
    },
    GYTOP: {
        id: 'gytop',
        name: 'Gytop',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/gytop.png',
        type: 'construct'
    },

}

export function getSpeciesById(id: string): PetSpecies | undefined {
    return PET_SPECIES[id]
}

export function getAllSpecies(): PetSpecies[] {
    return Object.values(PET_SPECIES);
}

