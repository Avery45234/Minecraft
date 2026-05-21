import { BLOCK } from './blocks.js';

// Helper to get block by name
const BLOCK_BY_NAME = Object.fromEntries(Object.entries(BLOCK).map(([key, data]) => [data.name, data]));

export const RECIPES = {
    // 2x2 Recipes
    '2x2': [
        {
            result: { id: BLOCK.PLANKS.id, count: 4 },
            shape: [
                ['Wood', null],
                [null, null]
            ]
        },
        {
            result: { id: BLOCK.PLANKS.id, count: 4 },
            shape: [
                [null, 'Wood'],
                [null, null]
            ]
        },
        {
            result: { id: BLOCK.PLANKS.id, count: 4 },
            shape: [
                [null, null],
                ['Wood', null]
            ]
        },
        {
            result: { id: BLOCK.PLANKS.id, count: 4 },
            shape: [
                [null, null],
                [null, 'Wood']
            ]
        },
        {
            result: { id: BLOCK.CRAFTING_TABLE.id, count: 1 },
            shape: [
                ['Planks', 'Planks'],
                ['Planks', 'Planks']
            ]
        }
    ],
    // 3x3 Recipes would go here
};

export function checkCrafting(grid) {
    // grid is a 2x2 or 3x3 array of block items or null
    const gridSize = grid.length;
    const recipeBook = RECIPES[`${gridSize}x${gridSize}`];
    if (!recipeBook) return null;

    for (const recipe of recipeBook) {
        if (matchRecipe(grid, recipe)) {
            return recipe.result;
        }
    }

    return null;
}

function matchRecipe(grid, recipe) {
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const gridItem = grid[r][c];
            const recipeItemName = recipe.shape[r][c];
            
            if (recipeItemName === null) {
                if (gridItem !== null) return false;
            } else {
                if (gridItem === null || BLOCK_BY_NAME[recipeItemName].id !== gridItem.id) {
                    return false;
                }
            }
        }
    }
    return true;
}
