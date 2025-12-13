# Pet Feature

Virtual pet adoption and care system for the Xihuitl Discord bot.

## Overview

The pet feature allows users to adopt and care for virtual pets with:
- **Interactive adoption** - Browse species with navigation buttons
- **Hunger system** - Pets get hungry over time (1 point/hour decay)
- **Feeding mechanics** - Different foods restore different amounts of hunger
- **Inventory management** - Bag (50 item capacity) and unlimited storage
- **Daily rewards** - Claim food items every 20 hours
- **6 unique species** - Each with distinct types and appearance

## Structure

```
pet/
├── commands/
│   ├── commands.ts       # Main /pet command definition and router
│   ├── adopt.ts          # Interactive species selection & adoption
│   ├── info.ts           # Pet status display
│   ├── feed.ts           # Feeding with autocomplete
│   ├── rename.ts         # Pet renaming
│   ├── bag.ts            # Inventory management (50 capacity)
│   ├── storage.ts        # Unlimited storage with pagination
│   └── daily.ts          # Daily reward claiming
├── services/
│   ├── pet.service.ts        # Pet CRUD, hunger calculation, feeding
│   ├── inventory.service.ts  # Bag/storage management with transactions
│   └── daily.service.ts      # Daily reward cooldown tracking
├── constants/
│   ├── pet-species.ts        # 6 species definitions with types
│   └── items.ts              # Food items with hunger restoration values
├── types.ts              # TypeScript interfaces
└── README.md             # This file
```

## Commands

### `/pet adopt`
- Interactive species selection with navigation buttons
- Modal for naming pet
- One pet per user limit (enforced via DynamoDB transaction)
- **Handler**: `adopt.ts`

### `/pet info`
- View pet status (hunger, species, age)
- Hunger displayed with emoji indicators (🟢 → 🔴)
- **Handler**: `info.ts`

### `/pet feed <item>`
- Feed pet with items from bag (autocomplete)
- Restores hunger based on item value
- **Handler**: `feed.ts`

### `/pet rename <new_name>`
- Change pet's name (max 32 characters)
- **Handler**: `rename.ts`

### `/pet bag [page]`
- View/manage bag inventory (50 item capacity)
- Move items to storage
- **Handler**: `bag.ts`

### `/pet storage [page]`
- View/manage unlimited storage (paginated)
- Move items back to bag
- **Handler**: `storage.ts`

### `/pet daily`
- Claim daily food rewards (20-hour cooldown)
- **Handler**: `daily.ts`

## Hunger System

- Hunger tracked as numeric value (0-100) with emoji states
- Decays at 1 point per hour
- Calculated on-demand based on `lastFedAt` timestamp
- States: 🟢 Full (80-100), 🟡 Satisfied (60-79), 🟠 Fine (40-59), 🔴 Hungry (20-39), 💀 Starving (0-19)

## Feeding System

- Items consumed from bag restore hunger
- Different items restore different amounts
- Hunger capped at 100
- Updates `lastFedAt` timestamp to reflect new hunger state

## Database

**Table**: `xiuh-pets` (single-table design)

**Structure**:
- PK: `User#{userId}`
- SK: `Profile` | `Pet#{petId}` | `Inventory#bag` | `Inventory#storage`

**Example Items**:
```
Profile:        { PK: "User#123", SK: "Profile", activePetId: "uuid" }
Pet:            { PK: "User#123", SK: "Pet#uuid", name: "Fluffy", species: "VIGILUP", hunger: 80 }
Bag Inventory:  { PK: "User#123", SK: "Inventory#bag", items: { "apple": 5 } }
Storage:        { PK: "User#123", SK: "Inventory#storage", items: { "bread": 10 } }
```

## Technical Notes

- In-memory caching for pet data and S3 presigned URLs
- DynamoDB atomic operations for item quantities
- DynamoDB transactions for `moveItem` and `adoptPet`
- Discord.js autocomplete, buttons, modals, and embeds
