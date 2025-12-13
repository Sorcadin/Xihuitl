import { 
    EmbedBuilder,
    ChatInputCommandInteraction,
} from 'discord.js';
import { petService } from '../services/pet.service';
import { inventoryService } from '../services/inventory.service';
import { dailyService, COOLDOWN_DURATION_MS } from '../services/daily.service';
import { getRandomOmelette } from '../constants/items';

export async function handleDaily(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    
    // Check if user has a pet
    const profile = await petService.getProfile(userId);
    if (!profile?.activePetId) {
        await interaction.editReply('❌ You don\'t have a pet! Use `/pet adopt` to adopt one.');
        return;
    }

    const currentTime = Date.now();
    const lastClaimedAt = await dailyService.getLastClaimTime(userId);

    // Check if the cooldown period has passed
    if (lastClaimedAt) {
        const timeElapsed = currentTime - lastClaimedAt.getTime(); 
        
        if (timeElapsed < COOLDOWN_DURATION_MS) {
            // The user is still on cooldown
            const timeRemainingMs = COOLDOWN_DURATION_MS - timeElapsed;
            
            // Convert remaining milliseconds to a human-readable format
            const hours = Math.floor(timeRemainingMs / (1000 * 60 * 60));
            const minutes = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeRemainingMs % (1000 * 60)) / 1000);

            // Construct the time remaining string
            let timeString = '';
            if (hours > 0) timeString += `${hours}h `;
            if (minutes > 0) timeString += `${minutes}m `;
            timeString += `${seconds}s`;

            const errorEmbed = new EmbedBuilder()
                .setTitle('⏳ Still on Cooldown')
                .setDescription(`You have already claimed your daily reward. You can claim again in **${timeString.trim()}**!`)
                .setColor(0xFFA500);

            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }
    }

    // Grant the reward
    try {
        const omelette = getRandomOmelette();
        await inventoryService.addItem(userId, omelette.itemId, 1, 'bag');
        await dailyService.setLastClaimTime(userId, new Date(currentTime));

        const embed = new EmbedBuilder()
            .setTitle('🎁 Daily Reward Claimed!')
            .setDescription(`You received a **${omelette.name}**!`)
            .setColor(0xFFD700)
            .addFields(
                { name: 'Item', value: omelette.name, inline: true },
                { name: 'Description', value: `${omelette.description}`, inline: true }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
        if (error.message?.includes('capacity') || error.message?.includes('full')) {
            await interaction.editReply(`❌ ${error.message}`);
        } else {
            console.error('Error claiming daily:', error);
            await interaction.editReply('❌ An error occurred while claiming your daily reward.');
        }
    }
}
