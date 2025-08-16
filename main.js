import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 3);
scene.add(camera);

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(2, 4, 2);
scene.add(dirLight);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({ color: 0x222222 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Coin holder
let coin = new THREE.Group();
scene.add(coin);

// Try to load GLB
const loader = new GLTFLoader();
loader.load(
  './coin.glb',
  gltf => {
    gltf.scene.scale.set(6, 6, 6);     // make ~6x bigger
    gltf.scene.position.set(0, 0, 0);  // center in scene
    coin.add(gltf.scene);
    console.log('coin.glb loaded');
  },
  undefined,
  err => {
    console.warn('coin.glb not found, using placeholder');
    const placeholder = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 0.3, 64), // bigger placeholder
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 })
    );
    coin.add(placeholder);
  }
);


// Flip logic
let flipping = false;
let vy = 0, vx = 0;
const damping = 0.985;
const settleThreshold = 0.02;
const resultEl = document.getElementById('result');

function startFlip() {
  if (flipping) return;
  flipping = true;
  vy = (Math.random() * 0.7 + 0.3) * (Math.random() < 0.5 ? -1 : 1);
  vx = (Math.random() * 1.2 + 0.8);
  resultEl.textContent = '';
}

function settleFlatAndReport() {
  const targetX = Math.round(coin.rotation.x / Math.PI) * Math.PI;
  coin.rotation.x = THREE.MathUtils.damp(coin.rotation.x, targetX, 12, 0.08);
  vy = 0;
  vx = 0;
  const side = (Math.abs((targetX % (2 * Math.PI))) < 1e-3) ? 'Heads' : 'Tails';
  resultEl.textContent = side;
  flipping = false;
}

// Animate
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);
  if (flipping) {
    coin.rotation.y += vy * dt * 60;
    coin.rotation.x += vx * dt * 60;
    vy *= damping; vx *= damping;
    if (Math.abs(vy) < settleThreshold && Math.abs(vx) < settleThreshold) {
      settleFlatAndReport();
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// UI
document.getElementById('tossBtn').addEventListener('click', startFlip);

const motionBtn = document.getElementById('motionBtn');
motionBtn.addEventListener('click', async () => {
  if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
    const res = await DeviceMotionEvent.requestPermission();
    if (res !== 'granted') return;
  }
  window.addEventListener('devicemotion', e => {
    const a = e.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
    const mag = Math.hypot(a.x, a.y, a.z);
    if (mag > 20 && !flipping) startFlip();
  }, { passive: true });
  motionBtn.textContent = 'Motion Enabled';
  motionBtn.disabled = true;
});
