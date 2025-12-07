# Pet Feature

Virtual pet simulator feature for Xiuh.

## Overview

The pet feature allows users to adopt and care for virtual pets. Users can:
- Adopt pets of different species
- Feed pets with various food items
- Manage inventory and storage
- Claim daily rewards

## Structure

```
pet/
├── commands/
│   └── pet.ts          # Discord slash command handlers
├── services/
│   ├── pet.service.ts      # Pet data management (adoption, feeding, hunger)
│   └── inventory.service.ts # Inventory and storage management
├── constants/
│   ├── pet-species.ts      # Available pet species definitions
│   └── items.ts            # Item definitions (food items, hunger restoration)
├── types.ts            # Pet-specific TypeScript types
└── README.md           # This file
```

## Components

### Commands (`commands/pet.ts`)

Discord slash command with subcommands:
- `/pet adopt` - Adopt a new pet (species selection + naming)
- `/pet info` - View pet information (hunger, species, stats)
- `/pet bag` - Manage inventory and storage (view, store, use items)
- `/pet daily` - Claim daily reward
- `/pet rename` - Rename pet

### Services

#### `pet.service.ts`
- Manages pet data in DynamoDB
- Calculates hunger on-demand based on decay rate
- Handles pet adoption and feeding

#### `inventory.service.ts`
- Manages user inventory (limited capacity) and storage (unlimited, paginated)
- Handles item addition, removal, and movement between inventory/storage
- Enforces inventory capacity limits

### Constants

#### `pet-species.ts`
- Defines available pet species
- Each species has an ID, name, and image URL

#### `items.ts`
- Defines food items
- Each item has various values.

### Types (`types.ts`)

- `Pet` - Pet data structure
- `PetSpecies` - Species definition
- `InventoryItem` - Item in inventory/storage
- `ItemDefinition` - Item metadata
- `HungerState` - Tiered hunger states (full, satisfied, fine, hungry, starving)
- Constants: `MAX_INVENTORY_CAPACITY`, `STORAGE_PAGE_SIZE`

## Hunger System

- Hunger is tracked as a numeric value (0-100) but displayed as tiered states
- Hunger decays at 1 point per hour
- Calculated on-demand based on `last_fed_at` timestamp

## Feeding System

- Different food items restore different amounts of hunger
- Items are consumed from inventory when feeding
- Hunger is capped at 100

## Database

- **Pets Table**: `xiuh-pets` (partition key: `user_id`)
- **Inventory Table**: `xiuh-inventory` (partition key: `user_id`, sort key: `item_id#location`)

## Dependencies

- Shared services: `../../services/dynamodb.service`
- Shared types: `../../types` (Command interface)

