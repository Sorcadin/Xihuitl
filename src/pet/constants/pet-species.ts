import { PetSpecies } from '../types';

export const PET_SPECIES: PetSpecies[] = [
    {
        id: 'cat',
        name: 'Cat',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/cat.png'
    },
    {
        id: 'dog',
        name: 'Dog',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/dog.png'
    },
    {
        id: 'bird',
        name: 'Bird',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/bird.png'
    },
    {
        id: 'rabbit',
        name: 'Rabbit',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/rabbit.png'
    },
    {
        id: 'hamster',
        name: 'Hamster',
        image_url: 'https://cdn.discordapp.com/attachments/placeholder/hamster.png'
    }
];

export function getSpeciesById(id: string): PetSpecies | undefined {
    return PET_SPECIES.find(species => species.id === id);
}

export function getAllSpecies(): PetSpecies[] {
    return PET_SPECIES;
}

