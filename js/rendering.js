import * as THREE from 'three';
import { updatePlayerModelTransform, getPlayerModel } from './player.js';
import { CAMERA_NEAR, CAMERA_DISTANCE } from './constants.js';

let scene, camera, renderer;
let solidMaterial, transparentMaterial, waterMaterial;
let thirdPerson = false;

export function initRenderer(container) {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 55, 130);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, CAMERA_NEAR, 1000);

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
    
    window.addEventListener('resize', onWindowResize);
    
    return { scene, camera, renderer, solidMaterial, transparentMaterial, waterMaterial };
}

export function toggleThirdPerson() {
    thirdPerson = !thirdPerson;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function renderScene() {
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
        if (playerModel) {
            playerModel.visible = false;
        }
        renderer.render(scene, camera);
    }
}
