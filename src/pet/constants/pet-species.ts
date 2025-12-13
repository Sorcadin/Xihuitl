import { SpeciesData } from '../types';

export const PET_SPECIES: Record<string, SpeciesData> = {
    VIGILUP: {
        name: 'Vigilup',
        type: 'beast'
    },
    ARCHINO: {
        name: 'Archino',
        type: 'beast'
    },
    ANOBITE: {
        name: 'Anobite',
        type: 'insect'
    },
    CLADILY: {
        name: 'Cladily',
        type: 'plant'
    },
    HULLET: {
        name: 'Hullet',
        type: 'plant'
    },
    GYTOP: {
        name: 'Gytop',
        type: 'construct'
    },

}

export function getSpeciesDataById(id: string): SpeciesData | undefined {
    return PET_SPECIES[id]
}

export function getAllSpecies(): Array<SpeciesData & { id: string }> {
    return Object.entries(PET_SPECIES).map(([id, data]) => ({ id, ...data }));
}
