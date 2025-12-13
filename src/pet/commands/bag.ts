import { 
    EmbedBuilder,
    ChatInputCommandInteraction,
} from 'discord.js';
import { MAX_INVENTORY_CAPACITY } from '../types';
import { inventoryService } from '../services/inventory.service';
import { getItemDataById } from '../constants/items';

export async function handleBag(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const action = interaction.options.getString('action') || 'view';
    const itemId = interaction.options.getString('item');
    const quantity = interaction.options.getInteger('quantity') || 1;

    if (action === 'view') {
        const bag = await inventoryService.getBag(userId);

        const embed = new EmbedBuilder()
            .setTitle(`📦 Bag (${bag.length}/${MAX_INVENTORY_CAPACITY})`)
            .setColor(0x0099FF);

        if (bag.length === 0) {
            embed.addFields({ name: '', value: 'Empty', inline: false });
        } else {
            const bagList = bag.map(item => {
                return `• ${item.name} x${item.quantity}`;
            }).join('\n');
            embed.addFields({ 
                name: ``, 
                value: bagList || 'Empty', 
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
            await inventoryService.moveItem(userId, itemId, quantity, 'bag', 'storage');

            const itemDef = getItemDataById(itemId);
            const itemName = itemDef ? itemDef.name : itemId;
            await interaction.editReply(`✅ Stored ${quantity}x **${itemName}** to storage!`);
        } catch (error: any) {
            await interaction.editReply(`❌ ${error.message || 'Failed to store item.'}`);
        }
    }
}
