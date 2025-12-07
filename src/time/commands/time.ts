import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { DateTime } from 'luxon';
import { userTimezoneService } from '../services/timezone.service';
import { getTimezoneFromLocation } from '../services/geo.service';
import { Command } from '../../types';

const COOLDOWN_MS = 2 * 60 * 60 * 1000;
const lastReplyTimes = new Map<string, number>();

const TIME_FORMAT_OPTIONS = { weekday: 'short' as const, hour: '2-digit' as const, minute: '2-digit' as const };

const formatTime = (time: DateTime): string => {
    return time.toLocaleString(TIME_FORMAT_OPTIONS);
};

export const timeCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('time')
        .setDescription('Manage timezone settings')
        .addSubcommand(sub => 
            sub.setName('set')
            .setDescription('Set your location')
            .addStringOption(opt => opt.setName('location').setDescription('Location name').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('get')
            .setDescription('Get time for a user or location')
            .addUserOption(opt => opt.setName('user').setDescription('Select a user'))
            .addStringOption(opt => opt.setName('location').setDescription('Type a location'))
        )
        .addSubcommand(sub => 
            sub.setName('all')
            .setDescription('List time for everyone in this server')
        ),

    execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            await interaction.deferReply();
            const location = interaction.options.getString('location', true);
            const result = await getTimezoneFromLocation(location);

            if (!result) {
                await interaction.editReply("❌ Could not find that location. Please try again.");
                return;
            }

            await userTimezoneService.saveUser(interaction.user.id, result.timezone, result.address);
            
            await interaction.editReply(`📍 **Location Updated**\n<@${interaction.user.displayName}> set to: \`${result.address}\``);
        }

        else if (sub === 'get') {
            const user = interaction.options.getUser('user');
            const location = interaction.options.getString('location');

            if ((user && location) || (!user && !location)) {
                await interaction.reply({ content: "❌ Please provide EITHER a user OR a location.", ephemeral: true });
                return;
            }

            if (user) {
                const data = await userTimezoneService.getSingleUser(user.id);
                if (!data) {
                    await interaction.reply({ content: "❌ That user hasn't set their timezone.", ephemeral: true });
                    return;
                }
                const time = DateTime.now().setZone(data.timezone);
                await interaction.reply(`Time for **${user.displayName}**\n\`${formatTime(time)}\``);

            } 
            else if (location) {
                await interaction.deferReply();
                const result = await getTimezoneFromLocation(location);
                if (!result) {
                    await interaction.editReply("❌ Location not found. Please try again.");
                    return;
                }
                const time = DateTime.now().setZone(result.timezone);
                await interaction.editReply(`Time in **${result.address}**\n\`${formatTime(time)}\``);
            }
        }

        else if (sub === 'all') {
            await interaction.deferReply();
            const members = await interaction.guild?.members.fetch();
            if (!members) return;

            const humanIds = members.filter(m => !m.user.bot).map(m => m.id);
            const usersData = await userTimezoneService.getUsers(humanIds);

            if (usersData.length === 0) {
                await interaction.editReply("No users have set their timezone.");
                return;
            }

            // Group users by timezone abbreviation
            const timezoneGroups = new Map<string, { abbreviation: string; users: typeof usersData; offset: number }>();
            for (const user of usersData) {
                const time = DateTime.now().setZone(user.timezone);
                const abbreviation = time.offsetNameLong || time.toFormat('ZZZZZ');
                
                if (!timezoneGroups.has(abbreviation)) {
                    timezoneGroups.set(abbreviation, {
                        abbreviation,
                        users: [],
                        offset: time.offset
                    });
                }
                timezoneGroups.get(abbreviation)!.users.push(user);
            }

            // Build the formatted output
            const timezoneEntries = Array.from(timezoneGroups.values()).map(({ abbreviation, users, offset }) => {
                // Get a representative time from the first user in this group
                const representativeTimezone = users[0].timezone;
                const time = DateTime.now().setZone(representativeTimezone);
                
                // Format users in this timezone
                const userList = users.map(u => {
                    const member = members.get(u.user_id);
                    return `\t${member?.displayName || "Unknown"}`;
                }).join("\n");

                return {
                    offset: offset,
                    text: `\`${formatTime(time)}\` - **${abbreviation}**\n${userList}`
                };
            }).sort((a, b) => a.offset - b.offset);

            await interaction.editReply(timezoneEntries.map(e => e.text).join("\n"));
        }
    }
};

export const handleTimeMentions = async (message: Message) => {
    if (!message.inGuild()) return;
    if (message.author.bot) return;
    if (message.mentions.users.size === 0) return;

    const now = Date.now();
    for (const [userId, user] of message.mentions.users) {
        if (user.bot) continue;

        const lastSeen = lastReplyTimes.get(userId);
        if (lastSeen && (now - lastSeen) < COOLDOWN_MS) continue;

        const data = await userTimezoneService.getSingleUser(userId);
        if (data) {
            const time = DateTime.now().setZone(data.timezone);
            const displayName = message.guild?.members.cache.get(userId)?.displayName ?? user.username;
            await message.channel.send(`It is **${formatTime(time)}** for ${displayName}.`);
            lastReplyTimes.set(userId, now);
        }
    }
};

