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

// Top-down camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 0, 6);
camera.lookAt(0, 0, 0);
scene.add(camera);

/* ---------- bright, even lighting ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 1.35));
scene.add(new THREE.HemisphereLight(0xffffff, 0xeeeeee, 1.0));

const dir1 = new THREE.DirectionalLight(0xffffff, 1.6);
dir1.position.set(6, 6, 8);
scene.add(dir1);

const dir2 = new THREE.DirectionalLight(0xffffff, 1.2);
dir2.position.set(-6, -6, 8);
scene.add(dir2);

/* ---------- coin group (we rotate this during flips) ---------- */
const coin = new THREE.Group();
scene.add(coin);

const baseScale = 2.7; // resting size
let ready = false;

/* ---------- load & normalize model ---------- */
const loader = new GLTFLoader();

function shinyMaterialize(root) {
  root.traverse(o => {
    if (o.isMesh) {
      if (!o.material || !o.material.isMeshStandardMaterial) {
        o.material = new THREE.MeshStandardMaterial({
          color: 0xf2f2f2,
          metalness: 0.95,
          roughness: 0.2
        });
      } else {
        o.material.color.setHex(0xf2f2f2);
        o.material.metalness = 0.95;
        o.material.roughness = 0.2;
      }
    }
  });
}

/** Center pivot and lay faces flat:
 *  1) center by bounding box
 *  2) detect thinnest axis (X/Y/Z) and rotate so that axis becomes local Z
 *     => faces lie in XY, facing camera
 */
function centerAndOrientFlat(root) {
  // center
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  root.position.sub(center);

  // scale to a safe resting size
  const largest = Math.max(size.x, size.y, size.z) || 1;
  const uniform = (2.0 / largest) * baseScale; // keeps final visual size reasonable
  root.scale.setScalar(uniform);

  // orient faces to XY: map thinnest dimension to Z
  const dims = [size.x, size.y, size.z];
  const thin = dims.indexOf(Math.min(...dims));

  // reset rotation then rotate as needed
  root.rotation.set(0, 0, 0);

  if (thin === 0) {
    // X is thin -> rotate +Y 90° so X aligns to Z
    root.rotation.y = Math.PI / 2;
  } else if (thin === 1) {
    // Y is thin -> rotate -X 90° so Y aligns to Z
    root.rotation.x = -Math.PI / 2;
  } else {
    // Z already thin -> faces are already in XY
  }
}

loader.load(
  './coin.glb',
  gltf => {
    const root = gltf.scene;
    shinyMaterialize(root);
    centerAndOrientFlat(root);
    coin.add(root);

    // Random side on load (0 = tails, PI = heads) — rotate coin group about X
    const startHeads = Math.random() < 0.5;
    coin.rotation.set(startHeads ? Math.PI : 0, 0, 0);

    ready = true;
  },
  undefined,
  () => {
    // Fallback placeholder — already flat & centered
    const placeholder = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.15, 96),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.95, roughness: 0.2 })
    );
    // Faces lie in XY when cylinder's axis is Z by default, so no rotation needed.
    coin.add(placeholder);

    const startHeads = Math.random() < 0.5;
    coin.rotation.set(startHeads ? Math.PI : 0, 0, 0);
    ready = true;
  }
);

/* ---------- flip animation (arc + wobble in air) ---------- */
let flipping = false;
let t = 0;
let duration = 1.2;
let flips = 5;             // 4..7 full turns
let height = 1.4;          // arc toward camera (Z)
let scaleBoostMax = 0.45;  // +45% at peak
let startX = 0;
let targetX = 0;

const resultEl = document.getElementById('result');
const easeInOutCubic = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function startFlip() {
  if (!ready || flipping) return;

  // keep current side; rotate only about X from a flat pose (no sideways)
  coin.rotation.y = 0;
  coin.rotation.z = 0;

  // exact flat start (0 or PI)
  coin.rotation.x = Math.round(coin.rotation.x / Math.PI) * Math.PI;

  flips = Math.floor(4 + Math.random() * 4);  // 4..7
  height = 1.2 + Math.random() * 0.9;
  duration = 1.0 + Math.random() * 0.65;
  scaleBoostMax = 0.4 + Math.random() * 0.15;

  // random final side: add 0 or PI extra
  const extra = Math.random() < 0.5 ? 0 : Math.PI;

  startX = coin.rotation.x;
  targetX = startX + flips * Math.PI * 2 + extra;

  t = 0;
  flipping = true;
  if (resultEl) resultEl.textContent = '';
}

function finishFlip() {
  flipping = false;

  // lock final flat pose, no edge snaps
  coin.rotation.x = Math.round(targetX / Math.PI) * Math.PI;
  coin.rotation.y = 0;
  coin.rotation.z = 0;
  coin.position.z = 0;
  coin.scale.set(baseScale, baseScale, baseScale);

  const isHeads = (Math.round(coin.rotation.x / Math.PI) % 2) !== 0;
  if (resultEl) resultEl.textContent = isHeads ? 'Heads' : 'Tails';
}

/* ---------- animate ---------- */
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);

  if (flipping) {
    t += dt / duration;
    const done = t >= 1;
    const e = easeInOutCubic(Math.min(t, 1));

    // main rotation about X only (clean top-down flipping)
    coin.rotation.x = THREE.MathUtils.lerp(startX, targetX, e);

    // upward arc toward camera (Z)
    const zArc = Math.sin(Math.PI * e) * height;
    coin.position.z = zArc;

    // size pop to sell "coming out of phone"
    const scaleBoost = 1 + scaleBoostMax * Math.sin(Math.PI * e);
    coin.scale.set(baseScale * scaleBoost, baseScale * scaleBoost, baseScale * scaleBoost);

    // wobble DURING flip only — small Y/Z tilt that peaks mid-air, fades before landing
    const wobblePhase = Math.sin(Math.PI * e);     // 0→1→0
    const wobble = 0.12 * wobblePhase;             // amplitude
    const osc = Math.sin(e * Math.PI * 14);        // frequency
    coin.rotation.y = wobble * osc * 0.9;
    coin.rotation.z = wobble * osc * 0.6;

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

