
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
import { stitchImagesInMemory } from "../../services/image.service";
import { getAllSpecies, getSpeciesById } from '../constants/pet-species';

const SPECIES_PER_PAGE = 3; // Must be 5 or less

export async function handleAdopt(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;

    // Check if user already has a pet
    const existingPet = await petService.getPet(userId);
    if (existingPet) {
        await interaction.editReply('❌ You already have a pet! Use `/pet info` to see your pet.');
        return;
    }

    // Create the Species Selection Buttons
    const speciesList = getAllSpecies()

    // Call the helper function to build and send the initial page (Page 0)
    let { embeds, components, imageBuffer, imageName } = await buildSpeciesPage(speciesList, 0, userId);
    const reply = await interaction.editReply({
        embeds: embeds,
        components: components,
        files: [{ attachment: imageBuffer, name: imageName }], 
    });

    const filter = (i: ButtonInteraction) => 
        (i.customId.startsWith('adopt_species_') || i.customId.startsWith('paginate_')) && i.user.id === userId;

    try {
        // Use a loop to continuously listen for interactions (pagination or selection)
        let currentPage = 0;
        
        while (true) {
            const interactionResult = await reply.awaitMessageComponent({
                filter,
                componentType: ComponentType.Button,
                time: 120_000, // Extend time for navigation
            });

            // Acknowledge the interaction immediately
            await interactionResult.deferUpdate();

            if (interactionResult.customId.startsWith('paginate_')) {
                // Handle pagination
                const action = interactionResult.customId.replace('paginate_', '');

                if (action === 'next') {
                    currentPage = Math.min(currentPage + 1, Math.ceil(speciesList.length / SPECIES_PER_PAGE) - 1);
                } else if (action === 'prev') {
                    currentPage = Math.max(currentPage - 1, 0);
                }

                // Rebuild and update the message with the new page
                let { embeds, components, imageBuffer, imageName } = await buildSpeciesPage(speciesList, currentPage, userId);
                await interactionResult.editReply({ 
                    embeds: embeds, 
                    components: components,
                    files: [{ attachment: imageBuffer, name: imageName }], 
                });

            } else if (interactionResult.customId.startsWith('adopt_species_')) {
                await handleSpeciesSelection(interactionResult);
                return;
            }
        }
    } catch (e) {
        // Handle timeout or error
        await interaction.editReply({
            content: '⏰ Adoption timed out. Please run the command again.',
            components: [], // Remove buttons
        });
    }
}

async function handleSpeciesSelection(interaction: ButtonInteraction) {
    const speciesId = interaction.customId.replace('adopt_species_', '');
    const species = getSpeciesById(speciesId);

    // Create the Name Input Modal
    const nameInput = new TextInputBuilder({
        customId: 'pet_name_input',
        label: "What will you name your pet?", // Set label via constructor option
        style: TextInputStyle.Short,
        minLength: 1,
        maxLength: 20,
        required: true,
    });
    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);

    const modal = new ModalBuilder({
        customId: `adopt_name_modal_${speciesId}`,
        title: `Name Your New ${species?.name || 'Pet'}`,
        components: [actionRow], 
    });

    await interaction.showModal(modal);

    // Start the Collector for the Modal Submission
    const filter = (i: ModalSubmitInteraction) => i.customId === `adopt_name_modal_${speciesId}` && i.user.id === interaction.user.id;
    
    try {
        const modalSubmission = await interaction.awaitModalSubmit({
            filter,
            time: 120_000, // 2 minutes to fill out the form
        });

        await handleNameSubmission(modalSubmission, speciesId);

    } catch (e) {
        // Handle timeout or error if modal is not submitted
        console.error('Modal submission timed out:', e);
    }
}

async function handleNameSubmission(interaction: ModalSubmitInteraction, speciesId: string) {
    // Defer the Modal Submission reply
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const name = interaction.fields.getTextInputValue('pet_name_input');
    const species = getSpeciesById(speciesId);
    
    // Quick final checks
    if (!species) {
        await interaction.editReply('❌ Invalid species selected during the process.');
        return;
    }

    // Perform the Adoption
    try {
        await petService.adoptPet(userId, speciesId, name);

        // Get the image URL for the final embed
        const speciesImageUrl = await createPresignedDownloadUrl(`${species.id.toLowerCase()}`);
        const finalImageUrl = speciesImageUrl ?? null;

        const embed = new EmbedBuilder()
            .setTitle('🎉 Pet Adopted!')
            .setDescription(`You've successfully adopted a **${species.name}** named **${name}**!`)
            .setThumbnail(finalImageUrl)
            .setColor(0x00FF00)
            .addFields(
                { name: 'Species', value: species.name, inline: true },
                { name: 'Name', value: name, inline: true },
            );

        await interaction.editReply({ content: 'Adoption successful!', embeds: [embed] });
    } catch (error) {
        console.error('Error adopting pet:', error);
        await interaction.editReply('❌ An error occurred while finalizing your pet adoption.');
    }
}

async function buildSpeciesPage(allSpecies: any[], pageIndex: number, userId: string) {
    const startIndex = pageIndex * SPECIES_PER_PAGE;
    const speciesForPage = allSpecies.slice(startIndex, startIndex + SPECIES_PER_PAGE);
    const maxPages = Math.ceil(allSpecies.length / SPECIES_PER_PAGE);

    const individualImageUrls = await Promise.all(
        speciesForPage.map(s => 
            createPresignedDownloadUrl(`${s.id.toLowerCase()}`)
        )
    );
    
    // Stitch the images together and get the composite Buffer
    const imageBuffer = await stitchImagesInMemory(individualImageUrls.filter(url => url !== null) as string[]);
    const imageName = `composite_page_${pageIndex}.png`; // A local name for Discord attachment

    // Create the Species Selection Buttons (Max 5 per row)
    const speciesButtonsRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            speciesForPage.map(s =>
                new ButtonBuilder()
                    .setCustomId(`adopt_species_${s.id}`)
                    .setLabel(s.name)
                    .setStyle(ButtonStyle.Primary)
            )
        );

    // Create Navigation Buttons Row
    const navButtonsRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('paginate_prev')
                .setLabel('⬅️ Previous')
                .setStyle(ButtonStyle.Secondary)
                // Disable if we are on the first page (index 0)
                .setDisabled(pageIndex === 0),

            new ButtonBuilder()
                .setCustomId('paginate_next')
                .setLabel('Next ➡️')
                .setStyle(ButtonStyle.Secondary)
                // Disable if we are on the last page (maxPages - 1)
                .setDisabled(pageIndex >= maxPages - 1),
        );
        
    // Create the Embed
    const speciesEmbed = new EmbedBuilder()
        .setTitle('Choose Your Pet Species')
        .setDescription('')
        .setFooter({ text: `Page ${pageIndex + 1}/${maxPages}` })
        .setColor(0x3498DB)
        .setImage(`attachment://${imageName}`);

    // Combine all components (selection buttons and navigation buttons)
    const components = [speciesButtonsRow, navButtonsRow];

    // Check if we need a second row of selection buttons (max 5 per row)
    // However, since we set SPECIES_PER_PAGE < 5, we only need one row for selection.
    
    return { embeds: [speciesEmbed], components: components, imageBuffer, imageName };
}
