// Game constants
export const WORLD_WIDTH = 96;
export const WORLD_DEPTH = 96;
export const WORLD_HEIGHT = 64;
export const SEA_LEVEL = 32;
export const CHUNK_SIZE = 16;

// Inventory
export const INVENTORY_SLOTS = 36;
export const HOTBAR_SLOTS = 9;
export const TOTAL_INVENTORY_SLOTS = INVENTORY_SLOTS + HOTBAR_SLOTS;
export const INVENTORY_MAX_STACK = 64;

// Physics constants
export const GRAVITY = 19.6;

// Movement tuning.
export const GROUND_ACCELERATION = 70;
export const AIR_ACCELERATION = 16;
export const MAX_GROUND_SPEED = 5.4;
export const MAX_AIR_SPEED = 5.8;
export const CROUCH_SPEED_MULTIPLIER = 0.5;
export const DEFAULT_GROUND_DAMPING = 0.70;
export const AIR_DAMPING = 0.96;
export const STOP_EPSILON = 0.015;

// Camera/collision fixes
export const CAMERA_NEAR = 0.03;
export const COLLISION_SKIN = 0.03;
export const CAMERA_DISTANCE = 4.5;
