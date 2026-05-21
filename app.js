import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

// Game constants
const WORLD_WIDTH = 96;
const WORLD_DEPTH = 96;
const WORLD_HEIGHT = 64;
const SEA_LEVEL = 32;
const INVENTORY_MAX_STACK = 64;

// Physics constants
const GRAVITY = 19.6;
const ACCELERATION = 30;
const GROUND_DAMPING = 0.92;
const AIR_DAMPING = 0.98;

// DOM Elements
const container = document.getElementById('container');
const fpsElement = document.getElementById('fps');
const coordsElement = document.getElementById('coords');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const hotbarSlots = document.querySelectorAll('.slot');
const inventoryScreen = document.getElementById('inventory-screen');

// Three.js setup
let scene, camera, renderer, controls;
let world = {}; // Using object for sparse storage
let chunkMeshes = {};
const CHUNK_SIZE = 16;
let solidMaterial, transparentMaterial;

// The visible bean model (only shown in third-person) and the view toggle.
let playerModel;
let thirdPerson = false;
const CAMERA_DISTANCE = 4.5; // how far the camera pulls back in third-person

// Player state
const player = {
    height: 2.0,
    radius: 0.3,
    eyeHeight: 1.7,
    speed: 5,
    velocity: new THREE.Vector3(),
    onGround: false,
    jumpForce: 7,
    aabb: new THREE.Box3(new THREE.Vector3(-0.3, -1.7, -0.3), new THREE.Vector3(0.3, 0.3, 0.3)),
    inventory: new Map(),
};

// Block types
const blockTypes = {
    AIR: 0,
    STONE: 1,
    DIRT: 2,
    GRASS: 3,
    SAND: 4,
    WATER: 5,
    WOOD: 6,
    LEAVES: 7,
};

const blockNames = Object.fromEntries(Object.entries(blockTypes).map(([name, id]) => [id, name]));

// Texture mapping
const ATLAS_COLS = 4;
const ATLAS_ROWS = 2;
const TILE_SIZE_UV = 1 / ATLAS_COLS;
const TILE_HEIGHT_UV = 1 / ATLAS_ROWS;

const blockUvs = {
    [blockTypes.GRASS]: {
        top: [0, 0],
        side: [1, 0],
        bottom: [2, 0], // Dirt
    },
    [blockTypes.DIRT]: { all: [2, 0] },
    [blockTypes.STONE]: { all: [3, 0] },
    [blockTypes.SAND]: { all: [0, 1] },
    [blockTypes.WOOD]: { all: [1, 1] },
    [blockTypes.LEAVES]: { all: [2, 1] },
    [blockTypes.WATER]: { all: [3, 1] },
};


const blockColors = {
    [blockTypes.GRASS]: 0x559020,
    [blockTypes.DIRT]: 0x805020,
    [blockTypes.STONE]: 0x808080,
    [blockTypes.SAND]: 0xdacfa3,
    [blockTypes.WATER]: 0x4080c0,
    [blockTypes.WOOD]: 0x604020,
    [blockTypes.LEAVES]: 0x208020,
};

// The hotbar now shows the first 7 items from the inventory.
// This array holds the block types currently displayed in the hotbar.
let hotbarTypes = [];
let activeHotbarIndex = 0;

// Input state
const keys = {};

// Timing
const clock = new THREE.Clock();
let lastFPSTime = 0;
let frameCount = 0;

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 50, 100);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT, WORLD_DEPTH / 2);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(50, 200, 100);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Materials
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('assets/atlas.svg');
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    solidMaterial = new THREE.MeshLambertMaterial({ map: texture, side: THREE.FrontSide });
    transparentMaterial = new THREE.MeshLambertMaterial({ map: texture, transparent: true, opacity: 0.7, side: THREE.DoubleSide });

    // Controls
    controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject());

    startButton.addEventListener('click', () => { controls.lock(); });
    controls.addEventListener('lock', () => {
        startScreen.style.display = 'none';
        inventoryScreen.style.display = 'none';
    });
    controls.addEventListener('unlock', () => {
        if (inventoryScreen.style.display !== 'flex') {
            startScreen.style.display = 'flex';
        }
    });

    // Event listeners
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;

        // Hotbar selection via number keys 1-7 (top row or numpad).
        const match = e.code.match(/^(?:Digit|Numpad)([1-9])$/);
        if (match) {
            const index = parseInt(match[1], 10) - 1;
            if (index < hotbarTypes.length) {
                activeHotbarIndex = index;
                updateHotbar();
            }
        }

        if (e.code === 'KeyE') {
            toggleInventory();
        }

        // Toggle first/third-person so you can see the bean. (F5 is the browser
        // refresh key, so we use V; F5 is also bound where the browser allows it.)
        if (e.code === 'KeyV' || e.code === 'F5') {
            e.preventDefault();
            thirdPerson = !thirdPerson;
        }
    });
    document.addEventListener('keyup', (e) => (keys[e.code] = false));
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('wheel', onMouseWheel);

    createPlayerModel();
    generateWorld();
    updateHotbar();
    updateInventoryUI();
    animate();
}

function toggleInventory() {
    if (controls.isLocked) {
        controls.unlock();
        inventoryScreen.style.display = 'flex';
        updateInventoryUI();
    } else {
        inventoryScreen.style.display = 'none';
        controls.lock();
    }
}

// Builds the bean: a 2-block-tall capsule with two eyes so its facing is clear.
// The group's origin is at the player's feet; +z is "forward".
function createPlayerModel() {
    playerModel = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xE8B33A });
    const cylLength = player.height - player.radius * 2; // capsule total = length + 2*radius
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(player.radius, cylLength, 6, 12), bodyMat);
    body.position.y = player.height / 2; // lift so the capsule's base sits at the group origin
    playerModel.add(body);

    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    // Put the visible eyes exactly where the camera looks from, so the model
    // "sees" from the same head-height point the first-person view uses.
    const eyeY = player.eyeHeight;
    for (const dx of [-0.12, 0.12]) {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(dx, eyeY, player.radius * 0.95);
        playerModel.add(eye);
    }

    playerModel.visible = false; // hidden in first-person; shown when third-person is on
    scene.add(playerModel);
}

// Keep the bean glued to the player's feet and facing the look direction.
function updatePlayerModel() {
    if (!playerModel) return;
    const pos = controls.getObject().position;
    playerModel.position.set(pos.x, pos.y - player.eyeHeight, pos.z);

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    playerModel.rotation.y = Math.atan2(dir.x, dir.z);
}

function generateWorld() {
    const noise = new SimplexNoise();
    for (let x = 0; x < WORLD_WIDTH; x++) {
        for (let z = 0; z < WORLD_DEPTH; z++) {
            const height = Math.floor(noise.noise(x / 50, z / 50) * 10 + noise.noise(x/25, z/25) * 5 + SEA_LEVEL + 5);
            for (let y = 0; y < WORLD_HEIGHT; y++) {
                let block = blockTypes.AIR;
                if (y < height) {
                    if (y === height - 1 && y >= SEA_LEVEL) {
                         if (y < SEA_LEVEL + 2) {
                            block = blockTypes.SAND;
                        } else {
                            block = blockTypes.GRASS;
                        }
                    } else if (y < height -1 && y >= height - 4) {
                        block = blockTypes.DIRT;
                    } else {
                        block = blockTypes.STONE;
                    }
                } else if (y < SEA_LEVEL) {
                     block = blockTypes.WATER;
                }
                setBlock(x, y, z, block);
            }
        }
    }

    // Trees
    for(let i = 0; i < 50; i++) {
        const x = Math.floor(Math.random() * WORLD_WIDTH);
        const z = Math.floor(Math.random() * WORLD_DEPTH);
        const y = findSurface(x, z);
        if (y > SEA_LEVEL && getBlock(x,y,z) === blockTypes.GRASS) {
            growTree(x, y + 1, z);
        }
    }

    for (const chunkId in world) {
        createChunkMesh(chunkId);
    }
}

function findSurface(x, z) {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
        if (getBlock(x, y, z) !== blockTypes.AIR) {
            return y;
        }
    }
    return 0;
}

function growTree(x, y, z) {
    const height = Math.floor(Math.random() * 3) + 4;
    for (let i = 0; i < height; i++) {
        setBlock(x, y + i, z, blockTypes.WOOD);
    }
    const radius = 2;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                if (dx*dx + dy*dy + dz*dz > radius*radius) continue;
                const leafY = y + height + dy;
                if(getBlock(x+dx, leafY, z+dz) === blockTypes.AIR) {
                    setBlock(x + dx, leafY, z + dz, blockTypes.LEAVES);
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
    if (!world[chunkId]) return blockTypes.AIR;
    const lx = x & (CHUNK_SIZE - 1);
    const ly = y & (CHUNK_SIZE - 1);
    const lz = z & (CHUNK_SIZE - 1);
    return world[chunkId][lx][ly][lz] || blockTypes.AIR;
}

function setBlock(x, y, z, type) {
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= WORLD_DEPTH) return;
    const chunkId = getChunkId(x, y, z);
    if (!world[chunkId]) {
        world[chunkId] = Array.from({ length: CHUNK_SIZE }, () =>
            Array.from({ length: CHUNK_SIZE }, () =>
                new Uint8Array(CHUNK_SIZE)
            )
        );
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
    }

    const [cx, cy, cz] = chunkId.split(',').map(Number);
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    const solidGeometry = new THREE.BufferGeometry();
    const transparentGeometry = new THREE.BufferGeometry();

    const solidVertices = [], solidNormals = [], solidUvs = [];
    const transparentVertices = [], transparentNormals = [], transparentUvs = [];

    const faces = [
        { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 0, 1], [1, 1, 1]] }, // right
        { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 0, 0], [0, 1, 0]] }, // left
        { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] }, // top
        { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]] }, // bottom
        { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] }, // front
        { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] }, // back
    ];

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const blockType = getBlock(startX + x, startY + y, startZ + z);
                if (blockType === blockTypes.AIR) continue;

                const isTransparent = blockType === blockTypes.WATER;

                for (const { dir, corners } of faces) {
                    const neighborType = getBlock(startX + x + dir[0], startY + y + dir[1], startZ + z + dir[2]);
                    const neighborIsTransparent = neighborType === blockTypes.WATER;

                    if (neighborType === blockTypes.AIR || (neighborIsTransparent && !isTransparent)) {
                        const ndx = [0, 1, 2, 2, 1, 3];
                        for (const i of ndx) {
                            const corner = corners[i];
                            (isTransparent ? transparentVertices : solidVertices).push(x + corner[0], y + corner[1], z + corner[2]);
                            (isTransparent ? transparentNormals : solidNormals).push(dir[0], dir[1], dir[2]);
                        }

                        let uv_tile;
                        const uv_info = blockUvs[blockType];
                        if (uv_info.all) {
                            uv_tile = uv_info.all;
                        } else {
                            if (dir[1] === 1) uv_tile = uv_info.top;
                            else if (dir[1] === -1) uv_tile = uv_info.bottom;
                            else uv_tile = uv_info.side;
                        }

                        const u = uv_tile[0] * TILE_SIZE_UV;
                        const v = 1.0 - (uv_tile[1] + 1) * TILE_HEIGHT_UV;

                        const uv_order = [
                            [u, v + TILE_HEIGHT_UV],
                            [u + TILE_SIZE_UV, v + TILE_HEIGHT_UV],
                            [u, v],
                            [u, v],
                            [u + TILE_SIZE_UV, v + TILE_HEIGHT_UV],
                            [u + TILE_SIZE_UV, v]
                        ];

                        (isTransparent ? transparentUvs : solidUvs).push(...uv_order.flat());
                    }
                }
            }
        }
    }

    if (solidVertices.length > 0) {
        solidGeometry.setAttribute('position', new THREE.Float32BufferAttribute(solidVertices, 3));
        solidGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(solidNormals, 3));
        solidGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(solidUvs, 2));
        const solidMesh = new THREE.Mesh(solidGeometry, solidMaterial);
        solidMesh.position.set(startX, startY, startZ);
        scene.add(solidMesh);
        chunkMeshes[chunkId] = { ...chunkMeshes[chunkId], solid: solidMesh };
    }

    if (transparentVertices.length > 0) {
        transparentGeometry.setAttribute('position', new THREE.Float32BufferAttribute(transparentVertices, 3));
        transparentGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(transparentNormals, 3));
        transparentGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(transparentUvs, 2));
        const transparentMesh = new THREE.Mesh(transparentGeometry, transparentMaterial);
        transparentMesh.position.set(startX, startY, startZ);
        scene.add(transparentMesh);
        chunkMeshes[chunkId] = { ...chunkMeshes[chunkId], transparent: transparentMesh };
    }
}


function updateDirtyChunks(x, y, z) {
    const chunkIds = new Set();
    chunkIds.add(getChunkId(x,y,z));
    if ((x & (CHUNK_SIZE - 1)) === 0) chunkIds.add(getChunkId(x - 1, y, z));
    if ((x & (CHUNK_SIZE - 1)) === CHUNK_SIZE - 1) chunkIds.add(getChunkId(x + 1, y, z));
    if ((y & (CHUNK_SIZE - 1)) === 0) chunkIds.add(getChunkId(x, y - 1, z));
    if ((y & (CHUNK_SIZE - 1)) === CHUNK_SIZE - 1) chunkIds.add(getChunkId(x, y + 1, z));
    if ((z & (CHUNK_SIZE - 1)) === 0) chunkIds.add(getChunkId(x, y, z - 1));
    if ((z & (CHUNK_SIZE - 1)) === CHUNK_SIZE - 1) chunkIds.add(getChunkId(x, y, z + 1));

    chunkIds.forEach(id => {
        if (world[id]) createChunkMesh(id);
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseDown(event) {
    if (!controls.isLocked) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);

    const objectsToIntersect = Object.values(chunkMeshes).flatMap(m => [m.solid, m.transparent]).filter(Boolean);
    const intersects = raycaster.intersectObjects(objectsToIntersect, false);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const pos = new THREE.Vector3().copy(intersection.point);
        const normal = intersection.face.normal.clone();

        const mesh = intersection.object;
        normal.transformDirection(mesh.matrixWorld);

        if (event.button === 0) { // Left click: break
            pos.addScaledVector(normal, -0.5);
            const [x, y, z] = pos.toArray().map(Math.floor);

            const brokenBlockType = getBlock(x,y,z);
            if(brokenBlockType !== blockTypes.AIR && brokenBlockType !== blockTypes.WATER) {
                 addToInventory(brokenBlockType);
            }

            setBlock(x, y, z, blockTypes.AIR);
            updateDirtyChunks(x, y, z);
        } else if (event.button === 2) { // Right click: place
            const activeBlockType = hotbarTypes[activeHotbarIndex];
            if (!activeBlockType) return;

            pos.addScaledVector(normal, 0.5);
            const [x, y, z] = pos.toArray().map(Math.floor);

            const playerPos = controls.getObject().position;
            const playerAABB = player.aabb.clone().translate(playerPos);
            const blockAABB = new THREE.Box3(new THREE.Vector3(x,y,z), new THREE.Vector3(x+1,y+1,z+1));

            if(!playerAABB.intersectsBox(blockAABB)) {
                if (removeFromInventory(activeBlockType)) {
                    setBlock(x, y, z, activeBlockType);
                    updateDirtyChunks(x, y, z);
                }
            }
        }
    }
}

function addToInventory(blockType) {
    const currentCount = player.inventory.get(blockType) || 0;
    if (currentCount < INVENTORY_MAX_STACK) {
        player.inventory.set(blockType, currentCount + 1);
        updateHotbar();
        updateInventoryUI();
    }
}

function removeFromInventory(blockType) {
    const currentCount = player.inventory.get(blockType);
    if (currentCount > 0) {
        player.inventory.set(blockType, currentCount - 1);
        if (player.inventory.get(blockType) === 0) {
            player.inventory.delete(blockType);
            // If the active slot just got emptied, try to select something else.
            if(hotbarTypes[activeHotbarIndex] === blockType){
                const newTypes = Array.from(player.inventory.keys());
                activeHotbarIndex = Math.min(activeHotbarIndex, Math.max(0, newTypes.length - 1));
            }
        }
        updateHotbar();
        updateInventoryUI();
        return true;
    }
    return false;
}


function onMouseWheel(event) {
    if (hotbarTypes.length === 0) return;
    if (event.deltaY < 0) {
        activeHotbarIndex = (activeHotbarIndex - 1 + hotbarTypes.length) % hotbarTypes.length;
    }
    else {
        activeHotbarIndex = (activeHotbarIndex + 1) % hotbarTypes.length;
    }
    updateHotbar();
}

function updateHotbar() {
    hotbarTypes = Array.from(player.inventory.keys()).slice(0, 7);

    hotbarSlots.forEach((slot, index) => {
        const type = hotbarTypes[index];
        const countElement = slot.querySelector('.count') || document.createElement('div');
        countElement.className = 'count';

        if(type){
            slot.style.backgroundColor = `#${new THREE.Color(blockColors[type]).getHexString()}`;
            slot.classList.remove('empty');

            const count = player.inventory.get(type);
            countElement.textContent = count > 1 ? count : '';
            slot.appendChild(countElement);

            if (index === activeHotbarIndex) {
                slot.classList.add('active');
            } else {
                slot.classList.remove('active');
            }
        } else {
            slot.style.backgroundColor = 'transparent';
            slot.classList.add('empty');
            slot.classList.remove('active');
            if (slot.contains(countElement)) {
                slot.removeChild(countElement);
            }
        }
    });
}

function updateInventoryUI() {
    if (inventoryScreen.style.display !== 'flex') return;

    const inventoryGrid = document.getElementById('inventory-grid');
    inventoryGrid.innerHTML = ''; // Clear existing slots

    player.inventory.forEach((count, type) => {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.style.backgroundColor = `#${new THREE.Color(blockColors[type]).getHexString()}`;

        const countElement = document.createElement('div');
        countElement.className = 'count';
        countElement.textContent = count > 1 ? count : '';

        const nameElement = document.createElement('div');
        nameElement.className = 'name';
        nameElement.textContent = blockNames[type];

        slot.appendChild(countElement);
        slot.appendChild(nameElement);
        inventoryGrid.appendChild(slot);
    });
}

function getPotentialCollidingBlocks(playerPos, motion = new THREE.Vector3()) {
    const startAABB = player.aabb.clone().translate(playerPos);
    const endAABB = startAABB.clone().translate(motion);
    const sweptAABB = new THREE.Box3().copy(startAABB).union(endAABB);

    const blocks = [];
    const minX = Math.floor(sweptAABB.min.x), maxX = Math.ceil(sweptAABB.max.x);
    const minY = Math.floor(sweptAABB.min.y), maxY = Math.ceil(sweptAABB.max.y);
    const minZ = Math.floor(sweptAABB.min.z), maxZ = Math.ceil(sweptAABB.max.z);

    for (let x = minX; x < maxX; x++) {
        for (let y = minY; y < maxY; y++) {
            for (let z = minZ; z < maxZ; z++) {
                const blockType = getBlock(x, y, z);
                if (blockType !== blockTypes.AIR && blockType !== blockTypes.WATER) {
                    blocks.push(new THREE.Box3(new THREE.Vector3(x, y, z), new THREE.Vector3(x + 1, y + 1, z + 1)));
                }
            }
        }
    }
    return blocks;
}

function updatePlayer(delta) {
    if (!controls.isLocked) return;

    const pos = controls.getObject().position;
    const initialPos = pos.clone();

    // Ground state from the PREVIOUS frame. player.onGround is reset to false
    // just below and only recomputed during the Y-collision pass, so the jump
    // check and the ground/air damping choice must read this captured value.
    const wasOnGround = player.onGround;

    // --- Y-axis movement (Gravity & Jump) ---
    player.velocity.y -= GRAVITY * delta; // Apply gravity

    if (keys['Space'] && wasOnGround) {
        player.velocity.y = player.jumpForce;
    }

    player.onGround = false;

    // --- Horizontal movement ---
    let moveDirection = new THREE.Vector3();
    if (keys['KeyW']) moveDirection.z = 1;
    if (keys['KeyS']) moveDirection.z = -1;
    if (keys['KeyA']) moveDirection.x = -1;
    if (keys['KeyD']) moveDirection.x = 1;

    let accelerationVector = new THREE.Vector3();
    if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize();

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

        accelerationVector.addScaledVector(forward, moveDirection.z);
        accelerationVector.addScaledVector(right, moveDirection.x);
        accelerationVector.normalize().multiplyScalar(ACCELERATION);
    }

    player.velocity.x += accelerationVector.x * delta;
    player.velocity.z += accelerationVector.z * delta;

    // Apply damping. Use wasOnGround (player.onGround is still false here until
    // the Y-collision pass runs below). The constants are tuned per-60fps-frame,
    // so we normalize by delta with pow() to keep the slide feel identical at any
    // refresh rate (otherwise a 144Hz monitor would kill momentum ~2.4x faster).
    const baseDamping = wasOnGround ? GROUND_DAMPING : AIR_DAMPING;
    const damping = Math.pow(baseDamping, delta * 60);
    player.velocity.x *= damping;
    player.velocity.z *= damping;

    // Clamp to max speed
    const horizontalSpeed = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.z * player.velocity.z);
    if (horizontalSpeed > player.speed) {
        const factor = player.speed / horizontalSpeed;
        player.velocity.x *= factor;
        player.velocity.z *= factor;
    }

    const motion = new THREE.Vector3(
        player.velocity.x * delta,
        player.velocity.y * delta,
        player.velocity.z * delta
    );


    // --- Collision Detection and Resolution ---
    const worldAABBs = getPotentialCollidingBlocks(pos, motion);
    let playerAABB = player.aabb.clone().translate(initialPos);

    // --- Y-axis Collision ---
    let yMotion = motion.y;
    for (const blockAABB of worldAABBs) {
        if (playerAABB.max.x > blockAABB.min.x && playerAABB.min.x < blockAABB.max.x &&
            playerAABB.max.z > blockAABB.min.z && playerAABB.min.z < blockAABB.max.z) {

            if (motion.y < 0 && playerAABB.min.y >= blockAABB.max.y) {
                const newMotion = blockAABB.max.y - playerAABB.min.y;
                if (newMotion > yMotion) {
                    yMotion = newMotion;
                    player.onGround = true;
                }
            } else if (motion.y > 0 && playerAABB.max.y <= blockAABB.min.y) {
                const newMotion = blockAABB.min.y - playerAABB.max.y;
                if (newMotion < yMotion) {
                    yMotion = newMotion;
                }
            }
        }
    }
    motion.y = yMotion;
    if (player.onGround || motion.y !== yMotion) {
        player.velocity.y = 0;
    }
    playerAABB.translate(new THREE.Vector3(0, motion.y, 0));

    // --- X-axis Collision ---
    let xMotion = motion.x;
    for (const blockAABB of worldAABBs) {
        if (playerAABB.max.y > blockAABB.min.y && playerAABB.min.y < blockAABB.max.y &&
            playerAABB.max.z > blockAABB.min.z && playerAABB.min.z < blockAABB.max.z) {

            if (motion.x < 0 && playerAABB.min.x >= blockAABB.max.x) {
                const newMotion = blockAABB.max.x - playerAABB.min.x;
                if (newMotion > xMotion) {
                    xMotion = newMotion;
                    player.velocity.x = 0;
                }
            } else if (motion.x > 0 && playerAABB.max.x <= blockAABB.min.x) {
                const newMotion = blockAABB.min.x - playerAABB.max.x;
                if (newMotion < xMotion) {
                    xMotion = newMotion;
                    player.velocity.x = 0;
                }
            }
        }
    }
    motion.x = xMotion;
    playerAABB.translate(new THREE.Vector3(motion.x, 0, 0));

    // --- Z-axis Collision ---
    let zMotion = motion.z;
    for (const blockAABB of worldAABBs) {
        if (playerAABB.max.x > blockAABB.min.x && playerAABB.min.x < blockAABB.max.x &&
            playerAABB.max.y > blockAABB.min.y && playerAABB.min.y < blockAABB.max.y) {

            if (motion.z < 0 && playerAABB.min.z >= blockAABB.max.z) {
                const newMotion = blockAABB.max.z - playerAABB.min.z;
                if (newMotion > zMotion) {
                    zMotion = newMotion;
                    player.velocity.z = 0;
                }
            } else if (motion.z > 0 && playerAABB.max.z <= blockAABB.min.z) {
                const newMotion = blockAABB.min.z - playerAABB.max.z;
                if (newMotion < zMotion) {
                    zMotion = newMotion;
                    player.velocity.z = 0;
                }
            }
        }
    }
    motion.z = zMotion;

    pos.add(motion);

    if (pos.y < -20) {
        pos.y = WORLD_HEIGHT;
        pos.x = WORLD_WIDTH / 2;
        pos.z = WORLD_DEPTH / 2;
        player.velocity.set(0, 0, 0);
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (controls.isLocked) {
        updatePlayer(delta);
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

// In third-person we temporarily pull the camera back behind the eye, render,
// then restore it — so player movement/collision keep using the true eye
// position and aren't affected by the camera offset.
function renderScene() {
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
        if (playerModel) playerModel.visible = false;
        renderer.render(scene, camera);
    }
}

init();
