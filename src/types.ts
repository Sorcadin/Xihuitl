import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandsOnlyBuilder } from "discord.js";

// Shared types used across features
export interface Command {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
