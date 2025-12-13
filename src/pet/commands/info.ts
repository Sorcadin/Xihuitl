import { 
    EmbedBuilder,
    ChatInputCommandInteraction,
} from 'discord.js';
import { petService } from '../services/pet.service';
import { createPresignedDownloadUrl } from "../../services/s3.service";
import { getSpeciesDataById } from '../constants/pet-species';

const HUNGER_STATE_EMOJIS: Record<string, string> = {
    'full': '🟢',
    'satisfied': '🟡',
    'fine': '🟠',
    'hungry': '🟠',
    'starving': '🔴',
};

export async function handleInfo(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const profile = await petService.getProfile(userId);

    if (!profile?.activePetId) {
        await interaction.editReply('❌ You don\'t have a pet yet! Use `/pet adopt` to adopt one.');
        return;
    }

    const pet = await petService.getPet(userId, profile.activePetId);
    if (!pet) {
        await interaction.editReply('❌ Could not find your pet data.');
        return;
    }

    const species = getSpeciesDataById(pet.species);
    if (!species) {
        await interaction.editReply('❌ Your pet\'s species data is invalid.');
        return;
    }

    const hunger = petService.getCurrentHunger(pet);
    const hungerEmoji = HUNGER_STATE_EMOJIS[hunger.state] || '⚪';
    const daysSinceAdopted = Math.floor((Date.now() - pet.adoptedAt) / (1000 * 60 * 60 * 24))
    const speciesImageUrl = await createPresignedDownloadUrl(`${pet.species.toLowerCase()}`)

    if (!speciesImageUrl) {
        console.error(`Could not generate image URL for ${pet.species.toLowerCase()}.`);
    } 
    const finalImageUrl = speciesImageUrl ?? null;

    const embed = new EmbedBuilder()
        .setTitle(`${pet.name}`)
        .setThumbnail(finalImageUrl)
        .setColor(0x0099FF)
        .addFields(
            { name: 'Species', value: species.name, inline: true },
            { name: 'Hunger', value: `${hungerEmoji} ${hunger.state.charAt(0).toUpperCase() + hunger.state.slice(1)}`, inline: true },
            { name: 'Age', value: `${daysSinceAdopted} days`, inline: true }
        );

    await interaction.editReply({ embeds: [embed] });
}
