import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.164.1/examples/jsm/loaders/GLTFLoader.js';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Scene & camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 1.1, 3);
scene.add(camera);

// Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.8);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.1);
dir.position.set(2.5, 4, 2.5);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.camera.near = 0.1;
dir.shadow.camera.far = 20;
scene.add(dir);

// Ground
const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 1, metalness: 0 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Coin
let coin = new THREE.Group();
scene.add(coin);

// Load GLB coin
const loader = new GLTFLoader();
let ready = false;
loader.load(
  'coin.glb',
  (gltf) => {
    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    root.position.sub(center);

    const desiredDiameter = 1.0;
    const largestDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = desiredDiameter / largestDim;
    root.scale.setScalar(scale);

    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        if (!o.material.isMeshStandardMaterial) {
          o.material = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.35 });
        }
      }
    });

    coin.add(root);
    ready = true;
  },
  undefined,
  (err) => console.error('GLB load error:', err)
);

// Flip physics
let flipping = false;
let vy = 0, vx = 0;
const damping = 0.985;
const settleThreshold = 0.02;
const resultEl = document.getElementById('result');

function startFlip() {
  if (!ready || flipping) return;
  flipping = true;
  vy = (Math.random() * 0.7 + 0.3) * (Math.random() < 0.5 ? -1 : 1);
  vx = (Math.random() * 1.8 + 1.2);
  resultEl.hidden = true;
}

function settleFlatAndReport() {
  const rot = coin.rotation;
  let targetX = Math.round(rot.x / Math.PI) * Math.PI;
  rot.x = THREE.MathUtils.damp(rot.x, targetX, 12, 0.08);
  vy = 0; vx = 0;
  const side = (Math.abs((targetX % (2 * Math.PI))) < 1e-3) ? 'Heads' : 'Tails';
  resultEl.textContent = side;
  resultEl.hidden = false;
}

// Animation loop
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);

  if (ready && !flipping) {
    coin.position.y = THREE.MathUtils.lerp(coin.position.y, 0.02 * Math.sin(performance.now() * 0.001), 0.08);
  }

  if (flipping && ready) {
    coin.rotation.y += vy * dt * 60;
    coin.rotation.x += vx * dt * 60;
    vy *= damping;
    vx *= damping;

    if (Math.abs(vy) < settleThreshold && Math.abs(vx) < settleThreshold) {
      flipping = false;
      settleFlatAndReport();
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// Responsive
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Motion permission + shake detection
const motionBtn = document.getElementById('motionBtn');
const tossBtn = document.getElementById('tossBtn');

function startShakeListener() {
  window.addEventListener('devicemotion', (e) => {
    const a = e.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
    const mag = Math.hypot(a.x, a.y, a.z);
    if (mag > 20 && !flipping) startFlip();
  }, { passive: true });
}

motionBtn.addEventListener('click', async () => {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      const res = await DeviceMotionEvent.requestPermission();
      if (res === 'granted') startShakeListener();
    } else {
      startShakeListener();
    }
    motionBtn.textContent = 'Motion Enabled';
    motionBtn.disabled = true;
  } catch (e) {
    console.error(e);
  }
});

tossBtn.addEventListener('click', startFlip);
