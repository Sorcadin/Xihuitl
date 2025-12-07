import { dynamoDBService, resolveTableName } from "../../services/dynamodb.service";
import { InventoryItem, MAX_INVENTORY_CAPACITY, STORAGE_PAGE_SIZE } from "../types";

// Table name cache
const inventoryTableCache: { value: string | null } = { value: null };

async function resolveInventoryTableName(): Promise<string> {
    return resolveTableName("INVENTORY_TABLE", "/xiuh/inventory-table-name", inventoryTableCache);
}

/**
 * Service for managing inventory and storage items in DynamoDB
 */
export class InventoryService {
    public async getInventory(userId: string): Promise<InventoryItem[]> {
        const tableName = await resolveInventoryTableName();
        const result = await dynamoDBService.queryItems<InventoryItem>(
            tableName,
            'user_id = :userId',
            { ':userId': userId }
        );
        
        return result.items.filter(item => item.location === 'inventory');
    }

    public async getStorage(userId: string, page?: number): Promise<{ items: InventoryItem[]; totalPages: number; currentPage: number; hasMore: boolean }> {
        const tableName = await resolveInventoryTableName();
        const currentPage = page || 1;
        const limit = STORAGE_PAGE_SIZE;
        
        // Get all storage items (we'll paginate in memory for simplicity)
        // In production, you might want to use a GSI or scan with filter
        const result = await dynamoDBService.queryItems<InventoryItem>(
            tableName,
            'user_id = :userId',
            { ':userId': userId }
        );
        
        const storageItems = result.items.filter(item => item.location === 'storage');
        const totalPages = Math.ceil(storageItems.length / limit);
        const startIndex = (currentPage - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedItems = storageItems.slice(startIndex, endIndex);
        
        return {
            items: paginatedItems,
            totalPages,
            currentPage,
            hasMore: currentPage < totalPages
        };
    }

    public async getItemCount(userId: string, location: 'inventory' | 'storage'): Promise<number> {
        const items = location === 'inventory' 
            ? await this.getInventory(userId)
            : (await this.getStorage(userId)).items;
        
        return items.reduce((sum, item) => sum + item.quantity, 0);
    }

    public async addItem(userId: string, itemId: string, quantity: number, location: 'inventory' | 'storage'): Promise<void> {
        if (location === 'inventory') {
            const currentCount = await this.getItemCount(userId, 'inventory');
            if (currentCount + quantity > MAX_INVENTORY_CAPACITY) {
                throw new Error(`Inventory capacity exceeded. Current: ${currentCount}/${MAX_INVENTORY_CAPACITY}`);
            }
        }

        const tableName = await resolveInventoryTableName();
        // Use composite key: item_id#location as sort key
        const compositeItemId = `${itemId}#${location}`;
        const existing = await dynamoDBService.getItem<InventoryItem>(
            tableName,
            { user_id: userId, item_id: compositeItemId }
        );

        if (existing) {
            const updated: InventoryItem = {
                ...existing,
                quantity: existing.quantity + quantity
            };
            await dynamoDBService.putItem(tableName, updated);
        } else {
            const newItem: InventoryItem = {
                user_id: userId,
                item_id: compositeItemId,
                quantity: quantity,
                location: location
            };
            await dynamoDBService.putItem(tableName, newItem);
        }
    }

    public async removeItem(userId: string, itemId: string, quantity: number, location: 'inventory' | 'storage'): Promise<boolean> {
        const tableName = await resolveInventoryTableName();
        const compositeItemId = `${itemId}#${location}`;
        const key = { user_id: userId, item_id: compositeItemId };
        const existing = await dynamoDBService.getItem<InventoryItem>(tableName, key);

        if (!existing || existing.quantity < quantity) {
            return false;
        }

        if (existing.quantity === quantity) {
            // Delete the item if quantity reaches zero
            // Note: DynamoDB doesn't have a delete method in our service, so we'll set quantity to 0
            // In production, you'd want to actually delete the item
            await dynamoDBService.putItem(tableName, { ...existing, quantity: 0 });
        } else {
            const updated: InventoryItem = {
                ...existing,
                quantity: existing.quantity - quantity
            };
            await dynamoDBService.putItem(tableName, updated);
        }

        return true;
    }

    public async moveItem(userId: string, itemId: string, quantity: number, from: 'inventory' | 'storage', to: 'inventory' | 'storage'): Promise<boolean> {
        if (from === to) {
            return false;
        }

        // Check capacity if moving to inventory
        if (to === 'inventory') {
            const currentCount = await this.getItemCount(userId, 'inventory');
            if (currentCount + quantity > MAX_INVENTORY_CAPACITY) {
                throw new Error(`Inventory capacity exceeded. Current: ${currentCount}/${MAX_INVENTORY_CAPACITY}`);
            }
        }

        // Remove from source
        const removed = await this.removeItem(userId, itemId, quantity, from);
        if (!removed) {
            return false;
        }

        // Add to destination
        await this.addItem(userId, itemId, quantity, to);
        return true;
    }

    public async hasItem(userId: string, itemId: string, quantity: number, location: 'inventory' | 'storage'): Promise<boolean> {
        const tableName = await resolveInventoryTableName();
        const compositeItemId = `${itemId}#${location}`;
        const item = await dynamoDBService.getItem<InventoryItem>(
            tableName,
            { user_id: userId, item_id: compositeItemId }
        );

        return item ? item.quantity >= quantity : false;
    }

    public async canAddItem(userId: string, quantity: number, location: 'inventory' | 'storage'): Promise<boolean> {
        if (location === 'storage') {
            return true; // Storage is uncapped
        }
        
        const currentCount = await this.getItemCount(userId, 'inventory');
        return (currentCount + quantity) <= MAX_INVENTORY_CAPACITY;
    }

    public async getItem(userId: string, itemId: string, location: 'inventory' | 'storage'): Promise<InventoryItem | null> {
        const tableName = await resolveInventoryTableName();
        const compositeItemId = `${itemId}#${location}`;
        return await dynamoDBService.getItem<InventoryItem>(
            tableName,
            { user_id: userId, item_id: compositeItemId }
        );
    }

    // Helper to extract base item_id from composite key
    public extractItemId(compositeItemId: string): string {
        return compositeItemId.split('#')[0];
    }
}

export const inventoryService = new InventoryService();

