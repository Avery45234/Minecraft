import * as THREE from 'three';
import { getBlock } from './world.js';
import { BLOCK_BY_ID, BLOCK } from './blocks.js';
import { 
    GRAVITY,
    GROUND_ACCELERATION,
    AIR_ACCELERATION,
    MAX_GROUND_SPEED,
    MAX_AIR_SPEED,
    CROUCH_SPEED_MULTIPLIER,
    DEFAULT_GROUND_DAMPING,
    AIR_DAMPING,
    STOP_EPSILON,
    COLLISION_SKIN,
    TOTAL_INVENTORY_SLOTS,
    WORLD_WIDTH,
    WORLD_HEIGHT,
    WORLD_DEPTH
} from './constants.js';

// Player state
export const player = {
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

let playerModel;
let scene, camera, controls;

export function initPlayer(mainScene, mainCamera, mainControls) {
    scene = mainScene;
    camera = mainCamera;
    controls = mainControls;
    createPlayerModel();
}


export function createPlayerModel() {
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

export function getPlayerModel() {
    return playerModel;
}

export function setCrouch(crouching) {
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
    
    camera.position.y += (targetEyeHeight - (player.isCrouching ? player.eyeHeight : player.crouchEyeHeight));
    
    player.aabb.min.y = -targetEyeHeight;
    player.aabb.max.y = targetHeight - targetEyeHeight;
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

export function updatePlayerModelTransform() {
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
                const block = BLOCK_BY_ID[blockId];
                if (block && block.id !== 0 && block.solid !== false) {
                    blocks.push(new THREE.Box3(new THREE.Vector3(x, y, z), new THREE.Vector3(x + 1, y + 1, z + 1)));
                }
            }
        }
    }
    return blocks;
}

export function updatePlayer(delta, keys) {
    const pos = controls.getObject().position;
    const initialPos = pos.clone();

    // Check if in water
    const eyeBlockId = getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
    const inWater = eyeBlockId === BLOCK.WATER.id;

    const wasOnGround = player.onGround;
    player.onGround = false;

    if (inWater) {
        player.velocity.y -= GRAVITY * delta * 0.5; // Reduced gravity in water
        player.velocity.y = Math.max(player.velocity.y, -2); // Terminal velocity in water
        if (keys['Space']) {
            player.velocity.y += 4 * delta; // Swim up
        }
    } else {
        player.velocity.y -= GRAVITY * delta;
        if (keys['Space'] && wasOnGround) {
            player.velocity.y = player.jumpForce;
        }
    }
    keys['Space'] = false; // Consume jump input

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
                if(inWater) targetSpeed *= 0.5; // Slower in water
                if (player.isCrouching) {
                    targetSpeed *= CROUCH_SPEED_MULTIPLIER;
                }
                const movementAcceleration = wasOnGround ? GROUND_ACCELERATION : AIR_ACCELERATION;
                moveHorizontalVelocityToward(desiredDirection.x * targetSpeed, desiredDirection.z * targetSpeed, movementAcceleration * delta);
            }
        }
    }
    let maxSpeed = wasOnGround ? MAX_GROUND_SPEED : MAX_AIR_SPEED;
    if(inWater) maxSpeed *= 0.5;
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

    let damping = player.onGround ? DEFAULT_GROUND_DAMPING : AIR_DAMPING;
    if (inWater) {
        damping = 0.8;
    } else if (player.onGround) {
        const groundBlockX = Math.floor(pos.x);
        const groundBlockY = Math.floor(pos.y + player.aabb.min.y - 0.01);
        const groundBlockZ = Math.floor(pos.z);
        const groundBlockId = getBlock(groundBlockX, groundBlockY, groundBlockZ);
        damping = BLOCK_BY_ID[groundBlockId]?.damping || DEFAULT_GROUND_DAMPING;
    }

    if (!hasMovementInput || inWater) {
        const frameDamping = Math.pow(damping, delta * 60);
        player.velocity.x *= frameDamping;
        player.velocity.z *= frameDamping;
        if(inWater) player.velocity.y *= frameDamping;
        stopTinyHorizontalVelocity();
    }

    clampHorizontalSpeed(maxSpeed);
    if (pos.y < -20) {
        pos.set(WORLD_WIDTH / 2, WORLD_HEIGHT, WORLD_DEPTH / 2);
        player.velocity.set(0, 0, 0);
    }
}
