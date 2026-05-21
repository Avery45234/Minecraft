import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

// Game constants
const WORLD_WIDTH = 96;
const WORLD_DEPTH = 96;
const WORLD_HEIGHT = 64;
const SEA_LEVEL = 32;
const INVENTORY_SLOTS = 36;
const HOTBAR_SLOTS = 9;
const TOTAL_INVENTORY_SLOTS = INVENTORY_SLOTS + HOTBAR_SLOTS;
const INVENTORY_MAX_STACK = 64;


// Physics constants
const GRAVITY = 19.6;

// Movement tuning.
const GROUND_ACCELERATION = 70;
const AIR_ACCELERATION = 16;
const MAX_GROUND_SPEED = 5.4;
const MAX_AIR_SPEED = 5.8;
const CROUCH_SPEED_MULTIPLIER = 0.5;
const DEFAULT_GROUND_DAMPING = 0.70;
const AIR_DAMPING = 0.96;
const STOP_EPSILON = 0.015;

// Camera/collision fixes
const CAMERA_NEAR = 0.03;
const COLLISION_SKIN = 0.03;

// DOM Elements
const container = document.getElementById('container');
const fpsElement = document.getElementById('fps');
const coordsElement = document.getElementById('coords');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const hotbarContainer = document.getElementById('hotbar');
const inventoryScreen = document.getElementById('inventory-screen');
const inventoryGrid = document.getElementById('inventory-grid');
const inventoryHotbar = document.getElementById('inventory-hotbar');


// Three.js setup
let scene, camera, renderer, controls;
let world = {};
let chunkMeshes = {};
const CHUNK_SIZE = 16;
let solidMaterial, transparentMaterial, waterMaterial;

// The visible bean model
let playerModel;
let thirdPerson = false;
const CAMERA_DISTANCE = 4.5;

// Player state
const player = {
    height: 2.0,
    crouchHeight: 1.5,
    radius: 0.3,
    eyeHeight: 1.7,
    crouchEyeHeight: 1.2,
    speed: 5,
    velocity: new THREE.Vector3(),
    onGround: false,
    isCrouching: false,
    jumpForce: 7,
    aabb: new THREE.Box3(
        new THREE.Vector3(-0.3, -1.7, -0.3),
        new THREE.Vector3(0.3, 0.3, 0.3)
    ),
    inventory: new Array(TOTAL_INVENTORY_SLOTS).fill(null),
};

// Block Definitions
const BLOCK = {
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

const BLOCK_BY_ID = Object.fromEntries(
    Object.values(BLOCK).map(block => [block.id, block])
);

// Texture mapping constants
const ATLAS_COLS = 4;
const ATLAS_ROWS = 2;
const TILE_SIZE_UV = 1 / ATLAS_COLS;
const TILE_HEIGHT_UV = 1 / ATLAS_ROWS;

// Hotbar
let activeHotbarIndex = 0;

// Input state
const keys = {};

// Game state
let gameStarted = false;
let inventoryOpen = false;
let selectedInventorySlot = null;

// Block breaking
let isBreaking = false;
let breakProgress = 0;
let breakingBlockPos = new THREE.Vector3();
let breakOverlay;
let breakTexture;

function clearInput() {
    for (const key in keys) {
        keys[key] = false;
    }
}

function requestGameLock() {
    if (!controls || controls.isLocked || inventoryOpen) return;
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

// Timing
const clock = new THREE.Clock();
let lastFPSTime = 0;
let frameCount = 0;

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 55, 130);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, CAMERA_NEAR, 1000);
    camera.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT, WORLD_DEPTH / 2);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xbfe9ff, 0x6f7b88, 0.95);
    scene.add(hemiLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.18);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xfff3d6, 1.25);
    directionalLight.position.set(60, 120, 40);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 300;
    directionalLight.shadow.camera.left = -90;
    directionalLight.shadow.camera.right = 90;
    directionalLight.shadow.camera.top = 90;
    directionalLight.shadow.camera.bottom = -90;
    directionalLight.shadow.bias = -0.00015;
    scene.add(directionalLight);

    // Materials
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('assets/atlas.svg');
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    solidMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0.0, side: THREE.FrontSide });
    transparentMaterial = new THREE.MeshStandardMaterial({ map: texture, transparent: true, opacity: 0.88, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });
    waterMaterial = new THREE.MeshPhysicalMaterial({ map: texture, transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.0, transmission: 0.2, thickness: 0.4, ior: 1.33, color: 0x7fd8ff, emissive: 0x10364f, emissiveIntensity: 0.18, side: THREE.DoubleSide });

    // Controls
    controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject());

    startButton.addEventListener('click', () => {
        gameStarted = true;
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
        clearInput();
        if (!inventoryOpen && gameStarted) {
            startScreen.style.display = 'flex';
        }
        stopBreaking();
    });

    renderer.domElement.addEventListener('click', () => {
        if (gameStarted && !inventoryOpen && !controls.isLocked) {
            startScreen.style.display = 'none';
            requestGameLock();
        }
    });

    // Event listeners
    document.addEventListener('keydown', (e) => {
        if (isTypingTarget(e)) return;
        const code = normalizeInputCode(e);
        if (isGameplayInput(code) || code === 'KeyE' || code === 'KeyV' || e.code === 'F5') {
            e.preventDefault();
        }
        if (code === 'KeyE' || (code === 'Escape' && inventoryOpen)) {
            if (!e.repeat) {
                toggleInventory();
            }
            return;
        }
        if (!gameStarted || inventoryOpen) return;
        if (isGameplayInput(code)) {
            keys[code] = true;
        }
        if (code === 'ShiftLeft') {
            setCrouch(true);
        }
        const match = e.code.match(/^(?:Digit|Numpad)([1-9])$/);
        if (match) {
            const index = parseInt(match[1], 10) - 1;
            if (index < HOTBAR_SLOTS) {
                activeHotbarIndex = index;
                updateHotbar();
            }
        }
        if (code === 'KeyV' || e.code === 'F5') {
            thirdPerson = !thirdPerson;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (isTypingTarget(e)) return;
        const code = normalizeInputCode(e);
        keys[code] = false;
        keys[e.code] = false;
        if (code === 'ShiftLeft') {
            setCrouch(false);
        }
    });

    window.addEventListener('blur', () => { clearInput(); stopBreaking(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); stopBreaking(); } });
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', onMouseWheel);
    
    // Breaking overlay
    breakTexture = textureLoader.load('assets/cracks.svg');
    breakTexture.magFilter = THREE.NearestFilter;
    breakTexture.minFilter = THREE.NearestFilter;
    breakTexture.repeat.x = 1 / 10;
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

    createPlayerModel();
    generateWorld();
    updateHotbar();
    updateInventoryUI();
    animate();
}

function setCrouch(crouching) {
    if (player.isCrouching === crouching) return;

    if (!crouching) {
        // Check if there's enough space to stand up
        const standAABB = new THREE.Box3(
            new THREE.Vector3(-player.radius, -player.eyeHeight, -player.radius),
            new THREE.Vector3(player.radius, player.height - player.eyeHeight, player.radius)
        ).translate(controls.getObject().position);
        
        const worldAABBs = getPotentialCollidingBlocks(controls.getObject().position);
        for (const blockAABB of worldAABBs) {
            if (standAABB.intersectsBox(blockAABB)) {
                return; // Can't stand up
            }
        }
    }
    
    player.isCrouching = crouching;
    
    const targetHeight = crouching ? player.crouchHeight : player.height;
    const targetEyeHeight = crouching ? player.crouchEyeHeight : player.eyeHeight;
    
    // Smooth transition can be added here later if needed
    camera.position.y += (targetEyeHeight - (player.isCrouching ? player.eyeHeight : player.crouchEyeHeight));
    
    player.aabb.min.y = -targetEyeHeight;
    player.aabb.max.y = targetHeight - targetEyeHeight;
}

function toggleInventory() {
    if (!gameStarted) return;
    clearInput();
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

function createPlayerModel() {
    playerModel = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xE8B33A, roughness: 0.75, metalness: 0.0 });
    const cylLength = player.height - player.radius * 2;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(player.radius, cylLength, 6, 12), bodyMat);
    body.position.y = player.height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    playerModel.add(body);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.45, metalness: 0.0 });
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeY = player.eyeHeight;
    for (const dx of [-0.12, 0.12]) {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(dx, eyeY, player.radius * 0.95);
        eye.castShadow = true;
        eye.receiveShadow = true;
        playerModel.add(eye);
    }
    playerModel.visible = false;
    scene.add(playerModel);
}

function clampHorizontalSpeed(maxSpeed) {
    const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    if (horizontalSpeed > maxSpeed) {
        const scale = maxSpeed / horizontalSpeed;
        player.velocity.x *= scale;
        player.velocity.z *= scale;
    }
}

function stopTinyHorizontalVelocity() {
    if (Math.abs(player.velocity.x) < STOP_EPSILON) player.velocity.x = 0;
    if (Math.abs(player.velocity.z) < STOP_EPSILON) player.velocity.z = 0;
}

function moveHorizontalVelocityToward(targetX, targetZ, maxDelta) {
    const deltaX = targetX - player.velocity.x;
    const deltaZ = targetZ - player.velocity.z;
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance <= maxDelta || distance < 0.0001) {
        player.velocity.x = targetX;
        player.velocity.z = targetZ;
        return;
    }
    const scale = maxDelta / distance;
    player.velocity.x += deltaX * scale;
    player.velocity.z += deltaZ * scale;
}

function updatePlayerModel() {
    if (!playerModel) return;
    const pos = controls.getObject().position;
    const currentEyeHeight = player.isCrouching ? player.crouchEyeHeight : player.eyeHeight;
    playerModel.position.set(pos.x, pos.y - currentEyeHeight, pos.z);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    playerModel.rotation.y = Math.atan2(dir.x, dir.z);

    const scaleY = player.isCrouching ? (player.crouchHeight / player.height) : 1;
    playerModel.scale.set(1, scaleY, 1);
}

function generateWorld() {
    const noise = new SimplexNoise();
    for (let x = 0; x < WORLD_WIDTH; x++) {
        for (let z = 0; z < WORLD_DEPTH; z++) {
            const height = Math.floor(noise.noise(x / 50, z / 50) * 10 + noise.noise(x / 25, z / 25) * 5 + SEA_LEVEL + 5);
            for (let y = 0; y < WORLD_HEIGHT; y++) {
                let blockId = BLOCK.AIR.id;
                if (y < height) {
                    if (y === height - 1 && y >= SEA_LEVEL) {
                        blockId = (y < SEA_LEVEL + 2) ? BLOCK.SAND.id : BLOCK.GRASS.id;
                    } else if (y < height - 1 && y >= height - 4) {
                        blockId = BLOCK.DIRT.id;
                    } else {
                        blockId = BLOCK.STONE.id;
                    }
                } else if (y < SEA_LEVEL) {
                    blockId = BLOCK.WATER.id;
                }
                setBlock(x, y, z, blockId);
            }
        }
    }
    for (let x = 0; x < WORLD_WIDTH; x++) {
        for (let z = 0; z < WORLD_DEPTH; z++) {
            const y = findSurface(x, z);
            if (y >= SEA_LEVEL - 1 && getBlock(x, y, z) !== BLOCK.WATER.id) {
                const touchesWater = getBlock(x + 1, y, z) === BLOCK.WATER.id || getBlock(x - 1, y, z) === BLOCK.WATER.id || getBlock(x, y, z + 1) === BLOCK.WATER.id || getBlock(x, y, z - 1) === BLOCK.WATER.id;
                if (touchesWater && Math.random() < 0.2) {
                    setBlock(x, y, z, BLOCK.ICE.id);
                }
            }
        }
    }
    for (let i = 0; i < 50; i++) {
        const x = Math.floor(Math.random() * WORLD_WIDTH);
        const z = Math.floor(Math.random() * WORLD_DEPTH);
        const y = findSurface(x, z);
        if (y > SEA_LEVEL && getBlock(x, y, z) === BLOCK.GRASS.id) {
            growTree(x, y + 1, z);
        }
    }
    for (const chunkId in world) {
        createChunkMesh(chunkId);
    }
}

function findSurface(x, z) {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
        const blockId = getBlock(x, y, z);
        if (blockId !== BLOCK.AIR.id && BLOCK_BY_ID[blockId].solid !== false) {
            return y;
        }
    }
    return 0;
}

function growTree(x, y, z) {
    const height = Math.floor(Math.random() * 3) + 4;
    for (let i = 0; i < height; i++) {
        setBlock(x, y + i, z, BLOCK.WOOD.id);
    }
    const radius = 2;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
                const leafY = y + height + dy;
                if (getBlock(x + dx, leafY, z + dz) === BLOCK.AIR.id) {
                    setBlock(x + dx, leafY, z + dz, BLOCK.LEAVES.id);
                }
            }
        }
    }
}

function getChunkId(x, y, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return `${cx},${cy},${cz}`;
}

function getBlock(x, y, z) {
    const chunkId = getChunkId(x, y, z);
    if (!world[chunkId]) return BLOCK.AIR.id;
    const lx = x & (CHUNK_SIZE - 1);
    const ly = y & (CHUNK_SIZE - 1);
    const lz = z & (CHUNK_SIZE - 1);
    return world[chunkId][lx][ly][lz] || BLOCK.AIR.id;
}

function setBlock(x, y, z, type) {
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= WORLD_DEPTH) return;
    const chunkId = getChunkId(x, y, z);
    if (!world[chunkId]) {
        world[chunkId] = Array.from({ length: CHUNK_SIZE }, () => Array.from({ length: CHUNK_SIZE }, () => new Uint8Array(CHUNK_SIZE)));
    }
    const lx = x & (CHUNK_SIZE - 1);
    const ly = y & (CHUNK_SIZE - 1);
    const lz = z & (CHUNK_SIZE - 1);
    world[chunkId][lx][ly][lz] = type;
}

function createChunkMesh(chunkId) {
    if (chunkMeshes[chunkId]) {
        if (chunkMeshes[chunkId].solid) {
            scene.remove(chunkMeshes[chunkId].solid);
            chunkMeshes[chunkId].solid.geometry.dispose();
        }
        if (chunkMeshes[chunkId].transparent) {
            scene.remove(chunkMeshes[chunkId].transparent);
            chunkMeshes[chunkId].transparent.geometry.dispose();
        }
        if (chunkMeshes[chunkId].water) {
            scene.remove(chunkMeshes[chunkId].water);
            chunkMeshes[chunkId].water.geometry.dispose();
        }
    }
    const [cx, cy, cz] = chunkId.split(',').map(Number);
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;
    const solidGeometry = new THREE.BufferGeometry();
    const transparentGeometry = new THREE.BufferGeometry();
    const waterGeometry = new THREE.BufferGeometry();
    const solidVertices = [], solidNormals = [], solidUvs = [];
    const transparentVertices = [], transparentNormals = [], transparentUvs = [];
    const waterVertices = [], waterNormals = [], waterUvs = [];
    const faces = [{ dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 0, 1], [1, 1, 1]] }, { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 0, 0], [0, 1, 0]] }, { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] }, { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]] }, { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] }, { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] },];
    function pushFace(vertices, normals, uvs, x, y, z, dir, corners, uvInfo) {
        const ndx = [0, 1, 2, 2, 1, 3];
        for (const i of ndx) {
            const corner = corners[i];
            vertices.push(x + corner[0], y + corner[1], z + corner[2]);
            normals.push(dir[0], dir[1], dir[2]);
        }
        let uvTile;
        if (uvInfo.all) uvTile = uvInfo.all;
        else {
            if (dir[1] === 1) uvTile = uvInfo.top;
            else if (dir[1] === -1) uvTile = uvInfo.bottom;
            else uvTile = uvInfo.side;
        }
        const u = uvTile[0] * TILE_SIZE_UV;
        const v = 1.0 - (uvTile[1] + 1) * TILE_HEIGHT_UV;
        uvs.push(u, v + TILE_HEIGHT_UV, u + TILE_SIZE_UV, v + TILE_HEIGHT_UV, u, v, u, v, u + TILE_SIZE_UV, v + TILE_HEIGHT_UV, u + TILE_SIZE_UV, v);
    }
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const blockId = getBlock(startX + x, startY + y, startZ + z);
                if (blockId === BLOCK.AIR.id) continue;
                const blockData = BLOCK_BY_ID[blockId];
                for (const { dir, corners } of faces) {
                    const nx = startX + x + dir[0], ny = startY + y + dir[1], nz = startZ + z + dir[2];
                    const neighborId = getBlock(nx, ny, nz);
                    const neighborData = BLOCK_BY_ID[neighborId];
                    let shouldRender = false;
                    if (blockId === BLOCK.WATER.id) shouldRender = neighborId !== BLOCK.WATER.id;
                    else if (blockData.transparent) shouldRender = neighborId === BLOCK.AIR.id || neighborId === BLOCK.WATER.id;
                    else shouldRender = neighborId === BLOCK.AIR.id || neighborData.transparent;
                    if (!shouldRender) continue;
                    if (blockId === BLOCK.WATER.id) pushFace(waterVertices, waterNormals, waterUvs, x, y, z, dir, corners, blockData.uv);
                    else if (blockData.transparent) pushFace(transparentVertices, transparentNormals, transparentUvs, x, y, z, dir, corners, blockData.uv);
                    else pushFace(solidVertices, solidNormals, solidUvs, x, y, z, dir, corners, blockData.uv);
                }
            }
        }
    }
    chunkMeshes[chunkId] = {};
    if (solidVertices.length > 0) {
        solidGeometry.setAttribute('position', new THREE.Float32BufferAttribute(solidVertices, 3));
        solidGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(solidNormals, 3));
        solidGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(solidUvs, 2));
        solidGeometry.computeBoundingSphere();
        const solidMesh = new THREE.Mesh(solidGeometry, solidMaterial);
        solidMesh.position.set(startX, startY, startZ);
        solidMesh.castShadow = true;
        solidMesh.receiveShadow = true;
        scene.add(solidMesh);
        chunkMeshes[chunkId].solid = solidMesh;
    }
    if (transparentVertices.length > 0) {
        transparentGeometry.setAttribute('position', new THREE.Float32BufferAttribute(transparentVertices, 3));
        transparentGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(transparentNormals, 3));
        transparentGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(transparentUvs, 2));
        transparentGeometry.computeBoundingSphere();
        const transparentMesh = new THREE.Mesh(transparentGeometry, transparentMaterial);
        transparentMesh.position.set(startX, startY, startZ);
        transparentMesh.castShadow = true;
        transparentMesh.receiveShadow = true;
        scene.add(transparentMesh);
        chunkMeshes[chunkId].transparent = transparentMesh;
    }
    if (waterVertices.length > 0) {
        waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterVertices, 3));
        waterGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(waterNormals, 3));
        waterGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(waterUvs, 2));
        waterGeometry.computeBoundingSphere();
        const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
        waterMesh.position.set(startX, startY, startZ);
        waterMesh.receiveShadow = true;
        waterMesh.renderOrder = 1;
        scene.add(waterMesh);
        chunkMeshes[chunkId].water = waterMesh;
    }
}

function updateDirtyChunks(x, y, z) {
    const chunkIds = new Set();
    chunkIds.add(getChunkId(x, y, z));
    if ((x & (CHUNK_SIZE - 1)) === 0) chunkIds.add(getChunkId(x - 1, y, z));
    if ((x & (CHUNK_SIZE - 1)) === CHUNK_SIZE - 1) chunkIds.add(getChunkId(x + 1, y, z));
    if ((y & (CHUNK_SIZE - 1)) === 0) chunkIds.add(getChunkId(x, y - 1, z));
    if ((y & (CHUNK_SIZE - 1)) === CHUNK_SIZE - 1) chunkIds.add(getChunkId(x, y + 1, z));
    if ((z & (CHUNK_SIZE - 1)) === 0) chunkIds.add(getChunkId(x, y, z - 1));
    if ((z & (CHUNK_SIZE - 1)) === CHUNK_SIZE - 1) chunkIds.add(getChunkId(x, y, z + 1));
    chunkIds.forEach(id => { if (world[id]) createChunkMesh(id); });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseUp(event) {
    if (event.button === 0) {
        stopBreaking();
    }
}

function onMouseDown(event) {
    if (!controls.isLocked || inventoryOpen) return;

    if (event.button === 0) { // Left click: break
        startBreaking();
    } else if (event.button === 2) { // Right click: place
        placeBlock();
    }
}

function getLookedAtBlock() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
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
    breakOverlay.visible = false;
}

function placeBlock() {
    const intersection = getLookedAtBlock();
    if (!intersection) return;

    const activeItem = player.inventory[INVENTORY_SLOTS + activeHotbarIndex];
    if (!activeItem) return;

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

function addToInventory(blockId) {
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


function removeFromInventory(slotIndex) {
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


function onMouseWheel(event) {
    if (inventoryOpen) return;
    if (event.deltaY < 0) {
        activeHotbarIndex = (activeHotbarIndex - 1 + HOTBAR_SLOTS) % HOTBAR_SLOTS;
    } else {
        activeHotbarIndex = (activeHotbarIndex + 1) % HOTBAR_SLOTS;
    }
    updateHotbar();
}

function updateHotbar() {
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

function updateInventoryUI() {
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
        // Swap items
        [player.inventory[selectedInventorySlot], player.inventory[slotIndex]] = 
        [player.inventory[slotIndex], player.inventory[selectedInventorySlot]];
        
        selectedInventorySlot = null;
        updateHotbar();
    }
    updateInventoryUI();
}


function getPotentialCollidingBlocks(playerPos, motion = new THREE.Vector3()) {
    const currentAABB = player.aabb.clone().translate(playerPos);
    const nextAABB = player.aabb.clone().translate(playerPos).translate(motion);
    const sweptAABB = currentAABB.union(nextAABB);
    const blocks = [];
    const minX = Math.floor(sweptAABB.min.x), maxX = Math.ceil(sweptAABB.max.x);
    const minY = Math.floor(sweptAABB.min.y), maxY = Math.ceil(sweptAABB.max.y);
    const minZ = Math.floor(sweptAABB.min.z), maxZ = Math.ceil(sweptAABB.max.z);
    for (let x = minX; x < maxX; x++) {
        for (let y = minY; y < maxY; y++) {
            for (let z = minZ; z < maxZ; z++) {
                const blockId = getBlock(x, y, z);
                if (blockId !== BLOCK.AIR.id && BLOCK_BY_ID[blockId].solid !== false) {
                    blocks.push(new THREE.Box3(new THREE.Vector3(x, y, z), new THREE.Vector3(x + 1, y + 1, z + 1)));
                }
            }
        }
    }
    return blocks;
}

function updatePlayer(delta) {
    if (!gameStarted || inventoryOpen) return;

    // Attempt to stand up if crouch key is not held
    if (player.isCrouching && !keys['ShiftLeft']) {
        setCrouch(false);
    }
    
    const pos = controls.getObject().position;
    const initialPos = pos.clone();
    const wasOnGround = player.onGround;
    player.onGround = false;
    player.velocity.y -= GRAVITY * delta;
    if (keys['Space'] && wasOnGround) {
        player.velocity.y = player.jumpForce;
        keys['Space'] = false;
    }
    const rawMoveDirection = new THREE.Vector3();
    if (keys['KeyW']) rawMoveDirection.z += 1;
    if (keys['KeyS']) rawMoveDirection.z -= 1;
    if (keys['KeyA']) rawMoveDirection.x -= 1;
    if (keys['KeyD']) rawMoveDirection.x += 1;
    const hasMovementInput = rawMoveDirection.lengthSq() > 0;
    if (hasMovementInput) {
        rawMoveDirection.normalize();
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() > 0.0001) {
            forward.normalize();
            const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
            const desiredDirection = new THREE.Vector3().addScaledVector(forward, rawMoveDirection.z).addScaledVector(right, rawMoveDirection.x);
            if (desiredDirection.lengthSq() > 0.0001) {
                desiredDirection.normalize();
                let targetSpeed = wasOnGround ? MAX_GROUND_SPEED : MAX_AIR_SPEED;
                if (player.isCrouching) {
                    targetSpeed *= CROUCH_SPEED_MULTIPLIER;
                }
                const movementAcceleration = wasOnGround ? GROUND_ACCELERATION : AIR_ACCELERATION;
                moveHorizontalVelocityToward(desiredDirection.x * targetSpeed, desiredDirection.z * targetSpeed, movementAcceleration * delta);
            }
        }
    }
    let maxSpeed = wasOnGround ? MAX_GROUND_SPEED : MAX_AIR_SPEED;
    if (player.isCrouching) {
        maxSpeed *= CROUCH_SPEED_MULTIPLIER;
    }
    clampHorizontalSpeed(maxSpeed);
    const motion = player.velocity.clone().multiplyScalar(delta);
    const worldAABBs = getPotentialCollidingBlocks(pos, motion);
    let playerAABB = player.aabb.clone().translate(initialPos);
    for (const blockAABB of worldAABBs) {
        const overlapsX = playerAABB.max.x > blockAABB.min.x && playerAABB.min.x < blockAABB.max.x;
        const overlapsZ = playerAABB.max.z > blockAABB.min.z && playerAABB.min.z < blockAABB.max.z;
        if (overlapsX && overlapsZ) {
            if (motion.y < 0 && playerAABB.min.y >= blockAABB.max.y) {
                const newMotion = blockAABB.max.y - playerAABB.min.y;
                if (newMotion > motion.y) {
                    motion.y = newMotion;
                    player.onGround = true;
                    player.velocity.y = 0;
                }
            } else if (motion.y > 0 && playerAABB.max.y <= blockAABB.min.y) {
                motion.y = Math.min(blockAABB.min.y - playerAABB.max.y - COLLISION_SKIN, motion.y);
                player.velocity.y = 0;
            }
        }
    }
    playerAABB.translate(new THREE.Vector3(0, motion.y, 0));
    for (const blockAABB of worldAABBs) {
        const overlapsY = playerAABB.max.y > blockAABB.min.y && playerAABB.min.y < blockAABB.max.y;
        const overlapsZ = playerAABB.max.z > blockAABB.min.z && playerAABB.min.z < blockAABB.max.z;
        if (overlapsY && overlapsZ) {
            if (motion.x < 0 && playerAABB.min.x >= blockAABB.max.x) {
                motion.x = Math.max(blockAABB.max.x - playerAABB.min.x + COLLISION_SKIN, motion.x);
                player.velocity.x = 0;
            } else if (motion.x > 0 && playerAABB.max.x <= blockAABB.min.x) {
                motion.x = Math.min(blockAABB.min.x - playerAABB.max.x - COLLISION_SKIN, motion.x);
                player.velocity.x = 0;
            }
        }
    }
    playerAABB.translate(new THREE.Vector3(motion.x, 0, 0));
    for (const blockAABB of worldAABBs) {
        const overlapsX = playerAABB.max.x > blockAABB.min.x && playerAABB.min.x < blockAABB.max.x;
        const overlapsY = playerAABB.max.y > blockAABB.min.y && playerAABB.min.y < blockAABB.max.y;
        if (overlapsX && overlapsY) {
            if (motion.z < 0 && playerAABB.min.z >= blockAABB.max.z) {
                motion.z = Math.max(blockAABB.max.z - playerAABB.min.z + COLLISION_SKIN, motion.z);
                player.velocity.z = 0;
            } else if (motion.z > 0 && playerAABB.max.z <= blockAABB.min.z) {
                motion.z = Math.min(blockAABB.min.z - playerAABB.max.z - COLLISION_SKIN, motion.z);
                player.velocity.z = 0;
            }
        }
    }
    pos.add(motion);
    if (!hasMovementInput) {
        let damping = player.onGround ? DEFAULT_GROUND_DAMPING : AIR_DAMPING;
        if (player.onGround) {
            const groundBlockX = Math.floor(pos.x);
            const groundBlockY = Math.floor(pos.y + player.aabb.min.y - 0.01);
            const groundBlockZ = Math.floor(pos.z);
            const groundBlockId = getBlock(groundBlockX, groundBlockY, groundBlockZ);
            damping = BLOCK_BY_ID[groundBlockId]?.damping || DEFAULT_GROUND_DAMPING;
        }
        const frameDamping = Math.pow(damping, delta * 60);
        player.velocity.x *= frameDamping;
        player.velocity.z *= frameDamping;
        stopTinyHorizontalVelocity();
    }
    clampHorizontalSpeed(maxSpeed);
    if (pos.y < -20) {
        pos.y = WORLD_HEIGHT;
        pos.x = WORLD_WIDTH / 2;
        pos.z = WORLD_DEPTH / 2;
        player.velocity.set(0, 0, 0);
        clearInput();
    }
}


function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(0.05, clock.getDelta());

    updatePlayer(delta);
    
    // Update block breaking
    if (isBreaking) {
        const blockId = getBlock(breakingBlockPos.x, breakingBlockPos.y, breakingBlockPos.z);
        if (blockId !== BLOCK.AIR.id && blockId !== BLOCK.WATER.id) {
            const intersection = getLookedAtBlock();
            const lookedAtPos = intersection ? new THREE.Vector3().copy(intersection.point).addScaledVector(intersection.face.normal.clone().transformDirection(intersection.object.matrixWorld), -0.5).floor() : null;
            
            if (intersection && lookedAtPos.equals(breakingBlockPos)) {
                const breakTime = BLOCK_BY_ID[blockId].breakTime || 1.0;
                breakProgress += delta;
                
                // Update break overlay
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

    updatePlayerModel();
    renderScene();
}

function renderScene() {
    if (waterMaterial) {
        const t = performance.now() * 0.001;
        waterMaterial.opacity = 0.68 + Math.sin(t * 1.6) * 0.04;
        waterMaterial.emissiveIntensity = 0.16 + Math.sin(t * 1.2) * 0.03;
    }
    if (thirdPerson && playerModel) {
        playerModel.visible = true;
        const eyePos = camera.position.clone();
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        camera.position.addScaledVector(dir, -CAMERA_DISTANCE);
        camera.position.y += 0.5;
        renderer.render(scene, camera);
        camera.position.copy(eyePos);
    } else {
        if (playerModel) {
            playerModel.visible = false;
        }
        renderer.render(scene, camera);
    }
}

init();
