import { 
    SlashCommandBuilder,
    ChatInputCommandInteraction,
} from 'discord.js';
import { Command } from '../../types';
import { handleAdopt } from './adopt';
import { handleInfo } from './info';
import { handleFeed } from './feed';
import { handleRename } from './rename';
import { handleBag } from './bag';
import { handleStorage } from './storage';
import { handleDaily } from './daily';


export const petCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('pet')
        .setDescription('Manage your virtual pet')
        .addSubcommand(sub => 
            sub.setName('adopt')
            .setDescription('Adopt a pet - Browse species and choose one!')
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
