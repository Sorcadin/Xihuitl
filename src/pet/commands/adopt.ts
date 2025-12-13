import { 
    EmbedBuilder,
    ChatInputCommandInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ComponentType,
    ModalSubmitInteraction,
    ButtonInteraction,
} from 'discord.js';
import { petService } from '../services/pet.service';
import { createPresignedDownloadUrl } from "../../services/s3.service";
import { getAllSpecies, getSpeciesDataById } from '../constants/pet-species';

export async function handleAdopt(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const userId = interaction.user.id;

    // Check if user already has a pet
    const profile = await petService.getProfile(userId);
    if (profile?.activePetId) {
        await interaction.editReply('❌ You already have a pet! Use `/pet info` to see your pet.');
        return;
    }

    // Get all species and show first one
    const speciesList = getAllSpecies();
    let currentIndex = 0;

    // Build and send initial species display
    const { embed, components } = await buildSpeciesDisplay(speciesList, currentIndex);
    await interaction.editReply({
        embeds: [embed],
        components: components,
    });

    const filter = (i: ButtonInteraction) => 
        (i.customId.startsWith('adopt_') || i.customId.startsWith('nav_')) && i.user.id === userId;

    try {
        // Loop to handle navigation
        while (true) {
            const buttonInteraction = await interaction.channel?.awaitMessageComponent({
                filter,
                componentType: ComponentType.Button,
                time: 120_000, // 2 minutes
            });

            if (!buttonInteraction) break;

            // Acknowledge the interaction
            await buttonInteraction.deferUpdate();

            if (buttonInteraction.customId === 'nav_left') {
                // Move left (wrap around)
                currentIndex = (currentIndex - 1 + speciesList.length) % speciesList.length;
                const { embed, components } = await buildSpeciesDisplay(speciesList, currentIndex);
                await interaction.editReply({
                    embeds: [embed],
                    components: components,
                });
            } else if (buttonInteraction.customId === 'nav_right') {
                // Move right (wrap around)
                currentIndex = (currentIndex + 1) % speciesList.length;
                const { embed, components } = await buildSpeciesDisplay(speciesList, currentIndex);
                await interaction.editReply({
                    embeds: [embed],
                    components: components,
                });
            } else if (buttonInteraction.customId === 'adopt_current') {
                // User chose to adopt this species
                await handleSpeciesSelection(buttonInteraction, speciesList[currentIndex].id);
                return;
            }
        }
    } catch (e) {
        // Handle timeout
        await interaction.editReply({
            content: '⏰ Adoption timed out. Please run the command again.',
            embeds: [],
            components: [],
        });
    }
}

async function buildSpeciesDisplay(speciesList: any[], index: number) {
    const species = speciesList[index];
    const imageUrl = await createPresignedDownloadUrl(species.id.toLowerCase());

    const embed = new EmbedBuilder()
        .setTitle('Choose Your Pet Species')
        .setDescription(`**${species.name}**\nType: ${species.type.charAt(0).toUpperCase()}`)
        .setImage(imageUrl || null)
        .setColor(0x3498DB)
        .setFooter({ text: `${index + 1}/${speciesList.length} - Use arrows to browse` });

    // Create navigation buttons
    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('nav_left')
                .setLabel('← Previous')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('adopt_current')
                .setLabel('Adopt This Pet')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('nav_right')
                .setLabel('Next →')
                .setStyle(ButtonStyle.Secondary)                
        );

    return { embed, components: [row] };
}

async function handleSpeciesSelection(interaction: ButtonInteraction, speciesId: string) {
    const species = getSpeciesDataById(speciesId);

    // Create the Name Input Modal
    const nameInput = new TextInputBuilder({
        customId: 'pet_name_input',
        label: 'What will you name your pet?',
        style: TextInputStyle.Short,
        minLength: 1,
        maxLength: 20,
        required: true,
    });

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);

    const modal = new ModalBuilder({
        customId: `adopt_name_modal_${speciesId}`,
        title: `Name Your ${species?.name || 'Pet'}`,
        components: [actionRow],
    });

    await interaction.showModal(modal);

    // Wait for modal submission
    const filter = (i: ModalSubmitInteraction) => 
        i.customId === `adopt_name_modal_${speciesId}` && i.user.id === interaction.user.id;

    try {
        const modalSubmission = await interaction.awaitModalSubmit({
            filter,
            time: 120_000,
        });

        await handleNameSubmission(modalSubmission, speciesId);
    } catch (e) {
        console.error('Modal submission timed out:', e);
    }
}

async function handleNameSubmission(interaction: ModalSubmitInteraction, speciesId: string) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const name = interaction.fields.getTextInputValue('pet_name_input');
    const species = getSpeciesDataById(speciesId);

    if (!species) {
        await interaction.editReply('❌ Invalid species selected.');
        return;
    }

    try {
        await petService.adoptPet(userId, name, speciesId);

        const imageUrl = await createPresignedDownloadUrl(speciesId.toLowerCase());

        const embed = new EmbedBuilder()
            .setTitle('🎉 Pet Adopted!')
            .setDescription(`You've adopted a **${species.name}** named **${name}**!`)
            .setImage(imageUrl || null)
            .setColor(0x00FF00)
            .addFields(
                { name: 'Species', value: species.name, inline: true },
                { name: 'Name', value: name, inline: true },
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
        console.error('Error adopting pet:', error);

        // Check if error is due to user already having a pet
        if (error.name === 'TransactionCanceledException' || 
            error.message?.includes('ConditionalCheckFailed')) {
            await interaction.editReply('❌ You already have a pet! Use `/pet info` to see your pet.');
        } else {
            await interaction.editReply('❌ An error occurred while adopting your pet.');
        }
    }
}
