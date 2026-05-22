import { BLOCK } from './blocks.js';

// Recipe shapes use 0 for "empty slot required"
// Shaped recipes: { width, height, pattern: number[], result: {id, count} }
// Shapeless recipes: { inputs: number[], result: {id, count} }

const W  = BLOCK.WOOD.id;
const P  = BLOCK.PLANKS.id;
const CB = BLOCK.COBBLESTONE.id;
const SA = BLOCK.SAND.id;
const ST = BLOCK.STICK.id;
const CO = BLOCK.COAL.id;
const FU = BLOCK.FURNACE.id;
const CH = BLOCK.CHEST.id;
const TO = BLOCK.TORCH.id;
const WP = BLOCK.WOODEN_PICKAXE.id;
const WS = BLOCK.WOODEN_SWORD.id;
const WA = BLOCK.WOODEN_AXE.id;
const WH = BLOCK.WOODEN_SHOVEL.id;

export const RECIPES = [
    // ── 2×2 inventory crafting ───────────────────────────────────────────
    // 1 Oak Log → 4 Planks (shapeless)
    { inputs: [W], result: { id: P, count: 4 } },
    // 2 Planks stacked (1×2) → 4 Sticks
    { width: 1, height: 2, pattern: [P, P], result: { id: ST, count: 4 } },
    // 4 Planks (2×2) → 1 Crafting Table
    { width: 2, height: 2, pattern: [P, P, P, P], result: { id: BLOCK.CRAFTING_TABLE.id, count: 1 } },
    // 4 Sand (2×2) → 4 Glass
    { width: 2, height: 2, pattern: [SA, SA, SA, SA], result: { id: BLOCK.GLASS.id, count: 4 } },

    // ── 3×3 crafting table ───────────────────────────────────────────────
    // 8 Cobblestone ring → Furnace
    { width: 3, height: 3, pattern: [CB, CB, CB, CB,  0, CB, CB, CB, CB], result: { id: FU, count: 1 } },
    // 8 Planks ring → Chest
    { width: 3, height: 3, pattern: [P,  P,  P,  P,  0,  P,  P,  P,  P], result: { id: CH, count: 1 } },
    // Stick + Coal (1×2, coal on top) → 4 Torches
    { width: 1, height: 2, pattern: [CO, ST], result: { id: TO, count: 4 } },
    // Wooden Pickaxe: 3 planks top row + 2 sticks center column
    { width: 3, height: 3, pattern: [P, P, P, 0, ST, 0, 0, ST, 0], result: { id: WP, count: 1 } },
    // Wooden Sword: 2 planks + 1 stick (1×3 column)
    { width: 1, height: 3, pattern: [P, P, ST], result: { id: WS, count: 1 } },
    // Wooden Axe: 2×3 left-biased
    { width: 2, height: 3, pattern: [P, P, P, ST, 0, ST], result: { id: WA, count: 1 } },
    // Wooden Shovel: 1 plank + 2 sticks (1×3 column)
    { width: 1, height: 3, pattern: [P, ST, ST], result: { id: WH, count: 1 } },
];

// Returns the matching recipe or null. grid is a row-major array of {id,count}|null.
export function matchRecipe(grid, gridSize) {
    for (const recipe of RECIPES) {
        if (recipe.inputs) {
            if (_matchShapeless(grid, recipe)) return recipe;
        } else if (recipe.width <= gridSize && recipe.height <= gridSize) {
            for (let dy = 0; dy <= gridSize - recipe.height; dy++) {
                for (let dx = 0; dx <= gridSize - recipe.width; dx++) {
                    if (_matchShapedAt(grid, gridSize, recipe, dx, dy)) return recipe;
                }
            }
        }
    }
    return null;
}

// Mutates grid in-place, decrementing/nulling the consumed cells.
export function consumeIngredients(grid, recipe) {
    if (recipe.inputs) {
        const needed = [...recipe.inputs];
        for (let i = 0; i < grid.length; i++) {
            const cell = grid[i];
            if (!cell) continue;
            const idx = needed.indexOf(cell.id);
            if (idx !== -1) {
                needed.splice(idx, 1);
                cell.count--;
                if (cell.count <= 0) grid[i] = null;
            }
        }
    } else {
        const gridSize = Math.round(Math.sqrt(grid.length));
        outer: for (let dy = 0; dy <= gridSize - recipe.height; dy++) {
            for (let dx = 0; dx <= gridSize - recipe.width; dx++) {
                if (_matchShapedAt(grid, gridSize, recipe, dx, dy)) {
                    for (let ry = 0; ry < recipe.height; ry++) {
                        for (let rx = 0; rx < recipe.width; rx++) {
                            if (recipe.pattern[ry * recipe.width + rx] !== 0) {
                                const idx = (ry + dy) * gridSize + (rx + dx);
                                const cell = grid[idx];
                                if (cell) {
                                    cell.count--;
                                    if (cell.count <= 0) grid[idx] = null;
                                }
                            }
                        }
                    }
                    break outer;
                }
            }
        }
    }
}

function _matchShapeless(grid, recipe) {
    const gridIds = grid.filter(Boolean).map(c => c.id).sort((a, b) => a - b);
    const recipeIds = [...recipe.inputs].sort((a, b) => a - b);
    return gridIds.length === recipeIds.length && gridIds.every((id, i) => id === recipeIds[i]);
}

function _matchShapedAt(grid, gridSize, recipe, dx, dy) {
    for (let gy = 0; gy < gridSize; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {
            const cell = grid[gy * gridSize + gx];
            const cellId = cell ? cell.id : 0;
            const rx = gx - dx;
            const ry = gy - dy;
            const inPattern = rx >= 0 && rx < recipe.width && ry >= 0 && ry < recipe.height;
            const required = inPattern ? recipe.pattern[ry * recipe.width + rx] : 0;
            if (cellId !== required) return false;
        }
    }
    return true;
}
