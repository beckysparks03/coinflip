import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ------------------ renderer ------------------ */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ------------------ scene & camera ------------------ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// Top-down camera looking at origin
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 0, 6);
camera.lookAt(0, 0, 0);
scene.add(camera);

/* ------------------ lights ------------------ */
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const dir = new THREE.DirectionalLight(0xffffff, 0.85);
dir.position.set(3, 5, 4);
scene.add(dir);

/* ------------------ coin group ------------------ */
const coin = new THREE.Group();
coin.position.set(0, 0, 0); // centered
scene.add(coin);

function orientFlatTailsUp(root) {
  // Center & scale to a nice on-screen size
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  root.position.sub(center);

  // Make the coin fit well under a z=6 camera
  const largest = Math.max(size.x, size.y, size.z) || 1;
  const desiredDiameter = 3.0;                  // tune: starting size on screen
  const s = desiredDiameter / largest;
  root.scale.setScalar(s);

  // Find thinnest axis and make it point along +Z (toward camera)
  const dims = [size.x, size.y, size.z];
  const thin = dims.indexOf(Math.min(...dims));
  if (thin === 0) root.rotation.y += Math.PI / 2; // thin along X -> rotate Y
  else if (thin === 1) root.rotation.x += Math.PI / 2; // thin along Y -> rotate X
  // Now coin lies in XY plane. Make tails up (flip 180° around X).
  root.rotation.x += Math.PI;
}

/* ------------------ load model or placeholder ------------------ */
let ready = false;
const loader = new GLTFLoader();

loader.load(
  './coin.glb',
  (gltf) => {
    const root = gltf.scene;
    // Ensure sensible materials if non-PBR
    root.traverse(o => {
      if (o.isMesh) {
        if (!o.material || !o.material.isMeshStandardMaterial) {
          o.material = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.85, roughness: 0.35 });
        } else {
          if (o.material.metalness === undefined) o.material.metalness = 0.85;
          if (o.material.roughness === undefined) o.material.roughness = 0.35;
        }
      }
    });
    orientFlatTailsUp(root);
    coin.add(root);
    ready = true;
  },
  undefined,
  () => {
    // Fallback: simple coin
    const placeholder = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.15, 96),
      new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.35 })
    );
    // Flat, tails up:
    placeholder.rotation.x = Math.PI;
    coin.add(placeholder);
    ready = true;
  }
);

/* ------------------ flip timeline (no sideways drift) ------------------ */
// We’ll drive a param t ∈ [0,1] over a fixed duration.
// Rotation: X only (end-over-end), exactly N full turns (N = 4…7 random).
// Arc: move along Z (toward camera and back) with a single hump: z = H * sin(πt)

let flipping = false;
let settling = false;
let t = 0;                         // timeline 0..1
let duration = 1.2;                // seconds for the flip (toss time)
let totalTurns = 5;                // randomized 4..7 on each start
let height = 1.2;                  // how far toward camera it comes (Z units)
let startX = 0;                    // starting rotation.x (should be multiple of π)
let targetX = 0;                   // final snapped x

const resultEl = document.getElementById('result');
const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function startFlip() {
  if (!ready || flipping || settling) return;

  // Ensure starting state is flat, centered, no sideways skew
  coin.rotation.y = 0;
  coin.rotation.z = 0;

  // Guarantee we start exactly tails up (π multiple)
  // Snap small drift, if any:
  coin.rotation.x = Math.round(coin.rotation.x / Math.PI) * Math.PI;

  // Randomize arc + turns
  totalTurns = Math.floor(4 + Math.random() * 4); // 4..7 full turns
  height = 1.0 + Math.random() * 1.0;             // 1.0..2.0 toward camera
  duration = 1.0 + Math.random() * 0.6;           // 1.0..1.6 sec

  startX = coin.rotation.x;
  targetX = startX + totalTurns * Math.PI * 2;    // N full turns

  t = 0;
  flipping = true;
  if (resultEl) resultEl.textContent = '';
}

function finishAndReport() {
  settling = false;
  flipping = false;
  coin.position.z = 0;             // back to the "table"

  // Decide side by number of half-turns (π) applied
  const halfTurns = Math.round((coin.rotation.x - startX) / Math.PI);
  const isHeads = (halfTurns % 2 !== 0); // starting tails -> odd half-turns => heads
  if (resultEl) resultEl.textContent = isHeads ? 'Heads' : 'Tails';
}

/* ------------------ animation loop ------------------ */
const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);

  if (flipping) {
    t += dt / duration;
    if (t >= 1) {
      t = 1;
      flipping = false;
      settling = true;
    }

    // Ease progress
    const e = easeInOutCubic(t);

    // Rotation: X only (no Y/Z to prevent left-right look)
    coin.rotation.x = THREE.MathUtils.lerp(startX, targetX, e);

    // Arc up and down toward camera
    coin.position.z = Math.sin(Math.PI * e) * height;
  } else if (settling) {
    // Snap exactly flat: X to nearest π, Y/Z to 0, z to 0
    const snapX = Math.round(coin.rotation.x / Math.PI) * Math.PI;
    coin.rotation.x = THREE.MathUtils.damp(coin.rotation.x, snapX, 12, 0.08);
    coin.rotation.y = THREE.MathUtils.damp(coin.rotation.y, 0, 12, 0.08);
    coin.rotation.z = THREE.MathUtils.damp(coin.rotation.z, 0, 12, 0.08);
    coin.position.z = THREE.MathUtils.damp(coin.position.z, 0, 12, 0.08);

    const dx = Math.abs(coin.rotation.x - snapX);
    const dy = Math.abs(coin.rotation.y);
    const dz = Math.abs(coin.rotation.z);
    const dzp = Math.abs(coin.position.z);

    if (dx < 1e-3 && dy < 1e-3 && dz < 1e-3 && dzp < 1e-2) {
      coin.rotation.x = snapX;
      coin.rotation.y = 0;
      coin.rotation.z = 0;
      coin.position.z = 0;
      finishAndReport();
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

/* ------------------ resize ------------------ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------ UI & motion ------------------ */
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



