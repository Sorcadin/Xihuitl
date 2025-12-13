import { 
    EmbedBuilder,
    ChatInputCommandInteraction,
} from 'discord.js';
import { inventoryService } from '../services/inventory.service';
import { getItemDataById } from '../constants/items';

export async function handleStorage(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const action = interaction.options.getString('action') || 'view';
    const itemId = interaction.options.getString('item');
    const quantity = interaction.options.getInteger('quantity') || 1;
    const page = interaction.options.getInteger('page') || 1;

    if (action === 'view') {
        const storage = await inventoryService.getStorage(userId, page);

        const embed = new EmbedBuilder()
            .setTitle('🗄️ Storage')
            .setColor(0x0099FF);

        if (storage.items.length === 0 && page === 1) {
            embed.addFields({ name: '', value: 'Empty', inline: false });
        } else if (storage.items.length > 0) {
            const storageList = storage.items.map(item => {
                return `• ${item.name} x${item.quantity}`;
            }).join('\n');
            const storageFooter = storage.hasMore ? `\n*Page ${page} of ${storage.totalPages}*` : '';
            embed.addFields({ 
                name: '', 
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
            await inventoryService.moveItem(userId, itemId, quantity, 'storage', 'bag');

            const itemDef = getItemDataById(itemId);
            const itemName = itemDef ? itemDef.name : itemId;
            await interaction.editReply(`✅ Withdrew ${quantity}x **${itemName}** from storage!`);
        } catch (error: any) {
            await interaction.editReply(`❌ ${error.message || 'Failed to withdraw item.'}`);
        }
    }
}

