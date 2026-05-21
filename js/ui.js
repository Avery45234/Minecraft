import * as THREE from 'three';
import { BLOCK_BY_ID } from './blocks.js';
import { player } from './player.js';
import { HOTBAR_SLOTS, INVENTORY_SLOTS, TOTAL_INVENTORY_SLOTS, INVENTORY_MAX_STACK } from './constants.js';

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

export function updateHotbar() {
    hotbarContainer.innerHTML = '';
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        if (i === activeHotbarIndex) {
            slot.classList.add('active');
        }

        const item = player.inventory[INVENTORY_SLOTS + i];
        if (item) {
            const blockData = BLOCK_BY_ID[item.id];
            slot.style.backgroundColor = `#${new THREE.Color(blockData.color).getHexString()}`;
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
        if (item) {
            const blockData = BLOCK_BY_ID[item.id];
            slot.style.backgroundColor = `#${new THREE.Color(blockData.color).getHexString()}`;

            const countElement = document.createElement('div');
            countElement.className = 'count';
            countElement.textContent = item.count > 1 ? item.count : '';
            slot.appendChild(countElement);

            const nameElement = document.createElement('div');
            nameElement.className = 'name';
            nameElement.textContent = blockData.name;
            slot.appendChild(nameElement);
        } else {
            slot.classList.add('empty');
        }
        
        if (selectedInventorySlot === i) {
            slot.classList.add('selected');
        }

        slot.addEventListener('click', () => onInventorySlotClick(i));

        if (i < INVENTORY_SLOTS) {
            inventoryGrid.appendChild(slot);
        } else {
            inventoryHotbar.appendChild(slot);
        }
    }
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
    for (let i = 0; i < TOTAL_INVENTORY_SLOTS; i++) {
        if (!player.inventory[i]) {
            return i;
        }
    }
    return -1;
}

function findFirstStackableInventorySlot(blockId) {
    for (let i = 0; i < TOTAL_INVENTORY_SLOTS; i++) {
        const item = player.inventory[i];
        if (item && item.id === blockId && item.count < INVENTORY_MAX_STACK) {
            return i;
        }
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
