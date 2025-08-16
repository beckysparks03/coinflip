import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ---------- scene & camera ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// Camera directly above, looking down at origin
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 0, 6);
camera.lookAt(0, 0, 0);
scene.add(camera);

// ---------- lights ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(3, 5, 4);
scene.add(dir);

// ---------- coin group ----------
const coin = new THREE.Group();
coin.position.set(0, 0, 0); // centered
scene.add(coin);

// ---------- load coin ----------
const loader = new GLTFLoader();
loader.load(
  './coin.glb',
  (gltf) => {
    const root = gltf.scene;
    root.scale.set(3, 3, 3);        // smaller so it fits center
    root.rotation.x = Math.PI;      // tails up
    coin.add(root);
    ready = true;
  },
  undefined,
  () => {
    // fallback placeholder
    const placeholder = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.15, 96),
      new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.3 })
    );
    placeholder.rotation.x = Math.PI; // tails up
    coin.add(placeholder);
    ready = true;
  }
);

// ---------- flip physics ----------
let ready = false;
let flipping = false;
let vx = 0, vy = 0; // angular velocities
let vz = 0;        // upward velocity (toward camera)
const damping = 0.985;
const settleThreshold = 0.02;
let settling = false;
let targetX = 0;
const resultEl = document.getElementById('result');
const initialIsTails = true;

function startFlip() {
  if (!ready || flipping || settling) return;

  flipping = true;

  // rotation velocities
  vx = (Math.random() * 1.2 + 0.6) * (Math.random() < 0.5 ? -1 : 1); // wobble
  vy = (Math.random() * 2.0 + 1.0);                                  // spin

  // upward velocity (so coin "jumps" toward camera)
  vz = 0.25; 

  if (resultEl) resultEl.textContent = '';
}

function beginSettle() {
  flipping = false;
  settling = true;
  targetX = Math.round(coin.rotation.x / Math.PI) * Math.PI;
}

function finishSettleAndReport() {
  settling = false;
  coin.position.z = 0; // back to table

  const nx = Math.abs(Math.round(targetX / Math.PI)) % 2;
  const isTailsUp = initialIsTails ? (nx === 0) : (nx === 1);
  const side = isTailsUp ? 'Tails' : 'Heads';
  if (resultEl) resultEl.textContent = side;
}

// ---------- animation ----------
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);

  if (flipping) {
    const scale = dt * 60;

    // spin
    coin.rotation.x += vx * scale;
    coin.rotation.y += vy * scale;

    vx *= damping;
    vy *= damping;

    // coin jumps upward toward camera
    coin.position.z += vz * scale;
    vz *= 0.96; // gravity-like slowdown

    if (Math.abs(vx) < settleThreshold && Math.abs(vy) < settleThreshold && Math.abs(vz) < 0.01) {
      beginSettle();
    }
  } else if (settling) {
    coin.rotation.x = THREE.MathUtils.damp(coin.rotation.x, targetX, 12, 0.08);
    coin.rotation.y = THREE.MathUtils.damp(coin.rotation.y, 0, 12, 0.08);

    // bring coin back to "table" (z=0)
    coin.position.z = THREE.MathUtils.damp(coin.position.z, 0, 12, 0.08);

    const dx = Math.abs(coin.rotation.x - targetX);
    const dy = Math.abs(coin.rotation.y);
    const dz = Math.abs(coin.position.z);

    if (dx < 1e-3 && dy < 1e-3 && dz < 1e-2) {
      coin.rotation.x = targetX;
      coin.rotation.y = 0;
      coin.position.z = 0;
      finishSettleAndReport();
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// ---------- resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- UI / motion ----------
document.getElementById('tossBtn')?.addEventListener('click', startFlip);

const motionBtn = document.getElementById('motionBtn');
motionBtn?.addEventListener('click', async () => {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      const res = await DeviceMotionEvent.requestPermission();
      if (res !== 'granted') return;
    }
    window.addEventListener('devicemotion', (e) => {
      const a = e.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
      const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
      if (mag > 20 && !flipping && !settling) startFlip();
    }, { passive: true });
    if (motionBtn) { motionBtn.textContent = 'Motion Enabled'; motionBtn.disabled = true; }
  } catch {}
});


