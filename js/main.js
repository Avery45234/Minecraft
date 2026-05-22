import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

import { BLOCK, BLOCK_BY_ID } from './blocks.js';
import { WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH, INVENTORY_SLOTS, HOTBAR_SLOTS } from './constants.js';
import { initWorld, generateWorld, getBlock, setBlock, updateDirtyChunks, chunkMeshes } from './world.js';
import { player, initPlayer, updatePlayer, setCrouch } from './player.js';
import { initUI, updateHotbar, updateInventoryUI, toggleInventory, setActiveHotbarIndex, cycleHotbar, inventoryOpen, activeHotbarIndex, addToInventory, removeFromInventory, craftingTableOpen, openCraftingTable, closeCraftingTable } from './ui.js';
import { initRenderer, renderScene, toggleThirdPerson, getScene, getCamera } from './rendering.js';

// DOM Elements
const container = document.getElementById('container');
const fpsElement = document.getElementById('fps');
const coordsElement = document.getElementById('coords');

let controls;
let clock;

// Input state
const keys = {};

// Block breaking
let isBreaking = false;
let breakProgress = 0;
let breakingBlockPos = new THREE.Vector3();
let breakOverlay;
let breakTexture;

function createCrackTexture() {
    const stages = 10;
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size * stages;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineCap = 'round';
    for (let s = 0; s < stages; s++) {
        const ox = s * size;
        const lines = s;
        ctx.lineWidth = 0.5 + s * 0.1;
        for (let l = 0; l < lines; l++) {
            const angle = (l / lines) * Math.PI * 2 + s * 0.4;
            const len = 3 + l * 1.2;
            const cx2 = ox + size / 2;
            const cy2 = size / 2;
            ctx.beginPath();
            ctx.moveTo(cx2, cy2);
            ctx.lineTo(cx2 + Math.cos(angle) * len, cy2 + Math.sin(angle) * len);
            ctx.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = 1 / stages;
    return tex;
}

function init() {
    const { solidMaterial, transparentMaterial, waterMaterial } = initRenderer(container);
    
    const camera = getCamera();
    const scene = getScene();
    
    camera.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT, WORLD_DEPTH / 2);

    initWorld(scene, solidMaterial, transparentMaterial, waterMaterial);

    controls = new PointerLockControls(camera, document.body);

    initPlayer(scene, camera, controls);
    initUI(controls, requestGameLock);

    // Event listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => { clearInput(); stopBreaking(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); stopBreaking(); } });
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', onMouseWheel);

    breakTexture = createCrackTexture();
    const breakMaterial = new THREE.MeshBasicMaterial({
        map: breakTexture,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    const breakGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    breakOverlay = new THREE.Mesh(breakGeometry, breakMaterial);
    breakOverlay.visible = false;
    scene.add(breakOverlay);
    
    generateWorld();
    updateHotbar();
    updateInventoryUI();
    
    clock = new THREE.Clock();
    animate();
}

function clearInput() {
    for (const key in keys) {
        keys[key] = false;
    }
}

function requestGameLock() {
    if (!controls || controls.isLocked || inventoryOpen || craftingTableOpen) return;
    controls.lock();
}

function isTypingTarget(event) {
    const target = event.target;
    return Boolean(target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'));
}

function normalizeInputCode(event) {
    if (event.code === 'ArrowUp') return 'KeyW';
    if (event.code === 'ArrowDown') return 'KeyS';
    if (event.code === 'ArrowLeft') return 'KeyA';
    if (event.code === 'ArrowRight') return 'KeyD';
    const key = String(event.key || '').toLowerCase();
    if (key === 'w') return 'KeyW';
    if (key === 'a') return 'KeyA';
    if (key === 's') return 'KeyS';
    if (key === 'd') return 'KeyD';
    if (key === ' ') return 'Space';
    return event.code;
}

function isGameplayInput(code) {
    return (code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD' || code === 'Space' || code === 'ShiftLeft' || code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight');
}

function onKeyDown(e) {
    if (isTypingTarget(e)) return;
    const code = normalizeInputCode(e);
    if (isGameplayInput(code) || code === 'KeyE' || code === 'KeyV' || e.code === 'F5') {
        e.preventDefault();
    }
    if (code === 'KeyE' || (code === 'Escape' && (inventoryOpen || craftingTableOpen))) {
        if (!e.repeat) {
            if (craftingTableOpen) {
                closeCraftingTable(controls, requestGameLock);
            } else {
                toggleInventory(controls, requestGameLock);
            }
        }
        return;
    }
    if (inventoryOpen || craftingTableOpen) return;
    if (isGameplayInput(code)) {
        keys[code] = true;
    }
    if (code === 'ShiftLeft') {
        setCrouch(true);
    }
    const match = e.code.match(/^(?:Digit|Numpad)([1-9])$/);
    if (match) {
        const index = parseInt(match[1], 10) - 1;
        setActiveHotbarIndex(index);
    }
    if (code === 'KeyV' || e.code === 'F5') {
        toggleThirdPerson();
    }
}

function onKeyUp(e) {
    if (isTypingTarget(e)) return;
    const code = normalizeInputCode(e);
    keys[code] = false;
    keys[e.code] = false;
    if (code === 'ShiftLeft') {
        setCrouch(false);
    }
}

function onMouseDown(event) {
    if (!controls.isLocked || inventoryOpen || craftingTableOpen) return;

    if (event.button === 0) { // Left click: break
        startBreaking();
    } else if (event.button === 2) { // Right click: place
        placeBlock();
    }
}

function onMouseUp(event) {
    if (event.button === 0) {
        stopBreaking();
    }
}

function onMouseWheel(event) {
    if (inventoryOpen) return;
    cycleHotbar(event.deltaY);
}

function getLookedAtBlock() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, getCamera());
    const objectsToIntersect = Object.values(chunkMeshes)
        .flatMap(meshGroup => [meshGroup.solid, meshGroup.transparent])
        .filter(Boolean);
    const intersects = raycaster.intersectObjects(objectsToIntersect, false);
    if (intersects.length > 0) {
        return intersects[0];
    }
    return null;
}

function startBreaking() {
    const intersection = getLookedAtBlock();
    if (intersection) {
        const pos = new THREE.Vector3().copy(intersection.point);
        const normal = intersection.face.normal.clone();
        normal.transformDirection(intersection.object.matrixWorld);
        pos.addScaledVector(normal, -0.5);
        const [x, y, z] = pos.toArray().map(Math.floor);
        const blockId = getBlock(x, y, z);
        if (blockId !== BLOCK.AIR.id && blockId !== BLOCK.WATER.id) {
            isBreaking = true;
            breakProgress = 0;
            breakingBlockPos.set(x, y, z);
        }
    }
}

function stopBreaking() {
    isBreaking = false;
    breakProgress = 0;
    if (breakOverlay) {
        breakOverlay.visible = false;
    }
}

function placeBlock() {
    const intersection = getLookedAtBlock();
    if (!intersection) return;

    // Check if right-clicking a crafting table
    const pos2 = new THREE.Vector3().copy(intersection.point);
    const n2 = intersection.face.normal.clone();
    n2.transformDirection(intersection.object.matrixWorld);
    pos2.addScaledVector(n2, -0.5);
    const [tx, ty, tz] = pos2.toArray().map(Math.floor);
    if (getBlock(tx, ty, tz) === BLOCK.CRAFTING_TABLE.id) {
        openCraftingTable(controls);
        return;
    }

    const activeItem = player.inventory[INVENTORY_SLOTS + activeHotbarIndex];
    if (!activeItem) return;

    if (BLOCK_BY_ID[activeItem.id] && BLOCK_BY_ID[activeItem.id].placeable === false) return;

    const pos = new THREE.Vector3().copy(intersection.point);
    const normal = intersection.face.normal.clone();
    normal.transformDirection(intersection.object.matrixWorld);
    pos.addScaledVector(normal, 0.5);

    const [x, y, z] = pos.toArray().map(Math.floor);

    const playerPos = controls.getObject().position;
    const playerAABB = player.aabb.clone().translate(playerPos);
    const blockAABB = new THREE.Box3(new THREE.Vector3(x, y, z), new THREE.Vector3(x + 1, y + 1, z + 1));

    if (!playerAABB.intersectsBox(blockAABB)) {
        if (removeFromInventory(INVENTORY_SLOTS + activeHotbarIndex)) {
            setBlock(x, y, z, activeItem.id);
            updateDirtyChunks(x, y, z);
        }
    }
}

let lastFPSTime = 0;
let frameCount = 0;

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(0.05, clock.getDelta());
    
    if (!inventoryOpen && !craftingTableOpen) {
        // Attempt to stand up if crouch key is not held
        if (player.isCrouching && !keys['ShiftLeft']) {
            setCrouch(false);
        }
        updatePlayer(delta, keys);
    }
    
    // Update block breaking
    if (isBreaking) {
        const blockId = getBlock(breakingBlockPos.x, breakingBlockPos.y, breakingBlockPos.z);
        if (blockId !== BLOCK.AIR.id && blockId !== BLOCK.WATER.id) {
            const intersection = getLookedAtBlock();
            const lookedAtPos = intersection ? new THREE.Vector3().copy(intersection.point).addScaledVector(intersection.face.normal.clone().transformDirection(intersection.object.matrixWorld), -0.5).floor() : null;
            
            if (intersection && lookedAtPos.equals(breakingBlockPos)) {
                const breakTime = BLOCK_BY_ID[blockId].breakTime || 1.0;
                breakProgress += delta;
                
                breakOverlay.visible = true;
                breakOverlay.position.set(breakingBlockPos.x + 0.5, breakingBlockPos.y + 0.5, breakingBlockPos.z + 0.5);
                const stage = Math.floor((breakProgress / breakTime) * 10);
                breakTexture.offset.x = Math.min(stage, 9) / 10;
                breakTexture.needsUpdate = true;

                if (breakProgress >= breakTime) {
                    addToInventory(blockId);
                    setBlock(breakingBlockPos.x, breakingBlockPos.y, breakingBlockPos.z, BLOCK.AIR.id);
                    updateDirtyChunks(breakingBlockPos.x, breakingBlockPos.y, breakingBlockPos.z);
                    stopBreaking();
                }
            } else {
                stopBreaking();
            }
        } else {
            stopBreaking();
        }
    }

    const time = performance.now();
    frameCount++;
    if (time >= lastFPSTime + 1000) {
        fpsElement.textContent = `FPS: ${frameCount}`;
        frameCount = 0;
        lastFPSTime = time;
    }

    const pos = controls.getObject().position;
    coordsElement.textContent = `X: ${pos.x.toFixed(2)}, Y: ${pos.y.toFixed(2)}, Z: ${pos.z.toFixed(2)}`;

    renderScene();
}

init();
