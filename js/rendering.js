import * as THREE from 'three';
import { updatePlayerModelTransform, getPlayerModel } from './player.js';
import { CAMERA_NEAR, CAMERA_DISTANCE } from './constants.js';

let scene, camera, renderer;
let solidMaterial, transparentMaterial, waterMaterial;
let thirdPerson = false;

function createAtlasTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Helper: tile origin
    const tx = (col) => col * 16;
    const ty = (row) => row * 16;

    // ── Row 0 ──────────────────────────────────────────────────────────────

    // [0,0] Grass Top
    ctx.fillStyle = '#5CB85C';
    ctx.fillRect(tx(0), ty(0), 16, 16);
    // darker patches (deterministic positions)
    ctx.fillStyle = '#4A9A4A';
    const darkDots = [[1,1],[4,6],[7,2],[10,9],[13,4],[2,12],[8,14],[5,10],[11,7],[14,1],[0,8],[3,14]];
    for (const [dx, dy] of darkDots) { ctx.fillRect(tx(0)+dx, ty(0)+dy, 2, 2); }
    // lighter highlights
    ctx.fillStyle = '#70D070';
    const lightDots = [[3,3],[9,1],[12,6],[6,11],[1,14],[14,10]];
    for (const [dx, dy] of lightDots) { ctx.fillRect(tx(0)+dx, ty(0)+dy, 1, 1); }

    // [1,0] Grass Side
    ctx.fillStyle = '#8B6340'; // dirt base
    ctx.fillRect(tx(1), ty(0), 16, 16);
    ctx.fillStyle = '#5CB85C'; // green top strip 4px
    ctx.fillRect(tx(1), ty(0), 16, 4);
    // dirt texture dots
    ctx.fillStyle = '#6B4A2A';
    const sideDirts = [[1,5],[4,8],[7,6],[10,11],[13,7],[2,14],[6,13],[9,9],[12,5],[15,12],[0,10]];
    for (const [dx, dy] of sideDirts) { ctx.fillRect(tx(1)+dx, ty(0)+dy, 1, 1); }
    ctx.fillStyle = '#9B7350';
    const sideLights = [[3,7],[8,5],[11,13],[5,11],[14,9]];
    for (const [dx, dy] of sideLights) { ctx.fillRect(tx(1)+dx, ty(0)+dy, 1, 1); }

    // [2,0] Dirt
    ctx.fillStyle = '#8B6340';
    ctx.fillRect(tx(2), ty(0), 16, 16);
    ctx.fillStyle = '#6B4A2A';
    const dirtDark = [[0,2],[3,6],[6,1],[9,4],[12,8],[1,11],[5,14],[8,10],[11,13],[14,3],[2,9],[7,12],[13,6],[4,0],[15,15]];
    for (const [dx, dy] of dirtDark) { ctx.fillRect(tx(2)+dx, ty(0)+dy, 2, 2); }
    ctx.fillStyle = '#9B7350';
    const dirtLight = [[2,4],[7,9],[12,2],[5,13],[10,7],[0,14],[14,11]];
    for (const [dx, dy] of dirtLight) { ctx.fillRect(tx(2)+dx, ty(0)+dy, 1, 1); }

    // [3,0] Stone
    ctx.fillStyle = '#808080';
    ctx.fillRect(tx(3), ty(0), 16, 16);
    // Crack lines
    ctx.fillStyle = '#606060';
    ctx.fillRect(tx(3)+1,  ty(0)+3,  8, 1);
    ctx.fillRect(tx(3)+7,  ty(0)+7,  6, 1);
    ctx.fillRect(tx(3)+2,  ty(0)+11, 10, 1);
    // light specks
    ctx.fillStyle = '#9A9A9A';
    const stoneHighlights = [[2,1],[5,5],[9,2],[13,8],[1,13],[10,14],[6,9],[14,4]];
    for (const [dx, dy] of stoneHighlights) { ctx.fillRect(tx(3)+dx, ty(0)+dy, 1, 1); }

    // ── Row 1 ──────────────────────────────────────────────────────────────

    // [0,1] Sand
    ctx.fillStyle = '#DABC7A';
    ctx.fillRect(tx(0), ty(1), 16, 16);
    ctx.fillStyle = '#C8AA68';
    const sandDark = [[1,2],[4,7],[8,3],[11,9],[14,1],[2,13],[6,11],[9,14],[12,5],[0,6],[7,0],[13,12]];
    for (const [dx, dy] of sandDark) { ctx.fillRect(tx(0)+dx, ty(1)+dy, 2, 1); }
    ctx.fillStyle = '#E8CA8A';
    const sandLight = [[3,4],[10,2],[5,9],[13,7],[1,14],[8,12]];
    for (const [dx, dy] of sandLight) { ctx.fillRect(tx(0)+dx, ty(1)+dy, 1, 1); }

    // [1,1] Wood Log
    ctx.fillStyle = '#7B4B1A';
    ctx.fillRect(tx(1), ty(1), 16, 16);
    // horizontal grain lines
    const grainDark  = [0, 3, 6, 9, 12, 15];
    const grainLight = [1, 4, 7, 10, 13];
    ctx.fillStyle = '#5A3610';
    for (const dy of grainDark)  { ctx.fillRect(tx(1), ty(1)+dy, 16, 1); }
    ctx.fillStyle = '#9B6B2A';
    for (const dy of grainLight) { ctx.fillRect(tx(1), ty(1)+dy, 16, 1); }

    // [2,1] Leaves
    ctx.fillStyle = '#1A6B00';
    ctx.fillRect(tx(2), ty(1), 16, 16);
    ctx.fillStyle = '#154E00';
    const leafDark = [[0,0],[3,3],[6,0],[9,4],[12,1],[1,7],[4,10],[7,7],[10,11],[13,8],[2,14],[5,13],[8,14],[11,13],[14,14],[0,12],[3,15]];
    for (const [dx, dy] of leafDark) { ctx.fillRect(tx(2)+dx, ty(1)+dy, 3, 3); }
    ctx.fillStyle = '#0D3A00';
    const leafHoles = [[2,2],[8,5],[13,3],[5,9],[10,8],[1,13],[12,12]];
    for (const [dx, dy] of leafHoles) { ctx.fillRect(tx(2)+dx, ty(1)+dy, 2, 2); }
    ctx.fillStyle = '#2A8B10';
    const leafLight = [[5,2],[1,5],[11,2],[14,7],[7,12],[3,11],[9,14]];
    for (const [dx, dy] of leafLight) { ctx.fillRect(tx(2)+dx, ty(1)+dy, 1, 1); }

    // [3,1] Water
    ctx.fillStyle = '#1E6FBF';
    ctx.fillRect(tx(3), ty(1), 16, 16);
    ctx.fillStyle = '#3AAFEF';
    ctx.fillRect(tx(3), ty(1)+4,  16, 2);
    ctx.fillRect(tx(3), ty(1)+9,  16, 2);
    ctx.fillStyle = '#5CCFFF';
    ctx.fillRect(tx(3)+2, ty(1)+4, 6, 1);
    ctx.fillRect(tx(3)+8, ty(1)+9, 5, 1);

    // ── Row 2 ──────────────────────────────────────────────────────────────

    // [0,2] Planks
    ctx.fillStyle = '#C8A464';
    ctx.fillRect(tx(0), ty(2), 16, 16);
    ctx.fillStyle = '#A8843C';
    // horizontal grain every 4px
    for (const dy of [0, 4, 8, 12]) { ctx.fillRect(tx(0), ty(2)+dy, 16, 1); }
    // vertical split at x+8
    ctx.fillRect(tx(0)+8, ty(2), 1, 16);
    // highlight rows
    ctx.fillStyle = '#D8B474';
    for (const dy of [2, 6, 10, 14]) { ctx.fillRect(tx(0), ty(2)+dy, 16, 1); }

    // [1,2] Crafting Table Top
    ctx.fillStyle = '#C8A464';
    ctx.fillRect(tx(1), ty(2), 16, 16);
    // draw cross in dark brown
    ctx.fillStyle = '#5A3A0A';
    ctx.fillRect(tx(1)+6,  ty(2),   4, 16); // vertical bar
    ctx.fillRect(tx(1),    ty(2)+6, 16,  4); // horizontal bar
    // restore the four corner squares back to planks color to give "cross on planks" look
    ctx.fillStyle = '#C8A464';
    ctx.fillRect(tx(1),    ty(2),    6,  6);
    ctx.fillRect(tx(1)+10, ty(2),    6,  6);
    ctx.fillRect(tx(1),    ty(2)+10, 6,  6);
    ctx.fillRect(tx(1)+10, ty(2)+10, 6,  6);
    // subtle planks grain inside corners
    ctx.fillStyle = '#A8843C';
    ctx.fillRect(tx(1),    ty(2)+2, 6, 1);
    ctx.fillRect(tx(1)+10, ty(2)+2, 6, 1);
    ctx.fillRect(tx(1),    ty(2)+12, 6, 1);
    ctx.fillRect(tx(1)+10, ty(2)+12, 6, 1);

    // [2,2] Cobblestone
    ctx.fillStyle = '#888888';
    ctx.fillRect(tx(2), ty(2), 16, 16);
    // grout lines
    ctx.fillStyle = '#444444';
    ctx.fillRect(tx(2),   ty(2)+7,  16, 2); // horizontal grout
    ctx.fillRect(tx(2)+8, ty(2),     2, 7); // vertical grout upper
    ctx.fillRect(tx(2)+4, ty(2)+9,   2, 7); // vertical grout lower (offset for stagger)
    // stone cells
    ctx.fillStyle = '#AAAAAA';
    ctx.fillRect(tx(2)+1, ty(2)+1, 6, 5);
    ctx.fillRect(tx(2)+10, ty(2)+1, 5, 5);
    ctx.fillRect(tx(2)+1, ty(2)+10, 2, 5);
    ctx.fillRect(tx(2)+6,  ty(2)+10, 9, 5);
    // inner shadow borders on cells
    ctx.fillStyle = '#555555';
    ctx.fillRect(tx(2)+1, ty(2)+6, 6, 1);
    ctx.fillRect(tx(2)+10, ty(2)+6, 5, 1);
    ctx.fillRect(tx(2)+7, ty(2)+1, 1, 5);
    ctx.fillRect(tx(2)+3, ty(2)+9, 1, 6);

    // [3,2] Furnace Front
    ctx.fillStyle = '#808080';
    ctx.fillRect(tx(3), ty(2), 16, 16);
    // noise dots
    ctx.fillStyle = '#666666';
    const furnNoise = [[1,1],[4,4],[9,2],[12,6],[2,9],[7,13],[14,10],[6,7],[11,14],[0,12],[13,3]];
    for (const [dx, dy] of furnNoise) { ctx.fillRect(tx(3)+dx, ty(2)+dy, 1, 1); }
    // fire opening border
    ctx.fillStyle = '#404040';
    ctx.fillRect(tx(3)+3, ty(2)+7, 10, 8);
    // fire glow
    ctx.fillStyle = '#FF6600';
    ctx.fillRect(tx(3)+4, ty(2)+8, 8, 6);
    ctx.fillStyle = '#FFAA00';
    ctx.fillRect(tx(3)+5, ty(2)+9, 6, 4);
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(tx(3)+6, ty(2)+10, 4, 2);
    // top slot border (input slot)
    ctx.fillStyle = '#404040';
    ctx.fillRect(tx(3)+5, ty(2)+2, 6, 4);
    ctx.fillStyle = '#666666';
    ctx.fillRect(tx(3)+6, ty(2)+3, 4, 2);

    // ── Row 3 ──────────────────────────────────────────────────────────────

    // [0,3] Stick
    ctx.fillStyle = '#1A0A00'; // dark background
    ctx.fillRect(tx(0), ty(3), 16, 16);
    // stick body (4px wide, full height minus 1px margin each side)
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(tx(0)+6, ty(3)+1, 4, 14);
    // center shadow
    ctx.fillStyle = '#6B3A1B';
    ctx.fillRect(tx(0)+7, ty(3)+1, 2, 14);
    // left highlight edge
    ctx.fillStyle = '#AB7A3B';
    ctx.fillRect(tx(0)+6, ty(3)+1, 1, 14);
    // end caps
    ctx.fillStyle = '#5A3010';
    ctx.fillRect(tx(0)+6, ty(3)+14, 4, 1);
    ctx.fillRect(tx(0)+6, ty(3)+1,  4, 1);

    // [1,3] Chest
    ctx.fillStyle = '#8B5A2B'; // oak wood
    ctx.fillRect(tx(1), ty(3), 16, 16);
    // lid separator line
    ctx.fillStyle = '#5A3A1A';
    ctx.fillRect(tx(1), ty(3)+7, 16, 2);
    // gold clasp
    ctx.fillStyle = '#C8A450';
    ctx.fillRect(tx(1)+6, ty(3)+5, 4, 5);
    ctx.fillStyle = '#E0BC60';
    ctx.fillRect(tx(1)+7, ty(3)+6, 2, 3);
    ctx.fillStyle = '#5A3A1A';
    ctx.fillRect(tx(1)+7, ty(3)+7, 2, 1); // clasp keyhole
    // wood grain lines
    ctx.fillStyle = '#6B4020';
    ctx.fillRect(tx(1), ty(3)+2,  16, 1);
    ctx.fillRect(tx(1), ty(3)+11, 16, 1);
    ctx.fillRect(tx(1), ty(3)+14, 16, 1);
    // edge darkening
    ctx.fillStyle = '#5A3A1A';
    ctx.fillRect(tx(1),   ty(3), 1, 16);
    ctx.fillRect(tx(1)+15, ty(3), 1, 16);

    // [2,3] Glass
    ctx.fillStyle = '#B8D8FF';
    ctx.fillRect(tx(2), ty(3), 16, 16);
    // white corner squares (highlight reflections)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(tx(2)+1, ty(3)+1, 3, 3);
    ctx.fillRect(tx(2)+12, ty(3)+1, 3, 3);
    ctx.fillRect(tx(2)+1, ty(3)+12, 3, 3);
    ctx.fillRect(tx(2)+12, ty(3)+12, 3, 3);
    // edge lines in steel blue
    ctx.fillStyle = '#8AB8E8';
    ctx.fillRect(tx(2),   ty(3),    16, 1); // top edge
    ctx.fillRect(tx(2),   ty(3),    1, 16); // left edge
    ctx.fillRect(tx(2),   ty(3)+15, 16, 1); // bottom edge
    ctx.fillRect(tx(2)+15, ty(3),   1, 16); // right edge
    // faint center cross reflection
    ctx.fillStyle = '#D0E8FF';
    ctx.fillRect(tx(2)+7, ty(3)+1, 2, 14);
    ctx.fillRect(tx(2)+1, ty(3)+7, 14, 2);

    // [3,3] Tools (wooden pickaxe icon)
    ctx.fillStyle = '#1A0A00'; // dark background
    ctx.fillRect(tx(3), ty(3), 16, 16);
    // handle (brown)
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(tx(3)+7, ty(3)+5, 2, 9);
    ctx.fillStyle = '#6B3A1B';
    ctx.fillRect(tx(3)+8, ty(3)+5, 1, 9); // shadow
    ctx.fillStyle = '#AB7A3B';
    ctx.fillRect(tx(3)+7, ty(3)+5, 1, 9); // highlight
    // pickaxe head (gray)
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(tx(3)+3, ty(3)+3, 10, 3);
    // head shadow row
    ctx.fillStyle = '#808080';
    ctx.fillRect(tx(3)+3, ty(3)+5, 10, 1);
    // tips slightly lighter
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(tx(3)+2,  ty(3)+3, 1, 2); // left tip
    ctx.fillRect(tx(3)+13, ty(3)+3, 1, 2); // right tip
    // center mount (where handle meets head)
    ctx.fillStyle = '#A0A0A0';
    ctx.fillRect(tx(3)+6, ty(3)+4, 4, 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function initRenderer(container) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 55, 130);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, CAMERA_NEAR, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x87ceeb);
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

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

    const texture = createAtlasTexture();
    solidMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0.0, side: THREE.FrontSide });
    transparentMaterial = new THREE.MeshStandardMaterial({ map: texture, transparent: true, opacity: 0.88, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });
    waterMaterial = new THREE.MeshPhysicalMaterial({ map: texture, transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.0, transmission: 0.2, thickness: 0.4, ior: 1.33, color: 0x7fd8ff, emissive: 0x10364f, emissiveIntensity: 0.18, side: THREE.DoubleSide });

    window.addEventListener('resize', onWindowResize);

    return { solidMaterial, transparentMaterial, waterMaterial };
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }

export function toggleThirdPerson() {
    thirdPerson = !thirdPerson;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function renderScene() {
    if (!renderer || !scene || !camera) return;

    if (waterMaterial) {
        const t = performance.now() * 0.001;
        waterMaterial.opacity = 0.68 + Math.sin(t * 1.6) * 0.04;
        waterMaterial.emissiveIntensity = 0.16 + Math.sin(t * 1.2) * 0.03;
    }

    updatePlayerModelTransform();
    const playerModel = getPlayerModel();

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
