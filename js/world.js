import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { BLOCK, BLOCK_BY_ID, ATLAS_COLS, ATLAS_ROWS, TILE_SIZE_UV, TILE_HEIGHT_UV } from './blocks.js';
import { WORLD_WIDTH, WORLD_DEPTH, WORLD_HEIGHT, SEA_LEVEL, CHUNK_SIZE } from './constants.js';

export let world = {};
export let chunkMeshes = {};

let scene;
let solidMaterial, transparentMaterial, waterMaterial;

export function initWorld(mainScene, sMaterial, tMaterial, wMaterial) {
    scene = mainScene;
    solidMaterial = sMaterial;
    transparentMaterial = tMaterial;
    waterMaterial = wMaterial;
}

export function generateWorld() {
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

export function getBlock(x, y, z) {
    const chunkId = getChunkId(x, y, z);
    if (!world[chunkId]) return BLOCK.AIR.id;
    const lx = x & (CHUNK_SIZE - 1);
    const ly = y & (CHUNK_SIZE - 1);
    const lz = z & (CHUNK_SIZE - 1);
    return world[chunkId][lx][ly][lz] || BLOCK.AIR.id;
}

export function setBlock(x, y, z, type) {
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

export function updateDirtyChunks(x, y, z) {
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
