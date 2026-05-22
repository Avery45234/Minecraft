import { BLOCK, BLOCK_BY_ID } from './blocks.js';
import { player } from './player.js';
import { HOTBAR_SLOTS, INVENTORY_SLOTS, TOTAL_INVENTORY_SLOTS, INVENTORY_MAX_STACK } from './constants.js';
import { matchRecipe, consumeIngredients } from './crafting.js';

// DOM Elements
const hotbarContainer = document.getElementById('hotbar');
const inventoryScreen = document.getElementById('inventory-screen');
const inventoryGrid = document.getElementById('inventory-grid');
const inventoryHotbar = document.getElementById('inventory-hotbar');
export const startScreen = document.getElementById('start-screen');

// State
export let activeHotbarIndex = 0;
export let inventoryOpen = false;
let selectedInventorySlot = null;

// Crafting table state (3x3 grid)
const craftingTableGrid = new Array(9).fill(null);
export let craftingTableOpen = false;

// Crafting state (2x2 grid, index 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right)
const craftingGrid = [null, null, null, null];


function setupCraftingUI() {
    const craftingSlotEls = document.querySelectorAll('#crafting-grid .slot');
    const resultSlotEl = document.querySelector('#crafting-result .slot');

    craftingSlotEls.forEach((el, i) => {
        el.addEventListener('click', () => onCraftingSlotClick(i));
    });

    if (resultSlotEl) {
        resultSlotEl.addEventListener('click', onCraftingResultClick);
    }
}

function onCraftingSlotClick(index) {
    const cell = craftingGrid[index];
    if (cell) {
        // Return item to inventory
        addToInventory(cell.id, cell.count);
        craftingGrid[index] = null;
        updateInventoryUI();
        return;
    }
    // Place 1 from selected inventory slot
    if (selectedInventorySlot !== null) {
        const invItem = player.inventory[selectedInventorySlot];
        if (invItem) {
            craftingGrid[index] = { id: invItem.id, count: 1 };
            invItem.count--;
            if (invItem.count <= 0) player.inventory[selectedInventorySlot] = null;
            selectedInventorySlot = null;
            updateHotbar();
        }
    }
    updateInventoryUI();
}

function onCraftingResultClick() {
    const recipe = matchRecipe(craftingGrid, 2);
    if (!recipe) return;
    addToInventory(recipe.result.id, recipe.result.count);
    consumeIngredients(craftingGrid, recipe);
    updateInventoryUI();
}

function refreshCraftingUI() {
    const craftingSlotEls = document.querySelectorAll('#crafting-grid .slot');
    const resultSlotEl = document.querySelector('#crafting-result .slot');

    craftingSlotEls.forEach((el, i) => {
        el.className = 'slot';
        el.style.backgroundImage = '';
        el.style.backgroundSize = '';
        el.style.backgroundPosition = '';
        el.innerHTML = '';
        const cell = craftingGrid[i];
        if (cell && BLOCK_BY_ID[cell.id]) {
            applyBlockIcon(el, BLOCK_BY_ID[cell.id], 45);
            if (cell.count > 1) {
                const countEl = document.createElement('div');
                countEl.className = 'count';
                countEl.textContent = cell.count;
                el.appendChild(countEl);
            }
        } else {
            el.classList.add('empty');
        }
    });

    if (resultSlotEl) {
        const recipe = matchRecipe(craftingGrid, 2);
        resultSlotEl.className = 'slot';
        resultSlotEl.style.backgroundImage = '';
        resultSlotEl.style.backgroundSize = '';
        resultSlotEl.style.backgroundPosition = '';
        resultSlotEl.innerHTML = '';
        if (recipe && BLOCK_BY_ID[recipe.result.id]) {
            applyBlockIcon(resultSlotEl, BLOCK_BY_ID[recipe.result.id], 45);
            if (recipe.result.count > 1) {
                const countEl = document.createElement('div');
                countEl.className = 'count';
                countEl.textContent = recipe.result.count;
                resultSlotEl.appendChild(countEl);
            }
        } else {
            resultSlotEl.classList.add('empty');
        }
    }
}

function onCraftingTableSlotClick(index) {
    const cell = craftingTableGrid[index];
    if (cell) {
        addToInventory(cell.id, cell.count);
        craftingTableGrid[index] = null;
        updateCraftingTableInventory();
        return;
    }
    if (selectedInventorySlot !== null) {
        const invItem = player.inventory[selectedInventorySlot];
        if (invItem) {
            craftingTableGrid[index] = { id: invItem.id, count: 1 };
            invItem.count--;
            if (invItem.count <= 0) player.inventory[selectedInventorySlot] = null;
            selectedInventorySlot = null;
            updateHotbar();
        }
    }
    updateCraftingTableInventory();
}

function onCraftingTableResultClick() {
    const recipe = matchRecipe(craftingTableGrid, 3);
    if (!recipe) return;
    addToInventory(recipe.result.id, recipe.result.count);
    consumeIngredients(craftingTableGrid, recipe);
    updateCraftingTableInventory();
}

function setupCraftingTableUI() {
    const craftingTableSlotEls = document.querySelectorAll('#crafting-table-grid .slot');
    const resultSlotEl = document.querySelector('#crafting-table-result .slot');

    craftingTableSlotEls.forEach((el, i) => {
        el.addEventListener('click', () => onCraftingTableSlotClick(i));
    });

    if (resultSlotEl) {
        resultSlotEl.addEventListener('click', onCraftingTableResultClick);
    }
}

function refreshCraftingTableUI() {
    const craftingTableSlotEls = document.querySelectorAll('#crafting-table-grid .slot');
    const resultSlotEl = document.querySelector('#crafting-table-result .slot');

    craftingTableSlotEls.forEach((el, i) => {
        el.className = 'slot';
        el.style.backgroundImage = '';
        el.style.backgroundSize = '';
        el.style.backgroundPosition = '';
        el.innerHTML = '';
        const cell = craftingTableGrid[i];
        if (cell && BLOCK_BY_ID[cell.id]) {
            applyBlockIcon(el, BLOCK_BY_ID[cell.id], 45);
            if (cell.count > 1) {
                const countEl = document.createElement('div');
                countEl.className = 'count';
                countEl.textContent = cell.count;
                el.appendChild(countEl);
            }
        } else {
            el.classList.add('empty');
        }
    });

    if (resultSlotEl) {
        const recipe = matchRecipe(craftingTableGrid, 3);
        resultSlotEl.className = 'slot';
        resultSlotEl.style.backgroundImage = '';
        resultSlotEl.style.backgroundSize = '';
        resultSlotEl.style.backgroundPosition = '';
        resultSlotEl.innerHTML = '';
        if (recipe && BLOCK_BY_ID[recipe.result.id]) {
            applyBlockIcon(resultSlotEl, BLOCK_BY_ID[recipe.result.id], 45);
            if (recipe.result.count > 1) {
                const countEl = document.createElement('div');
                countEl.className = 'count';
                countEl.textContent = recipe.result.count;
                resultSlotEl.appendChild(countEl);
            }
        } else {
            resultSlotEl.classList.add('empty');
        }
    }
}

function updateCraftingTableInventory() {
    const craftingTableInventoryGrid = document.getElementById('crafting-table-inventory-grid');
    const craftingTableInventoryHotbar = document.getElementById('crafting-table-inventory-hotbar');

    if (!craftingTableInventoryGrid || !craftingTableInventoryHotbar) return;

    craftingTableInventoryGrid.innerHTML = '';
    craftingTableInventoryHotbar.innerHTML = '';

    for (let i = 0; i < TOTAL_INVENTORY_SLOTS; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.slotIndex = i;

        const item = player.inventory[i];
        if (item && BLOCK_BY_ID[item.id]) {
            applyBlockIcon(slot, BLOCK_BY_ID[item.id], 45);
            const countElement = document.createElement('div');
            countElement.className = 'count';
            countElement.textContent = item.count > 1 ? item.count : '';
            slot.appendChild(countElement);
            const nameElement = document.createElement('div');
            nameElement.className = 'name';
            nameElement.textContent = BLOCK_BY_ID[item.id].name;
            slot.appendChild(nameElement);
        } else {
            slot.classList.add('empty');
        }

        if (selectedInventorySlot === i) slot.classList.add('selected');
        slot.addEventListener('click', () => onInventorySlotClick(i));

        if (i < INVENTORY_SLOTS) {
            craftingTableInventoryGrid.appendChild(slot);
        } else {
            craftingTableInventoryHotbar.appendChild(slot);
        }
    }

    refreshCraftingTableUI();
}

export function openCraftingTable(controls) {
    craftingTableOpen = true;
    document.getElementById('crafting-table-screen').style.display = 'flex';
    startScreen.style.display = 'none';
    updateCraftingTableInventory();
    if (controls.isLocked) controls.unlock();
}

export function closeCraftingTable(controls, requestGameLock) {
    // Return crafting grid items to inventory
    for (let i = 0; i < 9; i++) {
        if (craftingTableGrid[i]) {
            addToInventory(craftingTableGrid[i].id, craftingTableGrid[i].count);
            craftingTableGrid[i] = null;
        }
    }
    craftingTableOpen = false;
    document.getElementById('crafting-table-screen').style.display = 'none';
    requestGameLock();
}

export function initUI(controls, requestGameLock) {
    document.getElementById('start-button').addEventListener('click', () => {
        inventoryOpen = false;
        startScreen.style.display = 'none';
        inventoryScreen.style.display = 'none';
        requestGameLock();
    });

    controls.addEventListener('lock', () => {
        inventoryOpen = false;
        startScreen.style.display = 'none';
        inventoryScreen.style.display = 'none';
    });

    controls.addEventListener('unlock', () => {
        if (!inventoryOpen && !craftingTableOpen) {
            startScreen.style.display = 'flex';
        }
    });

    document.getElementById('container').addEventListener('click', () => {
        if (!inventoryOpen && !controls.isLocked) {
            startScreen.style.display = 'none';
            requestGameLock();
        }
    });

    setupCraftingUI();
    setupCraftingTableUI();
}

export function toggleInventory(controls, requestGameLock) {
    if (!inventoryOpen) {
        inventoryOpen = true;
        inventoryScreen.style.display = 'flex';
        startScreen.style.display = 'none';
        updateInventoryUI();
        if (controls.isLocked) {
            controls.unlock();
        }
    } else {
        // Return any items left in crafting grid to inventory
        for (let i = 0; i < 4; i++) {
            if (craftingGrid[i]) {
                addToInventory(craftingGrid[i].id, craftingGrid[i].count);
                craftingGrid[i] = null;
            }
        }
        inventoryOpen = false;
        inventoryScreen.style.display = 'none';
        startScreen.style.display = 'none';
        selectedInventorySlot = null;
        requestGameLock();
    }
}

export function setActiveHotbarIndex(index) {
    if (index >= 0 && index < HOTBAR_SLOTS) {
        activeHotbarIndex = index;
        updateHotbar();
    }
}

export function cycleHotbar(direction) {
    if (direction < 0) {
        activeHotbarIndex = (activeHotbarIndex - 1 + HOTBAR_SLOTS) % HOTBAR_SLOTS;
    } else {
        activeHotbarIndex = (activeHotbarIndex + 1) % HOTBAR_SLOTS;
    }
    updateHotbar();
}

function applyBlockIcon(slot, blockData, slotSize = 40) {
    if (!blockData) return;
    if (!blockData.uv) {
        const hex = blockData.color ? blockData.color.toString(16).padStart(6, '0') : '888888';
        slot.style.backgroundColor = '#' + hex;
        slot.style.backgroundImage = '';
        return;
    }
    const ATLAS_COLS = 4, ATLAS_ROWS = 4;
    const uv = blockData.uv;
    const tile = uv.all || uv.side || uv.top;
    if (!tile) return;
    const bgW = slotSize * ATLAS_COLS;
    const bgH = slotSize * ATLAS_ROWS;
    const ox = tile[0] * slotSize;
    const oy = tile[1] * slotSize;
    slot.style.backgroundImage = `url('assets/atlas.svg')`;
    slot.style.backgroundSize = `${bgW}px ${bgH}px`;
    slot.style.backgroundPosition = `-${ox}px -${oy}px`;
    slot.style.backgroundColor = '';
    slot.style.imageRendering = 'pixelated';
}

export function updateHotbar() {
    hotbarContainer.innerHTML = '';
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        if (i === activeHotbarIndex) slot.classList.add('active');

        const item = player.inventory[INVENTORY_SLOTS + i];
        if (item && BLOCK_BY_ID[item.id]) {
            applyBlockIcon(slot, BLOCK_BY_ID[item.id], 40);
            const countElement = document.createElement('div');
            countElement.className = 'count';
            countElement.textContent = item.count > 1 ? item.count : '';
            slot.appendChild(countElement);
        } else {
            slot.classList.add('empty');
        }
        hotbarContainer.appendChild(slot);
    }
}

export function updateInventoryUI() {
    if (!inventoryOpen) return;

    inventoryGrid.innerHTML = '';
    inventoryHotbar.innerHTML = '';

    for (let i = 0; i < TOTAL_INVENTORY_SLOTS; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.slotIndex = i;

        const item = player.inventory[i];
        if (item && BLOCK_BY_ID[item.id]) {
            applyBlockIcon(slot, BLOCK_BY_ID[item.id], 45);
            const countElement = document.createElement('div');
            countElement.className = 'count';
            countElement.textContent = item.count > 1 ? item.count : '';
            slot.appendChild(countElement);
            const nameElement = document.createElement('div');
            nameElement.className = 'name';
            nameElement.textContent = BLOCK_BY_ID[item.id].name;
            slot.appendChild(nameElement);
        } else {
            slot.classList.add('empty');
        }

        if (selectedInventorySlot === i) slot.classList.add('selected');
        slot.addEventListener('click', () => onInventorySlotClick(i));

        if (i < INVENTORY_SLOTS) {
            inventoryGrid.appendChild(slot);
        } else {
            inventoryHotbar.appendChild(slot);
        }
    }

    refreshCraftingUI();
}

function onInventorySlotClick(slotIndex) {
    if (selectedInventorySlot === null) {
        if (player.inventory[slotIndex]) {
            selectedInventorySlot = slotIndex;
        }
    } else {
        [player.inventory[selectedInventorySlot], player.inventory[slotIndex]] =
            [player.inventory[slotIndex], player.inventory[selectedInventorySlot]];
        selectedInventorySlot = null;
        updateHotbar();
    }
    updateInventoryUI();
}

function findFirstEmptyInventorySlot() {
    // Fill hotbar first (slots INVENTORY_SLOTS..TOTAL-1), then main inventory
    for (let i = INVENTORY_SLOTS; i < TOTAL_INVENTORY_SLOTS; i++) {
        if (!player.inventory[i]) return i;
    }
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
        if (!player.inventory[i]) return i;
    }
    return -1;
}

function findFirstStackableInventorySlot(blockId) {
    for (let i = 0; i < TOTAL_INVENTORY_SLOTS; i++) {
        const item = player.inventory[i];
        if (item && item.id === blockId && item.count < INVENTORY_MAX_STACK) return i;
    }
    return -1;
}

export function addToInventory(blockId, count = 1) {
    for (let c = 0; c < count; c++) {
        const stackableSlot = findFirstStackableInventorySlot(blockId);
        if (stackableSlot !== -1) {
            player.inventory[stackableSlot].count++;
        } else {
            const emptySlot = findFirstEmptyInventorySlot();
            if (emptySlot !== -1) {
                player.inventory[emptySlot] = { id: blockId, count: 1 };
            }
        }
    }
    updateHotbar();
    updateInventoryUI();
}

export function removeFromInventory(slotIndex) {
    const item = player.inventory[slotIndex];
    if (item) {
        item.count--;
        if (item.count <= 0) player.inventory[slotIndex] = null;
        updateHotbar();
        updateInventoryUI();
        return true;
    }
    return false;
}
