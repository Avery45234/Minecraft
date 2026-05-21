// Block Definitions
export const BLOCK = {
    AIR:    { id: 0, name: 'Air' },
    STONE:  { id: 1, name: 'Stone',  color: 0x808080, uv: { all: [3, 0] }, damping: 0.72, breakTime: 1.5 },
    DIRT:   { id: 2, name: 'Dirt',   color: 0x805020, uv: { all: [2, 0] }, damping: 0.68, breakTime: 0.5 },
    GRASS:  { id: 3, name: 'Grass',  color: 0x559020, uv: { top: [0, 0], side: [1, 0], bottom: [2, 0] }, damping: 0.64, breakTime: 0.6 },
    SAND:   { id: 4, name: 'Sand',   color: 0xdacfa3, uv: { all: [0, 1] }, damping: 0.58, breakTime: 0.5 },
    WATER:  { id: 5, name: 'Water',  color: 0x4080c0, uv: { all: [3, 1] }, transparent: true, solid: false },
    WOOD:   { id: 6, name: 'Wood',   color: 0x604020, uv: { all: [1, 1] }, damping: 0.72, breakTime: 2.0 },
    LEAVES: { id: 7, name: 'Leaves', color: 0x208020, uv: { all: [2, 1] }, transparent: true, damping: 0.70, breakTime: 0.2 },
    ICE:    { id: 8, name: 'Ice',    color: 0x89CFF0, uv: { all: [3, 1] }, transparent: true, damping: 0.995, breakTime: 0.5 }
};

export const BLOCK_BY_ID = Object.fromEntries(
    Object.values(BLOCK).map(block => [block.id, block])
);

// Texture mapping constants
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 2;
export const TILE_SIZE_UV = 1 / ATLAS_COLS;
export const TILE_HEIGHT_UV = 1 / ATLAS_ROWS;
