import * as THREE from 'three';
import { BLOCK_BY_ID } from './blocks.js';
import { player } from './player.js';
import { HOTBAR_SLOTS, INVENTORY_SLOTS, TOTAL_INVENTORY_SLOTS, INVENTORY_MAX_STACK } from './constants.js';
import { checkCrafting } from './crafting.js';

// DOM Elements
const hotbarContainer = document.getElementById('hotbar');
const inventoryScreen = document.getElementById('inventory-screen');
const inventoryGrid = document.getElementById('inventory-grid');
const inventoryHotbar = document.getElementById('inventory-hotbar');
const craftingGrid = document.getElementById('crafting-grid');
const craftingResult = document.getElementById('crafting-result');
export const startScreen = document.getElementById('start-screen');

// State
export let activeHotbarIndex = 0;
export let inventoryOpen = false;
let selectedInventorySlot = null;
let craftingGridItems = [null, null, null, null];
let craftingResultItem = null;


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
        if (!inventoryOpen) {
            startScreen.style.display = 'flex';
        }
    });

    document.getElementById('container').addEventListener('click', () => {
        if (!inventoryOpen && !controls.isLocked) {
            startScreen.style.display = 'none';
            requestGameLock();
        }
    });
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
        // Return crafting items to inventory
        for(let i = 0; i < craftingGridItems.length; i++) {
            if(craftingGridItems[i]) {
                const item = craftingGridItems[i];
                const stackableSlot = findFirstStackableInventorySlot(item.id, INVENTORY_SLOTS + HOTBAR_SLOTS);
                if (stackableSlot !== -1) {
                    player.inventory[stackableSlot].count += item.count;
                } else {
                    const emptySlot = findFirstEmptyInventorySlot(INVENTORY_SLOTS + HOTBAR_SLOTS);
                    if (emptySlot !== -1) {
                        player.inventory[emptySlot] = item;
                    }
                }
                craftingGridItems[i] = null;
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

function createSlotElement(item) {
    const slot = document.createElement('div');
    slot.className = 'slot';

    if (item) {
        const blockData = BLOCK_BY_ID[item.id];
        const itemElement = document.createElement('div');
        itemElement.className = 'item';
        itemElement.style.backgroundColor = `#${new THREE.Color(blockData.color).getHexString()}`;
        slot.appendChild(itemElement);

        const countElement = document.createElement('div');
        countElement.className = 'count';
        countElement.textContent = item.count > 1 ? item.count : '';
        slot.appendChild(countElement);
    } else {
        slot.classList.add('empty');
    }
    return slot;
}

export function updateHotbar() {
    hotbarContainer.innerHTML = '';
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const item = player.inventory[INVENTORY_SLOTS + i];
        const slot = createSlotElement(item);
        if (i === activeHotbarIndex) {
            slot.classList.add('active');
        }
        hotbarContainer.appendChild(slot);
    }
}

export function updateInventoryUI() {
    if (!inventoryOpen) return;
    
    inventoryGrid.innerHTML = '';
    inventoryHotbar.innerHTML = '';
    craftingGrid.innerHTML = '';
    craftingResult.innerHTML = '';

    // Main Inventory
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
        const slot = createSlotElement(player.inventory[i]);
        slot.dataset.slotIndex = i;
        if (selectedInventorySlot === i) slot.classList.add('selected');
        slot.addEventListener('click', () => onInventorySlotClick(i));
        inventoryGrid.appendChild(slot);
    }

    // Hotbar in Inventory
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const slotIndex = INVENTORY_SLOTS + i;
        const slot = createSlotElement(player.inventory[slotIndex]);
        slot.dataset.slotIndex = slotIndex;
        if (selectedInventorySlot === slotIndex) slot.classList.add('selected');
        slot.addEventListener('click', () => onInventorySlotClick(slotIndex));
        inventoryHotbar.appendChild(slot);
    }

    // Crafting Grid
    for(let i = 0; i < 4; i++) {
        const slot = createSlotElement(craftingGridItems[i]);
        slot.dataset.craftingIndex = i;
        slot.addEventListener('click', () => onCraftingGridClick(i));
        craftingGrid.appendChild(slot);
    }

    // Crafting Result
    const resultSlot = createSlotElement(craftingResultItem);
    resultSlot.addEventListener('click', onCraftingResultClick);
    craftingResult.appendChild(resultSlot);
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

function onCraftingGridClick(craftingIndex) {
    if (selectedInventorySlot !== null) {
        // Move item from inventory to crafting grid
        const inventoryItem = player.inventory[selectedInventorySlot];
        if (craftingGridItems[craftingIndex] === null) {
            craftingGridItems[craftingIndex] = { id: inventoryItem.id, count: 1 };
            inventoryItem.count--;
            if (inventoryItem.count <= 0) {
                player.inventory[selectedInventorySlot] = null;
                selectedInventorySlot = null;
            }
        } else if (craftingGridItems[craftingIndex].id === inventoryItem.id) {
            craftingGridItems[craftingIndex].count++;
            inventoryItem.count--;
            if (inventoryItem.count <= 0) {
                player.inventory[selectedInventorySlot] = null;
                selectedInventorySlot = null;
            }
        }
    } else {
        // Move item from crafting grid to inventory
        if (craftingGridItems[craftingIndex]) {
            const item = craftingGridItems[craftingIndex];
            const stackableSlot = findFirstStackableInventorySlot(item.id, TOTAL_INVENTORY_SLOTS);
            if (stackableSlot !== -1) {
                player.inventory[stackableSlot].count += item.count;
            } else {
                const emptySlot = findFirstEmptyInventorySlot(TOTAL_INVENTORY_SLOTS);
                if (emptySlot !== -1) {
                    player.inventory[emptySlot] = item;
                }
            }
            craftingGridItems[craftingIndex] = null;
        }
    }
    updateCraftingResult();
    updateInventoryUI();
    updateHotbar();
}

function updateCraftingResult() {
    const grid = [
        [craftingGridItems[0], craftingGridItems[1]],
        [craftingGridItems[2], craftingGridItems[3]]
    ];
    craftingResultItem = checkCrafting(grid);
}

function onCraftingResultClick() {
    if (craftingResultItem) {
        // Add result to inventory
        const stackableSlot = findFirstStackableInventorySlot(craftingResultItem.id, TOTAL_INVENTORY_SLOTS);
        if (stackableSlot !== -1) {
            player.inventory[stackableSlot].count += craftingResultItem.count;
        } else {
            const emptySlot = findFirstEmptyInventorySlot(TOTAL_INVENTORY_SLOTS);
            if (emptySlot !== -1) {
                player.inventory[emptySlot] = { ...craftingResultItem };
            }
        }

        // Consume ingredients
        for(let i = 0; i < craftingGridItems.length; i++) {
            if(craftingGridItems[i]) {
                craftingGridItems[i].count--;
                if(craftingGridItems[i].count <= 0) {
                    craftingGridItems[i] = null;
                }
            }
        }
        updateCraftingResult();
        updateInventoryUI();
        updateHotbar();
    }
}

function findFirstEmptyInventorySlot(end = TOTAL_INVENTORY_SLOTS, start = 0) {
    // Prioritize hotbar
    for (let i = INVENTORY_SLOTS; i < TOTAL_INVENTORY_SLOTS; i++) {
        if (!player.inventory[i]) return i;
    }
    // Then main inventory
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
        if (!player.inventory[i]) return i;
    }
    return -1;
}

function findFirstStackableInventorySlot(blockId, end = TOTAL_INVENTORY_SLOTS, start = 0) {
    // Prioritize hotbar
    for (let i = INVENTORY_SLOTS; i < TOTAL_INVENTORY_SLOTS; i++) {
        const item = player.inventory[i];
        if (item && item.id === blockId && item.count < INVENTORY_MAX_STACK) return i;
    }
    // Then main inventory
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
        const item = player.inventory[i];
        if (item && item.id === blockId && item.count < INVENTORY_MAX_STACK) return i;
    }
    return -1;
}

export function addToInventory(blockId) {
    const stackableSlot = findFirstStackableInventorySlot(blockId);
    if (stackableSlot !== -1) {
        player.inventory[stackableSlot].count++;
    } else {
        const emptySlot = findFirstEmptyInventorySlot();
        if (emptySlot !== -1) {
            player.inventory[emptySlot] = { id: blockId, count: 1 };
        }
    }
    updateHotbar();
    updateInventoryUI();
}

export function removeFromInventory(slotIndex) {
    const item = player.inventory[slotIndex];
    if (item) {
        item.count--;
        if (item.count <= 0) {
            player.inventory[slotIndex] = null;
        }
        updateHotbar();
        updateInventoryUI();
        return true;
    }
    return false;
}
