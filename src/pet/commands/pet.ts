import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { MAX_INVENTORY_CAPACITY } from '../types';
import { petService } from '../services/pet.service';
import { inventoryService } from '../services/inventory.service';
import { createPresignedDownloadUrl } from "../../services/s3.service";
import { getAllSpecies, getSpeciesById } from '../constants/pet-species';
import { getItemById, getRandomOmelette, hasTrait } from '../constants/items';

const HUNGER_STATE_EMOJIS: Record<string, string> = {
    'full': '🟢',
    'satisfied': '🟡',
    'fine': '🟠',
    'hungry': '🟠',
    'starving': '🔴',
};

export const petCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('pet')
        .setDescription('Manage your virtual pet')
        .addSubcommand(sub => 
            sub.setName('adopt')
            .setDescription('Adopt a pet')
            .addStringOption(opt =>
                opt.setName('species')
                .setDescription('Choose a pet species')
                .setRequired(true)
                .addChoices(...getAllSpecies().map(s => ({ name: s.name, value: s.id })))
            )
            .addStringOption(opt =>
                opt.setName('name')
                .setDescription('Name your pet')
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(20)
            )
        )
        .addSubcommand(sub => 
            sub.setName('info')
            .setDescription('Get information about your pet')
        )
        .addSubcommand(sub =>
            sub.setName('feed')
            .setDescription('Feed your pet')
            .addStringOption(opt =>
                opt.setName('item')
                .setDescription('Food item to use')
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
        .addSubcommand(sub =>
            sub.setName('rename')
            .setDescription('Rename your pet')
            .addStringOption(opt =>
                opt.setName('name')
                .setDescription('Rename your pet')
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(20)
            )
        )
        .addSubcommand(sub => 
            sub.setName('bag')
            .setDescription('Manage your inventory')
            .addStringOption(opt =>
                opt.setName('action')
                .setDescription('What to do')
                .setRequired(false)
                .addChoices(
                    { name: 'View', value: 'view' },
                    { name: 'Store', value: 'store' },
                    { name: 'Use', value: 'use' }
                )
            )
            .addStringOption(opt =>
                opt.setName('item')
                .setDescription('Item ID')
                .setRequired(false)
            )
            .addIntegerOption(opt =>
                opt.setName('quantity')
                .setDescription('Quantity')
                .setRequired(false)
                .setMinValue(1)
            )
        )
        .addSubcommand(sub => 
            sub.setName('storage')
            .setDescription('Manage your deposit box')
            .addStringOption(opt =>
                opt.setName('action')
                .setDescription('What to do')
                .setRequired(false)
                .addChoices(
                    { name: 'View', value: 'view' },
                    { name: 'Withdraw', value: 'store' },
                )
            )
            .addStringOption(opt =>
                opt.setName('item')
                .setDescription('Item ID')
                .setRequired(false)
            )
            .addIntegerOption(opt =>
                opt.setName('quantity')
                .setDescription('Quantity')
                .setRequired(false)
                .setMinValue(1)
            )
        )
        .addSubcommand(sub => 
            sub.setName('daily')
            .setDescription('Claim your daily reward')
        ),

    execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();

        if (sub === 'adopt') {
            await handleAdopt(interaction);
        }
        else if (sub === 'info') {
            await handleInfo(interaction);
        }
        else if (sub === 'feed') {
            await handleFeed(interaction);
        }
        else if (sub === 'rename') {
            await handleRename(interaction);
        }
        else if (sub === 'bag') {
            await handleBag(interaction);
        }
        else if (sub === 'storage') {
            await handleStorage(interaction);
        }
        else if (sub === 'daily') {
            await handleDaily(interaction);
        }
    }
};

async function handleAdopt(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const speciesId = interaction.options.getString('species', true);
    const name = interaction.options.getString('name', true);

    // Check if user already has a pet
    const existingPet = await petService.getPet(userId);
    if (existingPet) {
        await interaction.editReply('❌ You already have a pet! Use `/pet info` to see your pet.');
        return;
    }

    const species = getSpeciesById(speciesId);
    if (!species) {
        await interaction.editReply('❌ Invalid species selected.');
        return;
    }
    const speciesImageUrl = await createPresignedDownloadUrl(`${species.id.toLowerCase()}`)

    if (!speciesImageUrl) {
        console.error(`Could not generate image URL for ${species.id.toLowerCase()}.`);
    } 
    const finalImageUrl = speciesImageUrl ?? null;

    try {
        await petService.adoptPet(userId, speciesId, name);
        
        const embed = new EmbedBuilder()
            .setTitle('🎉 Pet Adopted!')
            .setDescription(`You've adopted a **${species.name}** named **${name}**!`)
            .setThumbnail(finalImageUrl)
            .setColor(0x00FF00)
            .addFields(
                { name: 'Species', value: species.name, inline: true },
                { name: 'Name', value: name, inline: true },
                { name: 'Hunger', value: '🟢 Full', inline: true }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error adopting pet:', error);
        await interaction.editReply('❌ An error occurred while adopting your pet.');
    }
}

async function handleInfo(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const pet = await petService.getPet(userId);

    if (!pet) {
        await interaction.editReply('❌ You don\'t have a pet yet! Use `/pet adopt` to adopt one.');
        return;
    }

    const species = getSpeciesById(pet.species_id);
    if (!species) {
        await interaction.editReply('❌ Your pet\'s species data is invalid.');
        return;
    }

    const hunger = petService.getCurrentHunger(pet);
    const hungerEmoji = HUNGER_STATE_EMOJIS[hunger.state] || '⚪';
    const daysSinceAdopted = Math.floor((Date.now() - pet.adopted_at) / (1000 * 60 * 60 * 24))
    const speciesImageUrl = await createPresignedDownloadUrl(`${species.id.toLowerCase()}`)

    if (!speciesImageUrl) {
        console.error(`Could not generate image URL for ${species.id.toLowerCase()}.`);
    } 
    const finalImageUrl = speciesImageUrl ?? null;

    const embed = new EmbedBuilder()
        .setTitle(`${pet.name}`)
        .setThumbnail(finalImageUrl)
        .setColor(0x0099FF)
        .addFields(
            { name: 'Name', value: pet.name, inline: true },
            { name: 'Species', value: species.name, inline: true },
            { name: 'Hunger', value: `${hungerEmoji} ${hunger.state.charAt(0).toUpperCase() + hunger.state.slice(1)}`, inline: true },
            { name: 'Age', value: `${daysSinceAdopted}`, inline: true }
        );

    await interaction.editReply({ embeds: [embed] });
}

async function handleFeed(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const itemId = interaction.options.getString('item', true);

    // Check if user has a pet
    const pet = await petService.getPet(userId);
    if (!pet) {
        await interaction.editReply('❌ You don\'t have a pet! Use `/pet adopt` to adopt one.');
        return;
    }

    // Check if item exists
    const itemDef = getItemById(itemId);
    if (!itemDef) {
        await interaction.editReply('❌ Invalid item selected.');
        return;
    }

    // Check if item is edible
    if (!hasTrait(itemDef, 'edible')) {
        await interaction.editReply('❌ This item cannot be fed to pets!');
        return;
    } 

    // Check if user has the item in inventory
    const hasItem = await inventoryService.hasItem(userId, itemId, 1, 'inventory');
    if (!hasItem) {
        await interaction.editReply('❌ You don\'t have this item in your inventory!');
        return;
    }

    try {
        // Feed the pet
        const result = await petService.feedPet(userId, itemDef.hungerRestoration!);
        
        // Remove item from inventory
        await inventoryService.removeItem(userId, itemId, 1, 'inventory');

        const hungerEmoji = HUNGER_STATE_EMOJIS[result.newState] || '⚪';
        const embed = new EmbedBuilder()
            .setTitle('🍽️ Pet Fed!')
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

async function handleRename(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const name = interaction.options.getString('name', true);

    // Check if user already has a pet
    const pet = await petService.getPet(userId);
    if (!pet) {
        await interaction.editReply('❌ You don\'t have a pet! Use `/pet adopt` to adopt one.');
        return;
    }

    const species = getSpeciesById(pet.species_id)
    if (!species) {
        await interaction.editReply('❌ Your pet\'s species data is invalid.');
        return;
    }

    const hunger = petService.getCurrentHunger(pet);
    const hungerEmoji = HUNGER_STATE_EMOJIS[hunger.state] || '⚪';
    const daysSinceAdopted = Math.floor((Date.now() - pet.adopted_at) / (1000 * 60 * 60 * 24))
    const speciesImageUrl = await createPresignedDownloadUrl(`${species.id.toLowerCase()}`)

    if (!speciesImageUrl) {
        console.error(`Could not generate image URL for ${species.id.toLowerCase()}.`);
    } 
    const finalImageUrl = speciesImageUrl ?? null;


    try {
        await petService.renamePet(userId, name);
        
        const embed = new EmbedBuilder()
            .setTitle('📝 Pet Renamed!')
            .setDescription(`You've renamed your **${species.name}** to **${name}**!`)
            .setThumbnail(finalImageUrl)
            .setColor(0x00FF00)
            .addFields(
                { name: 'Species', value: species.name, inline: true },
                { name: 'Name', value: name, inline: true },
                { name: 'Hunger', value: '🟢 Full', inline: true },
                { name: 'Hunger', value: `${hungerEmoji} ${hunger.state.charAt(0).toUpperCase() + hunger.state.slice(1)}`, inline: true },
                { name: 'Age', value: `${daysSinceAdopted}`, inline: true }    
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error renaming pet:', error);
        await interaction.editReply('❌ An error occurred while renaming your pet.');
    }
}

async function handleBag(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const action = interaction.options.getString('action') || 'view';
    const itemId = interaction.options.getString('item');
    const quantity = interaction.options.getInteger('quantity') || 1;
    const page = interaction.options.getInteger('page') || 1;

    if (action === 'view') {
        const inventory = await inventoryService.getInventory(userId);
        const inventoryCount = await inventoryService.getItemCount(userId, 'inventory');
        const storage = await inventoryService.getStorage(userId, page);

        const embed = new EmbedBuilder()
            .setTitle('🎒 Your Inventory')
            .setColor(0x0099FF);

        // Inventory section
        if (inventory.length === 0) {
            embed.addFields({ name: '📦 Inventory', value: 'Empty', inline: false });
        } else {
            const inventoryList = inventory.map(item => {
                const baseItemId = inventoryService.extractItemId(item.item_id);
                const itemDef = getItemById(baseItemId);
                const itemName = itemDef ? itemDef.name : baseItemId;
                return `• ${itemName} x${item.quantity}`;
            }).join('\n');
            embed.addFields({ 
                name: `📦 Inventory (${inventoryCount}/${MAX_INVENTORY_CAPACITY})`, 
                value: inventoryList || 'Empty', 
                inline: false 
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } else if (action === 'store') {
        if (!itemId) {
            await interaction.editReply('❌ Please specify an item to store.');
            return;
        }

        try {
            const moved = await inventoryService.moveItem(userId, itemId, quantity, 'inventory', 'storage');
            if (!moved) {
                await interaction.editReply('❌ Failed to store item. Make sure you have enough items in your inventory.');
                return;
            }

            const itemDef = getItemById(itemId);
            const itemName = itemDef ? itemDef.name : itemId;
            await interaction.editReply(`✅ Stored ${quantity}x **${itemName}** to storage!`);
        } catch (error: any) {
            await interaction.editReply(`❌ ${error.message || 'Failed to store item.'}`);
        }
    } else if (action === 'use') {
        if (!itemId) {
            await interaction.editReply('❌ Please specify an item to use.');
            return;
        }

        // "use" means feed if it's an edible item
        const itemDef = getItemById(itemId);
        if (!itemDef) {
            await interaction.editReply('❌ Invalid item.');
            return;
        }

        // Check if item is edible
        if (!hasTrait(itemDef, 'edible')) {
            await interaction.editReply('❌ This item cannot be used to feed pets!');
            return;
        }

        const hasItem = await inventoryService.hasItem(userId, itemId, 1, 'inventory');
        if (!hasItem) {
            await interaction.editReply('❌ You don\'t have this item in your inventory!');
            return;
        }

        const pet = await petService.getPet(userId);
        if (!pet) {
            await interaction.editReply('❌ You don\'t have a pet! Use `/pet adopt` to adopt one.');
            return;
        }

        try {
            const result = await petService.feedPet(userId, itemDef.hungerRestoration!);
            await inventoryService.removeItem(userId, itemId, 1, 'inventory');

            const hungerEmoji = HUNGER_STATE_EMOJIS[result.newState] || '⚪';
            await interaction.editReply(`✅ Used **${itemDef.name}**!\nYour pet's hunger is now ${hungerEmoji} ${result.newState.charAt(0).toUpperCase() + result.newState.slice(1)}.`);
        } catch (error) {
            console.error('Error using item:', error);
            await interaction.editReply('❌ An error occurred while using the item.');
        }
    }
}

async function handleStorage(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const action = interaction.options.getString('action') || 'view';
    const itemId = interaction.options.getString('item');
    const quantity = interaction.options.getInteger('quantity') || 1;
    const page = interaction.options.getInteger('page') || 1;

    if (action === 'view') {
        const inventory = await inventoryService.getInventory(userId);
        const inventoryCount = await inventoryService.getItemCount(userId, 'inventory');
        const storage = await inventoryService.getStorage(userId, page);

        const embed = new EmbedBuilder()
            .setTitle('🎒 Your Inventory')
            .setColor(0x0099FF);

        // Storage section
        if (storage.items.length === 0 && page === 1) {
            embed.addFields({ name: '🗄️ Storage', value: 'Empty', inline: false });
        } else if (storage.items.length > 0) {
            const storageList = storage.items.map(item => {
                const baseItemId = inventoryService.extractItemId(item.item_id);
                const itemDef = getItemById(baseItemId);
                const itemName = itemDef ? itemDef.name : baseItemId;
                return `• ${itemName} x${item.quantity}`;
            }).join('\n');
            const storageFooter = storage.hasMore ? `\n*Page ${page} of ${storage.totalPages}*` : '';
            embed.addFields({ 
                name: '🗄️ Storage', 
                value: storageList + storageFooter, 
                inline: false 
            });
        }

        await interaction.editReply({ embeds: [embed] });

    } else if (action === 'withdraw') {
        if (!itemId) {
            await interaction.editReply('❌ Please specify an item to withdraw.');
            return;
        }

        try {
            const moved = await inventoryService.moveItem(userId, itemId, quantity, 'storage', 'inventory');
            if (!moved) {
                await interaction.editReply('❌ Failed to withdraw item. Make sure you have enough space in your inventory.');
                return;
            }

            const itemDef = getItemById(itemId);
            const itemName = itemDef ? itemDef.name : itemId;
            await interaction.editReply(`✅ Withdrew ${quantity}x **${itemName}** from storage!`);
        } catch (error: any) {
            await interaction.editReply(`❌ ${error.message || 'Failed to withdraw item.'}`);
        }
    }
}

async function handleDaily(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const userId = interaction.user.id;

    // Check if user has claimed today (simple check - in production, store last_claimed_at)
    // For now, we'll just grant the reward
    try {
        const omelette = getRandomOmelette();
        await inventoryService.addItem(userId, omelette.id, 1, 'inventory');

        const embed = new EmbedBuilder()
            .setTitle('🎁 Daily Reward Claimed!')
            .setDescription(`You received a **${omelette.name}**!`)
            .setColor(0xFFD700)
            .addFields(
                { name: 'Item', value: omelette.name, inline: true },
                { name: 'Description', value: `+${omelette.description}`, inline: true }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
        if (error.message?.includes('capacity')) {
            await interaction.editReply(`❌ ${error.message}`);
        } else {
            console.error('Error claiming daily:', error);
            await interaction.editReply('❌ An error occurred while claiming your daily reward.');
        }
    }
}

// Autocomplete handler for feed command
export async function handleFeedAutocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    
    if (focused.name === 'item') {
        const userId = interaction.user.id;
        const inventory = await inventoryService.getInventory(userId);
        
        // Filter to only edible items
        const edibleItems = inventory.filter(item => {
            const baseItemId = inventoryService.extractItemId(item.item_id);
            const itemDef = getItemById(baseItemId);
            return itemDef && hasTrait(itemDef, 'edible');
        });

        const choices = edibleItems.map(item => {
            const baseItemId = inventoryService.extractItemId(item.item_id);
            const itemDef = getItemById(baseItemId);
            return {
                name: `${itemDef?.name || baseItemId} (x${item.quantity})`,
                value: baseItemId
            };
        }).slice(0, 25); // Discord limit

        await interaction.respond(choices);
    }
}

