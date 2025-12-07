import { PetSpecies } from '../types';

export const PET_SPECIES: Record<string, PetSpecies> = {
    VIGILUP: {
        id: 'VIGILUP',
        name: 'Vigilup',
        type: 'beast'
    },
    ARCHINO: {
        id: 'ARCHINO',
        name: 'Archino',
        type: 'beast'
    },
    ANOBITE: {
        id: 'ANOBITE',
        name: 'Anobite',
        type: 'insect'
    },
    CLADILY: {
        id: 'CLADILY',
        name: 'Cladily',
        type: 'plant'
    },
    HULLET: {
        id: 'HULLET',
        name: 'Hullet',
        type: 'plant'
    },
    GYTOP: {
        id: 'GYTOP',
        name: 'Gytop',
        type: 'construct'
    },

}

export function getSpeciesById(id: string): PetSpecies | undefined {
    return PET_SPECIES[id]
}

export function getAllSpecies(): PetSpecies[] {
    return Object.values(PET_SPECIES);
}

