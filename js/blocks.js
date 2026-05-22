// Block Definitions
// Atlas layout (col, row) — 4×4 grid, 16×16 px per tile, 64×64 px total:
//  Row 0: [0,0]=GrassTop  [1,0]=GrassSide  [2,0]=Dirt      [3,0]=Stone
//  Row 1: [0,1]=Sand      [1,1]=Wood(log)   [2,1]=Leaves    [3,1]=Water
//  Row 2: [0,2]=Planks    [1,2]=CraftTableTop [2,2]=Cobblestone [3,2]=Furnace
//  Row 3: [0,3]=Stick     [1,3]=Chest       [2,3]=Glass     [3,3]=Tools
export const BLOCK = {
    AIR:            { id: 0,  name: 'Air' },
    STONE:          { id: 1,  name: 'Stone',          color: 0x808080, uv: { all: [3, 0] }, damping: 0.72, breakTime: 1.5 },
    DIRT:           { id: 2,  name: 'Dirt',            color: 0x805020, uv: { all: [2, 0] }, damping: 0.68, breakTime: 0.5 },
    GRASS:          { id: 3,  name: 'Grass',           color: 0x559020, uv: { top: [0, 0], side: [1, 0], bottom: [2, 0] }, damping: 0.64, breakTime: 0.6 },
    SAND:           { id: 4,  name: 'Sand',            color: 0xdacfa3, uv: { all: [0, 1] }, damping: 0.58, breakTime: 0.5 },
    WATER:          { id: 5,  name: 'Water',           color: 0x4080c0, uv: { all: [3, 1] }, transparent: true, solid: false },
    WOOD:           { id: 6,  name: 'Wood',            color: 0x604020, uv: { all: [1, 1] }, damping: 0.72, breakTime: 2.0 },
    LEAVES:         { id: 7,  name: 'Leaves',          color: 0x208020, uv: { all: [2, 1] }, transparent: true, damping: 0.70, breakTime: 0.2 },
    ICE:            { id: 8,  name: 'Ice',             color: 0x89CFF0, uv: { all: [2, 3] }, transparent: true, damping: 0.995, breakTime: 0.5 },
    PLANKS:         { id: 9,  name: 'Planks',          color: 0xC8A464, uv: { all: [0, 2] }, damping: 0.72, breakTime: 0.8 },
    CRAFTING_TABLE: { id: 10, name: 'Crafting Table',  color: 0xA0522D, uv: { top: [1, 2], side: [0, 2], bottom: [0, 2] }, damping: 0.72, breakTime: 1.0 },
    COBBLESTONE:    { id: 11, name: 'Cobblestone',     color: 0x606060, uv: { all: [2, 2] }, damping: 0.72, breakTime: 2.0 },
    GLASS:          { id: 12, name: 'Glass',           color: 0xC8E8FF, uv: { all: [2, 3] }, transparent: true, damping: 0.72, breakTime: 0.3 },
    // Non-placeable crafting items (placeable: false means they can't be placed in the world)
    STICK:          { id: 13, name: 'Stick',           color: 0xA0522D, uv: { all: [0, 3] }, placeable: false },
    COAL:           { id: 14, name: 'Coal',            color: 0x333333, uv: { all: [3, 0] }, placeable: false },
    // Placeable craftable blocks
    FURNACE:        { id: 15, name: 'Furnace',         color: 0x808080, uv: { side: [3, 2], top: [2, 2], bottom: [3, 0] }, damping: 0.72, breakTime: 1.5 },
    CHEST:          { id: 16, name: 'Chest',           color: 0xA0522D, uv: { all: [1, 3] }, damping: 0.72, breakTime: 1.0 },
    TORCH:          { id: 17, name: 'Torch',           color: 0xFFCC00, uv: { all: [0, 1] }, damping: 0.72, breakTime: 0.1 },
    // Non-placeable tools
    WOODEN_PICKAXE: { id: 18, name: 'Wooden Pickaxe',  color: 0xC8A464, uv: { all: [3, 3] }, placeable: false },
    WOODEN_SWORD:   { id: 19, name: 'Wooden Sword',    color: 0xC8A464, uv: { all: [3, 3] }, placeable: false },
    WOODEN_AXE:     { id: 20, name: 'Wooden Axe',      color: 0xC8A464, uv: { all: [3, 3] }, placeable: false },
    WOODEN_SHOVEL:  { id: 21, name: 'Wooden Shovel',   color: 0xC8A464, uv: { all: [3, 3] }, placeable: false },
};

export const BLOCK_BY_ID = Object.fromEntries(
    Object.values(BLOCK).map(block => [block.id, block])
);

// Texture mapping constants
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 4;
export const TILE_SIZE_UV = 1 / ATLAS_COLS;
export const TILE_HEIGHT_UV = 1 / ATLAS_ROWS;
