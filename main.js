import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ---------- scene & camera ---------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 0, 6);
camera.lookAt(0, 0, 0);
scene.add(camera);

/* ---------- lighting ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 1.3));
scene.add(new THREE.HemisphereLight(0xffffff, 0xeeeeee, 1.0));

const dir1 = new THREE.DirectionalLight(0xffffff, 1.5);
dir1.position.set(6, 6, 8);
scene.add(dir1);

const dir2 = new THREE.DirectionalLight(0xffffff, 1.1);
dir2.position.set(-6, -6, 8);
scene.add(dir2);

/* ---------- coin group ---------- */
const coin = new THREE.Group(); // we animate this group
scene.add(coin);

const baseScale = 1.5; // visible diameter (tweak smaller/bigger)
let ready = false;

/* ---------- helpers ---------- */

// 1) Wrap, center, and scale so the coin's diameter = baseScale
function normalizeModel(root) {
  const wrapper = new THREE.Group();
  wrapper.add(root);

  // initial center (before any rotation)
  const box = new THREE.Box3().setFromObject(wrapper);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  wrapper.position.sub(center);

  // scale so largest of X/Y equals baseScale (good for faces lying in XY)
  const diameter = Math.max(size.x, size.y) || 1;
  const scaleFactor = baseScale / diameter;
  wrapper.scale.setScalar(scaleFactor);

  return wrapper;
}

// 2) Lay the coin flat: rotate so the thinnest dimension aligns with Z
function orientFlatXY(wrapper) {
  // measure on the current (scaled, centered) wrapper
  const box = new THREE.Box3().setFromObject(wrapper);
  const size = new THREE.Vector3(); box.getSize(size);

  // find thinnest axis
  const dims = [size.x, size.y, size.z];
  const thin = dims.indexOf(Math.min(...dims));

  // reset rotation, then rotate to map thin -> Z
  wrapper.rotation.set(0, 0, 0);

  // If X is thinnest, rotate +90° about Y so X maps to Z.
  // If Y is thinnest, rotate -90° about X so Y maps to Z.
  // If Z is already thinnest, do nothing.
  if (thin === 0) {
    wrapper.rotation.y = Math.PI / 2;
  } else if (thin === 1) {
    wrapper.rotation.x = -Math.PI / 2;
  }

  // recenter again AFTER rotation (rotation changes the bbox)
  const box2 = new THREE.Box3().setFromObject(wrapper);
  const center2 = new THREE.Vector3(); box2.getCenter(center2);
  wrapper.position.sub(center2);
}

/* ---------- load coin (keeps your materials) ---------- */
const loader = new GLTFLoader();
loader.load(
  './coin.glb',
  (gltf) => {
    const normalized = normalizeModel(gltf.scene);
    orientFlatXY(normalized);        // ⬅️ ensures coin lies flat (face up/down)

    coin.add(normalized);

    // Random side up at rest: 0 = tails, PI = heads (about X)
    const startHeads = Math.random() < 0.5;
    coin.rotation.set(startHeads ? Math.PI : 0, 0, 0);

    ready = true;
  },
  undefined,
  (err) => {
    console.error('Failed to load GLB:', err);
    // fallback disk so you still see something
    const placeholder = new THREE.Mesh(
      new THREE.CylinderGeometry(baseScale / 2, baseScale / 2, 0.12, 96),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.3 })
    );
    // cylinder’s axis is Z by default; faces already in XY
    coin.add(placeholder);

    const startHeads = Math.random() < 0.5;
    coin.rotation.set(startHeads ? Math.PI : 0, 0, 0);
    ready = true;
  }
);

/* ---------- flip animation (end-over-end toward camera) ---------- */
let flipping = false;
let t = 0;
let duration = 1.2;
let flips = 5;
let height = 1.4;
let scaleBoostMax = 0.45;
let startX = 0;
let targetX = 0;

const resultEl = document.getElementById('result');
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function startFlip() {
  if (!ready || flipping) return;

  // start perfectly flat, no sideways lean
  coin.rotation.y = 0;
  coin.rotation.z = 0;
  coin.rotation.x = Math.round(coin.rotation.x / Math.PI) * Math.PI;

  flips = Math.floor(4 + Math.random() * 4);   // 4–7 flips
  height = 1.2 + Math.random() * 0.9;          // arc toward camera
  duration = 1.0 + Math.random() * 0.65;
  scaleBoostMax = 0.4 + Math.random() * 0.15;

  // random final side: add 0 or PI half-turn
  const extra = Math.random() < 0.5 ? 0 : Math.PI;

  startX = coin.rotation.x;
  targetX = startX + flips * Math.PI * 2 + extra;

  t = 0;
  flipping = true;
  if (resultEl) resultEl.textContent = '';
}

function finishFlip() {
  flipping = false;

  // lock to exact flat (multiple of PI about X)
  coin.rotation.x = Math.round(targetX / Math.PI) * Math.PI;
  coin.rotation.y = 0;
  coin.rotation.z = 0;
  coin.position.z = 0;
  coin.scale.set(1, 1, 1);

  const isHeads = (Math.round(coin.rotation.x / Math.PI) % 2) !== 0;
  if (resultEl) resultEl.textContent = isHeads ? 'Heads' : 'Tails';
}

/* ---------- animate ---------- */
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);

  if (flipping) {
    t += dt / duration;
    const e = easeInOutCubic(Math.min(t, 1));
    const done = t >= 1;

    // flip end-over-end (X axis)
    coin.rotation.x = THREE.MathUtils.lerp(startX, targetX, e);

    // rise/fall toward camera
    coin.position.z = Math.sin(Math.PI * e) * height;

    // scale pop to sell “coming out of phone”
    const scaleBoost = 1 + scaleBoostMax * Math.sin(Math.PI * e);
    coin.scale.set(scaleBoost, scaleBoost, scaleBoost);

    // gentle wobble while in air (fades before landing)
    const wobblePhase = Math.sin(Math.PI * e);   // 0→1→0
    const wobble = 0.12 * wobblePhase;
    const osc = Math.sin(e * Math.PI * 14);
    coin.rotation.y = wobble * osc * (1 - e);
    coin.rotation.z = wobble * 0.6 * osc * (1 - e);

    if (done) finishFlip();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

/* ---------- resize ---------- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- UI & motion ---------- */
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
      if (mag > 20 && !flipping) startFlip();
    }, { passive: true });
    if (motionBtn) { motionBtn.textContent = 'Motion Enabled'; motionBtn.disabled = true; }
  } catch {}
});


