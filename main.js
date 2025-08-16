import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// === Renderer ===
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// === Scene & Camera ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // pure white background

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
// camera directly above, looking down
camera.position.set(0, 0, 6);
camera.lookAt(0, 0, 0);
scene.add(camera);

// === Lights ===
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

// === Coin Holder ===
let coin = new THREE.Group();
scene.add(coin);

// === Load coin GLB or placeholder ===
const loader = new GLTFLoader();
loader.load(
  './coin.glb',
  gltf => {
    gltf.scene.scale.set(6, 6, 6);
    gltf.scene.rotation.x = Math.PI; // flat, tails up
    coin.add(gltf.scene);
    console.log('coin.glb loaded');
  },
  undefined,
  err => {
    console.warn('coin.glb not found, using placeholder');
    const placeholder = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 0.3, 64),
      new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.3 })
    );
    placeholder.rotation.x = Math.PI; // tails up
    coin.add(placeholder);
  }
);

// === Flip Physics ===
let flipping = false;
let vx = 0, vy = 0, vz = 0;
const damping = 0.985;
const settleThreshold = 0.02;
const resultEl = document.getElementById('result');

function startFlip() {
  if (flipping) return;
  flipping = true;
  // random angular velocities
  vx = (Math.random() * 0.5 - 0.25); // tilt
  vy = (Math.random() * 2 + 1);      // spin
  vz = (Math.random() * 0.5 - 0.25); // wobble
  resultEl.textContent = '';
}

function settleFlatAndReport() {
  // snap rotation.x to nearest multiple of π
  const targetX = Math.round(coin.rotation.x / Math.PI) * Math.PI;
  coin.rotation.x = THREE.MathUtils.damp(coin.rotation.x, targetX, 12, 0.08);
  vy = 0; vx = 0; vz = 0;

  // decide which side is up (tails = 0, heads = π)
  const side = (Math.abs((targetX % (2 * Math.PI))) < 1e-2) ? 'Tails' : 'Heads';
  resultEl.textContent = side;
  flipping = false;
}

// === Animation Loop ===
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);

  if (flipping) {
    coin.rotation.x += vx * dt * 60;
    coin.rotation.y += vy * dt * 60;
    coin.rotation.z += vz * dt * 60;

    vx *= damping;
    vy *= damping;
    vz *= damping;

    if (Math.abs(vx) < settleThreshold &&
        Math.abs(vy) < settleThreshold &&
        Math.abs(vz) < settleThreshold) {
      settleFlatAndReport();
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// === Resize Handler ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === UI Buttons ===
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
