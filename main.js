import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ---------- scene & camera (pure white bg, top-down view) ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// Camera sits on +Z axis looking at origin (top-down onto coin lying in XY)
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 0, 6);
camera.lookAt(0, 0, 0);
scene.add(camera);

// ---------- lights (subtle so metal still reads on white) ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(3, 5, 4);
scene.add(dir);

// ---------- coin group ----------
const coin = new THREE.Group();
scene.add(coin);

// ---------- helpers ----------
function normalizeCenterAndOrientFlat(root) {
  // Center the model at the origin and scale to a nice on-screen size
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  root.position.sub(center);

  // Scale so the coin diameter ~ 6 world units (nice for our camera at z=6)
  const largest = Math.max(size.x, size.y, size.z) || 1;
  const desiredDiameter = 6; // adjust to taste
  const s = desiredDiameter / largest;
  root.scale.setScalar(s);

  // Orient so the thinnest axis points toward +Z (i.e. coin lies flat in XY)
  const dims = [size.x, size.y, size.z];
  const minIndex = dims.indexOf(Math.min(...dims));
  // 0:x thin -> rotate Y by +90° so X (thin) becomes Z (toward camera)
  // 1:y thin -> rotate X by +90° so Y (thin) becomes Z
  // 2:z thin -> already thin along Z, do nothing
  if (minIndex === 0) root.rotation.y += Math.PI / 2;
  else if (minIndex === 1) root.rotation.x += Math.PI / 2;

  // Start with TAILS up: flip 180° around X so the opposite face is toward camera.
  // (If your model already shows tails up by default, comment the line below.)
  root.rotation.x += Math.PI;
}

// ---------- load GLB or show placeholder ----------
const loader = new GLTFLoader();
loader.load(
  './coin.glb',
  (gltf) => {
    const root = gltf.scene;
    // Make sure meshes can look metallic
    root.traverse((o) => {
      if (o.isMesh) {
        if (!o.material || !o.material.isMeshStandardMaterial) {
          o.material = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.85, roughness: 0.35 });
        } else {
          // ensure sensible defaults if missing
          if (o.material.metalness === undefined) o.material.metalness = 0.85;
          if (o.material.roughness === undefined) o.material.roughness = 0.35;
        }
      }
    });

    normalizeCenterAndOrientFlat(root);
    coin.add(root);
    ready = true;
  },
  undefined,
  () => {
    // Fallback: big cylinder that looks like a coin, already tails-up
    const placeholder = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 0.3, 96),
      new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.3 })
    );
    placeholder.rotation.x = Math.PI; // tails up
    coin.add(placeholder);
    ready = true;
  }
);

// ---------- flip physics (3D wobble, then settle FLAT) ----------
let ready = false;
let flipping = false;
let vx = 0, vy = 0, vz = 0;          // angular velocities around X/Y/Z
const damping = 0.985;
const settleThreshold = 0.02;
let settling = false;
let targetX = 0, targetY = 0;        // targets to snap flat
const resultEl = document.getElementById('result');
const initialIsTails = true;         // we start with tails up

function startFlip() {
  if (!ready || flipping || settling) return;

  flipping = true;
  // Strong end-over-end + a bit of wobble & spin
  vx = (Math.random() * 0.9 + 0.6) * (Math.random() < 0.5 ? -1 : 1); // tilt/wobble
  vy = (Math.random() * 1.8 + 0.9);                                  // spin
  vz = (Math.random() * 0.6 - 0.3);                                  // tiny roll wobble

  if (resultEl) resultEl.textContent = '';
}

function beginSettle() {
  flipping = false;
  settling = true;

  // Choose nearest flat orientation:
  // "Flat" means rotation.x and rotation.y are multiples of PI (0 or PI),
  // which keeps the coin's face normal aligned with +Z.
  targetX = Math.round(coin.rotation.x / Math.PI) * Math.PI;
  targetY = Math.round(coin.rotation.y / Math.PI) * Math.PI;
}

function finishSettleAndReport() {
  settling = false;

  // Count how many half-turns (PI) occurred around X and Y combined.
  const nx = Math.abs(Math.round(targetX / Math.PI)) % 2;
  const ny = Math.abs(Math.round(targetY / Math.PI)) % 2;
  const toggles = (nx + ny) % 2;

  const isTailsUp = initialIsTails ? (toggles === 0) : (toggles === 1);
  const side = isTailsUp ? 'Tails' : 'Heads';
  if (resultEl) resultEl.textContent = side;
}

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);

  if (flipping) {
    // Integrate angular velocity (scaled for frame time)
    const scale = dt * 60;
    coin.rotation.x += vx * scale;
    coin.rotation.y += vy * scale;
    coin.rotation.z += vz * scale;

    // Damping
    vx *= damping; vy *= damping; vz *= damping;

    // When motion slows, move to settle phase
    if (Math.abs(vx) < settleThreshold &&
        Math.abs(vy) < settleThreshold &&
        Math.abs(vz) < settleThreshold) {
      beginSettle();
    }
  } else if (settling) {
    // Smoothly damp X and Y to exact flat multiples of PI
    coin.rotation.x = THREE.MathUtils.damp(coin.rotation.x, targetX, 12, 0.08);
    coin.rotation.y = THREE.MathUtils.damp(coin.rotation.y, targetY, 12, 0.08);

    // Zero any residual Z spin to keep the design upright (optional)
    coin.rotation.z = THREE.MathUtils.damp(coin.rotation.z, 0, 12, 0.08);

    const dx = Math.abs(coin.rotation.x - targetX);
    const dy = Math.abs(coin.rotation.y - targetY);
    const dz = Math.abs(coin.rotation.z - 0);

    if (dx < 1e-3 && dy < 1e-3 && dz < 1e-3) {
      coin.rotation.x = targetX;
      coin.rotation.y = targetY;
      coin.rotation.z = 0;
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

