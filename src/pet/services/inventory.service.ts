import { dynamoDBService } from "../../services/dynamodb.service";
import { Item, MAX_INVENTORY_CAPACITY, STORAGE_PAGE_SIZE } from "../types";
import { ITEM_CATALOG } from "../constants/items";

const table = process.env.PETS_TABLE || "xiuh-pets";


/** * 
 * DynamoDB Structure of inventory:
 * {
 *   PK: "User#${userId}",
 *   SK: "Inventory#bag" or "Inventory#storage",
 *   itemMap: {
 *     "apple": 5,
 *     "banana": 3
 *   }
 * }
 * 
 */

export class InventoryService {
    /**
     * Ensures itemMap exists for the given inventory location.
     * If it doesn't exist, initializes it as an empty object.
     */
    private async ensureInventoryExists(userId: string, location: 'bag' | 'storage'): Promise<void> {
        const PK = `User#${userId}`;
        const SK = `Inventory#${location}`;

        const result = await dynamoDBService.getEntity<{ itemMap?: Record<string, number> }>(table, {PK: PK, SK: SK});
        
        if (!result?.itemMap) {
            await dynamoDBService.updateEntity(
                table,
                { PK: PK, SK: SK },
                `SET itemMap = :emptyMap`,
                { ":emptyMap": {} }
            );
        }
    }

    public async getBag(userId: string): Promise<Item[]> {
        const PK = `User#${userId}`;
        const SK = "Inventory#bag";

        const result = await dynamoDBService.getEntity<{ itemMap?: Record<string, number> }>(table, {PK: PK, SK: SK});
        const rawBag = result?.itemMap || {};

        const hydratedBag: Item[] = Object.entries(rawBag).map(([itemId, quantity]) => {
            const staticData = ITEM_CATALOG[itemId];

            // Handle missing itemMap gracefully
            if (!staticData) {
                console.error(`[HYDRATION ERROR] Item ID ${itemId} found in user ${userId}'s ${SK} but missing from ITEM_CATALOG.`);            
            }

            // Use the spread operator to cleanly merge the properties
            return {
                itemId,
                quantity,
                ...staticData,
            } as Item;
        });

        return hydratedBag;
    }

    public async getStorage(userId: string, page?: number): Promise<{ itemMap: Item[]; totalPages: number; currentPage: number; hasMore: boolean }> {
        const currentPage = page || 1;
        const limit = STORAGE_PAGE_SIZE;
        const PK = `User#${userId}`;
        const SK = "Inventory#storage";

        const result = await dynamoDBService.getEntity<{ itemMap?: Record<string, number> }>(table, {PK: PK, SK: SK});
        const rawStorage = result?.itemMap || {};
        
        // Convert to array and hydrate with catalog data
        const allItems: Item[] = Object.entries(rawStorage).map(([itemId, quantity]) => {
            const staticData = ITEM_CATALOG[itemId];

            if (!staticData) {
                console.error(`[HYDRATION ERROR] Item ID ${itemId} found in user ${userId}'s ${SK} but missing from ITEM_CATALOG.`);
            }

            return {
                itemId,
                quantity,
                ...staticData,
            } as Item;
        });

        // Paginate in memory
        const totalPages = Math.ceil(allItems.length / limit);
        const startIndex = (currentPage - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedItems = allItems.slice(startIndex, endIndex);
        
        return {
            itemMap: paginatedItems,
            totalPages,
            currentPage,
            hasMore: currentPage < totalPages
        };
    }

    public async getItemCount(userId: string, location: 'bag' | 'storage'): Promise<number> {
        const PK = `User#${userId}`;
        const SK = `Inventory#${location}`;

        const result = await dynamoDBService.getEntity<{ itemMap?: Record<string, number> }>(table, {PK: PK, SK: SK});
        const rawInventory = result?.itemMap || {};
        
        // Return count of unique item types (not total quantity)
        return Object.keys(rawInventory).length;
    }

    public async addItem(userId: string, itemId: string, quantity: number, location: 'bag' | 'storage'): Promise<void> {
        if (quantity <= 0) {
            throw new Error("Quantity to add must be positive.");
        }
        
        // Check capacity only if adding to bag and it's a new item type
        if (location === 'bag') {
            const canAdd = await this.canAddItem(userId, itemId, location);
            if (!canAdd) {
                throw new Error(`Bag is full. Cannot add new item types. Maximum capacity: ${MAX_INVENTORY_CAPACITY}`);
            }
        }

        const PK = `User#${userId}`;
        const SK = `Inventory#${location}`;

        // Ensure itemMap exists before updating
        await this.ensureInventoryExists(userId, location);

        // Now we can safely update the item
        await dynamoDBService.updateEntity(
            table, 
            {PK: PK, SK: SK},
            `SET itemMap.${itemId} = if_not_exists(itemMap.${itemId}, :start) + :q`,
            {":q": quantity, ":start": 0}
        )
    }

    public async removeItem(userId: string, itemId: string, quantity: number, location: 'bag' | 'storage'): Promise<number> {    
        if (quantity <= 0) {
            throw new Error("Quantity to remove must be positive.");
        }
        const PK = `User#${userId}`;
        const SK = `Inventory#${location}`;

        const response = await dynamoDBService.updateEntity(
            table, 
            {PK: PK, SK: SK},
            `SET itemMap.${itemId} = itemMap.${itemId} - :q`,
            {":q" : quantity},
            `attribute_exists(itemMap.${itemId}) AND itemMap.${itemId} >= :q`,
            "ALL_NEW"
        )

        // The new quantity is returned in the response attributes
        const newQuantity = response.Attributes?.itemMap?.[itemId];

        if (newQuantity !== undefined && newQuantity <= 0) {
            // If the quantity is 0 or less, we proceed to clean up the item key.
            try {
                await dynamoDBService.updateEntity(
                    table, {PK: PK, SK: SK},
                    `REMOVE itemMap.${itemId}`
                );
                console.log(`Cleaned up zero quantity item ${itemId} from ${SK} for user ${PK}.`);
            } catch (error) {
                // Log the error but don't re-throw, as the primary operation (subtraction) succeeded.
                console.error(`Cleanup failed for ${itemId}:`, error);
            }
            return 0;
        }
    
        return newQuantity || 0; // Should be > 0 here
    }

    public async moveItem(userId: string, itemId: string, quantity: number, from: 'bag' | 'storage', to: 'bag' | 'storage'): Promise<void> {
        if (from === to) {
            throw new Error("Source and destination locations are the same.");
        }

        if (quantity <= 0) {
            throw new Error("Quantity to move must be positive.");
        }

        const PK = `User#${userId}`;
        const fromSK = `Inventory#${from}`;
        const toSK = `Inventory#${to}`;

        // Check if moving to bag would exceed capacity
        if (to === 'bag') {
            const currentCount = await this.getItemCount(userId, 'bag');
            // Check if this is a new item type (not already in bag)
            const bagResult = await dynamoDBService.getEntity<{ itemMap?: Record<string, number> }>(table, {PK: PK, SK: toSK});
            const bagItems = bagResult?.itemMap || {};
            
            if (!bagItems[itemId] && currentCount >= MAX_INVENTORY_CAPACITY) {
                throw new Error(`Bag is full. Cannot add new item types. Current: ${currentCount}/${MAX_INVENTORY_CAPACITY}`);
            }
        }

        // Ensure destination itemMap exists before transaction
        await this.ensureInventoryExists(userId, to);

        // Use transaction to ensure atomicity
        const transactItems = [
            {
                // Subtract from source
                Update: {
                    TableName: table,
                    Key: { PK: PK, SK: fromSK },
                    UpdateExpression: `SET itemMap.${itemId} = itemMap.${itemId} - :q`,
                    ConditionExpression: `attribute_exists(itemMap.${itemId}) AND itemMap.${itemId} >= :q`,
                    ExpressionAttributeValues: { ":q": quantity }
                }
            },
            {
                // Add to destination (itemMap now exists)
                Update: {
                    TableName: table,
                    Key: { PK: PK, SK: toSK },
                    UpdateExpression: `SET itemMap.${itemId} = if_not_exists(itemMap.${itemId}, :start) + :q`,
                    ConditionExpression: `attribute_exists(itemMap)`,
                    ExpressionAttributeValues: { 
                        ":q": quantity, 
                        ":start": 0
                    }
                }
            }
        ];

        await dynamoDBService.transactWriteItems(transactItems);

        // Clean up if quantity becomes zero in source
        const fromResult = await dynamoDBService.getEntity<{ itemMap?: Record<string, number> }>(table, {PK: PK, SK: fromSK});
        const remainingQuantity = fromResult?.itemMap?.[itemId];

        if (remainingQuantity !== undefined && remainingQuantity <= 0) {
            try {
                await dynamoDBService.updateEntity(
                    table,
                    { PK: PK, SK: fromSK },
                    `REMOVE itemMap.${itemId}`
                );
                console.log(`Cleaned up zero quantity item ${itemId} from ${fromSK} for user ${PK}.`);
            } catch (error) {
                console.error(`Cleanup failed for ${itemId}:`, error);
            }
        }
    }

    public async hasItem(userId: string, itemId: string, quantity: number, location: 'bag' | 'storage'): Promise<boolean> {
        const PK = `User#${userId}`;
        const SK = `Inventory#${location}`;

        const result = await dynamoDBService.getEntity<{ itemMap?: Record<string, number> }>(table, {PK: PK, SK: SK});
        const rawInventory = result?.itemMap || {};
        
        if (!rawInventory[itemId]) {
            return false;
        }

        return rawInventory[itemId] >= quantity;
    }

    public async canAddItem(userId: string, itemId: string, location: 'bag' | 'storage'): Promise<boolean> {
        if (location === 'storage') {
            return true; // Storage is unlimited
        }
        
        const PK = `User#${userId}`;
        const SK = `Inventory#${location}`;
        
        const result = await dynamoDBService.getEntity<{ itemMap?: Record<string, number> }>(table, {PK: PK, SK: SK});
        const rawInventory = result?.itemMap || {};
        
        // If item already exists, we can always add more
        if (rawInventory[itemId]) {
            return true;
        }
        
        // If it's a new item, check if we have room
        const currentCount = Object.keys(rawInventory).length;
        return currentCount < MAX_INVENTORY_CAPACITY;
    }
}

export const inventoryService = new InventoryService();
