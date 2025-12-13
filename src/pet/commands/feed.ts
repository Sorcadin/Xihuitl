import { 
    EmbedBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
} from 'discord.js';
import { petService } from '../services/pet.service';
import { inventoryService } from '../services/inventory.service';
import { createPresignedDownloadUrl } from "../../services/s3.service";
import { getSpeciesDataById } from '../constants/pet-species';
import { getItemDataById, hasTrait } from '../constants/items';

const HUNGER_STATE_EMOJIS: Record<string, string> = {
    'full': '🟢',
    'satisfied': '🟡',
    'fine': '🟠',
    'hungry': '🟠',
    'starving': '🔴',
};

export async function handleFeed(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const itemId = interaction.options.getString('item', true);

    // Check if user has a pet
    const profile = await petService.getProfile(userId);
    if (!profile?.activePetId) {
        await interaction.editReply('❌ You don\'t have a pet! Use `/pet adopt` to adopt one.');
        return;
    }

    const pet = await petService.getPet(userId, profile.activePetId);
    if (!pet) {
        await interaction.editReply('❌ Could not find your pet data.');
        return;
    }

    // Check if item exists
    const itemDef = getItemDataById(itemId);
    if (!itemDef) {
        await interaction.editReply('❌ Invalid item selected.');
        return;
    }

    // Check if item is edible
    if (!hasTrait(itemDef, 'edible')) {
        await interaction.editReply('❌ This item cannot be fed to pets!');
        return;
    } 

    // Check if user has the item in bag
    const hasItem = await inventoryService.hasItem(userId, itemId, 1, 'bag');
    if (!hasItem) {
        await interaction.editReply('❌ You don\'t have this item in your bag!');
        return;
    }

    const species = getSpeciesDataById(pet.species);
    if (!species) {
        await interaction.editReply('❌ Your pet\'s species data is invalid.');
        return;
    }

    const speciesImageUrl = await createPresignedDownloadUrl(`${pet.species.toLowerCase()}`)

    if (!speciesImageUrl) {
        console.error(`Could not generate image URL for ${pet.species.toLowerCase()}.`);
    } 
    const finalImageUrl = speciesImageUrl ?? null;


    try {
        // Remove item from bag first
        await inventoryService.removeItem(userId, itemId, 1, 'bag');
        
        // Feed the pet
        const result = await petService.feedPet(userId, profile.activePetId, itemDef.hungerRestoration!);

        const hungerEmoji = HUNGER_STATE_EMOJIS[result.newState] || '⚪';
        const embed = new EmbedBuilder()
            .setTitle('🍽️ Pet Fed!')
            .setThumbnail(finalImageUrl)
            .setDescription(`You fed ${pet.name} a **${itemDef.name}**!`)
            .setColor(0x00FF00)
            .addFields(
                { name: 'Current Hunger', value: `${hungerEmoji} ${result.newState.charAt(0).toUpperCase() + result.newState.slice(1)}`, inline: true }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error feeding pet:', error);
        await interaction.editReply('❌ An error occurred while feeding your pet.');
    }
}

// Autocomplete handler for feed command
export async function handleFeedAutocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    
    if (focused.name === 'item') {
        const userId = interaction.user.id;
        const inventory = await inventoryService.getBag(userId);
        
        // Filter to only edible items
        const edibleItems = inventory.filter(item => {
            return hasTrait(item, 'edible');
        });

        const choices = edibleItems.map(item => {
            return {
                name: `${item.name || item.itemId} (x${item.quantity})`,
                value: item.itemId
            };
        }).slice(0, 25); // Discord limit

        await interaction.respond(choices);
    }
}
