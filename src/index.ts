import { Client, GatewayIntentBits, Collection, Options } from 'discord.js';
import * as dotenv from 'dotenv';
import { Command } from './types';
import { timeCommand, handleTimeMentions } from './time/commands/time';
import { petCommand } from './pet/commands/commands';
import { handleFeedAutocomplete } from './pet/commands/feed';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN!;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    // Minimal caching configuration for lightweight operation
    makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        // Only cache essentials
        MessageManager: 0, // Don't cache messages (we don't need message history)
        ThreadManager: 0, // Don't cache threads
        GuildMemberManager: {
            maxSize: 200, // Limit member cache to 200 (for display names in time command)
            keepOverLimit: (member) => member.id === member.client.user.id, // Always keep bot itself
        },
        UserManager: {
            maxSize: 200, // Limit user cache
            keepOverLimit: (user) => user.id === user.client.user.id, // Always keep bot itself
        },
        // Don't cache these at all
        GuildBanManager: 0,
        GuildInviteManager: 0,
        GuildScheduledEventManager: 0,
        GuildStickerManager: 0,
        PresenceManager: 0,
        ReactionManager: 0,
        ReactionUserManager: 0,
        StageInstanceManager: 0,
        VoiceStateManager: 0,
    }),
    // Automatic cache sweeping to remove old entries
    sweepers: {
        ...Options.DefaultSweeperSettings,
        messages: {
            interval: 300, // Every 5 minutes
            lifetime: 60, // Remove messages older than 1 minute
        },
        users: {
            interval: 3600, // Every hour
            filter: () => (user) => user.bot && user.id !== user.client.user.id, // Remove bot users except self
        },
        guildMembers: {
            interval: 3600, // Every hour
            filter: () => (member) => member.id !== member.client.user.id, // Keep only recent members
        },
    },
});

const commands = new Collection<string, Command>();
commands.set(timeCommand.data.name, timeCommand);
commands.set(petCommand.data.name, petCommand);

client.on('interactionCreate', async interaction => {
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'pet' && interaction.options.getSubcommand() === 'feed') {
            await handleFeedAutocomplete(interaction);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        const reply = { content: 'There was an error executing this command!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        } else {
            await interaction.reply(reply);
        }
    }
});

client.on('messageCreate', handleTimeMentions);

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user?.tag}`);
});

client.login(TOKEN);
