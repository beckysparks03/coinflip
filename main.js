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

// Top-down view
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 0, 6);
camera.lookAt(0, 0, 0);
scene.add(camera);

/* ---------- lighting (bright + even) ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 1.25));
scene.add(new THREE.HemisphereLight(0xffffff, 0xeeeeee, 1.0));

const dir1 = new THREE.DirectionalLight(0xffffff, 1.5);
dir1.position.set(6, 6, 8);
scene.add(dir1);

const dir2 = new THREE.DirectionalLight(0xffffff, 1.2);
dir2.position.set(-6, -6, 8);
scene.add(dir2);

const fill = new THREE.PointLight(0xffffff, 0.8, 30);
fill.position.set(0, 0, 10);
scene.add(fill);

/* ---------- coin group ---------- */
const coin = new THREE.Group();
scene.add(coin);

let ready = false;
const baseScale = 2.7;          // resting size
const baseFlatAngle = -Math.PI / 2; // flat (face up) in our top-down setup

/* ---------- load coin ---------- */
const loader = new GLTFLoader();
function applyShinyMaterial(root) {
  root.traverse(o => {
    if (o.isMesh) {
      if (!o.material || !o.material.isMeshStandardMaterial) {
        o.material = new THREE.MeshStandardMaterial({
          color: 0xf0f0f0,
          metalness: 0.95,
          roughness: 0.18
        });
      } else {
        o.material.color.setHex(0xf0f0f0);
        o.material.metalness = 0.95;
        o.material.roughness = 0.18;
      }
    }
  });
}

loader.load(
  './coin.glb',
  (gltf) => {
    const root = gltf.scene;
    applyShinyMaterial(root);
    root.scale.set(baseScale, baseScale, baseScale);
    root.position.set(0, 0, 0);

    // Lay coin flat so the face is visible (not edge-on)
    root.rotation.set(-Math.PI / 2, 0, 0);

    coin.add(root);

    // Random side on load: tails (0) or heads (PI) on top
    const startSideIsHeads = Math.random() < 0.5;
    coin.rotation.set(baseFlatAngle + (startSideIsHeads ? Math.PI : 0), 0, 0);
    ready = true;
  },
  undefined,
  () => {
    // Fallback placeholder
    const placeholder = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.15, 96),
      new THREE.MeshStandardMaterial({ color: 0xf0f0f0, metalness: 0.95, roughness: 0.18 })
    );
    placeholder.rotation.set(-Math.PI / 2, 0, 0);
    coin.add(placeholder);

    const startSideIsHeads = Math.random() < 0.5;
    coin.rotation.set(baseFlatAngle + (startSideIsHeads ? Math.PI : 0), 0, 0);
    ready = true;
  }
);

/* ---------- flip timeline with smooth settle & wobble ---------- */
// We drive t in [0..1] for the main toss, then a settle phase with damped wobble.
// Rotation only about X for clean top-down flips.
// Arc: Z(t) = H * sin(pi t), Scale(t) = base * (1 + s * sin(pi t)).

let flipping = false;
let settling = false;
let t = 0;
let duration = 1.2;
let totalFullFlips = 5;     // 4..7 target
let height = 1.4;           // arc height toward camera
let scaleBoostMax = 0.45;   // +45% at peak
let startX = baseFlatAngle;
let targetX = baseFlatAngle;
let desiredFinalSideIsHeads = true;

// Settle/wobble params
let settleTime = 0;
const wobbleDuration = 0.35;   // seconds of visible wobble
const wobbleTilt = 0.06;       // max tilt (radians) around Y/Z
const wobbleFreq = 18;         // Hz for quick wobble
const springTightness = 14;    // damping for snapping X to exact flat

const resultEl = document.getElementById('result');
const easeInOutCubic = (x) => (x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2);

function startFlip() {
  if (!ready || flipping || settling) return;

  // Start from flat (no sideways), keep whichever face is currently up
  coin.rotation.y = 0;
  coin.rotation.z = 0;
  // Snap tiny drift to nearest exact flat before we begin
  coin.rotation.x = Math.round(coin.rotation.x / Math.PI) * Math.PI + baseFlatAngle % Math.PI;

  // Choose 4..7 full flips (feel)
  totalFullFlips = Math.floor(4 + Math.random()*4); // 4..7
  height = 1.2 + Math.random()*0.9;                 // arc height
  duration = 1.0 + Math.random()*0.65;              // toss speed
  scaleBoostMax = 0.4 + Math.random()*0.15;         // +40%..+55%

  // Random final side:
  // true -> heads, false -> tails
  desiredFinalSideIsHeads = Math.random() < 0.5;

  // Current side (heads when coin.rotation.x differs from base by odd * PI)
  const currHalfTurns = Math.round((coin.rotation.x - baseFlatAngle) / Math.PI);
  const currIsHeads = (currHalfTurns % 2 !== 0);

  // Total rotation needed:
  // 2π * N full flips + optional extra π if we need to switch sides
  const extraHalf = desiredFinalSideIsHeads === currIsHeads ? 0 : Math.PI;

  startX = coin.rotation.x;
  targetX = startX + totalFullFlips * Math.PI * 2 + extraHalf;

  t = 0;
  flipping = true;
  settling = false;
  settleTime = 0;
  if (resultEl) resultEl.textContent = '';
}

function finishAndReport() {
  flipping = false;
  settling = false;
  coin.position.z = 0;
  coin.scale.set(baseScale, baseScale, baseScale);

  const finalHalfTurns = Math.round((coin.rotation.x - baseFlatAngle) / Math.PI);
  const isHeads = (finalHalfTurns % 2 !== 0);
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

    // Rotate about X only (clean top-down flip)
    coin.rotation.x = THREE.MathUtils.lerp(startX, targetX, e);

    // Arc up/down
    const zArc = Math.sin(Math.PI * e) * height;
    coin.position.z = zArc;

    // Scale pop for “coming out of phone”
    const scaleBoost = 1 + scaleBoostMax * Math.sin(Math.PI * e);
    coin.scale.set(baseScale * scaleBoost, baseScale * scaleBoost, baseScale * scaleBoost);

    if (done) {
      // Transition into smooth settle (no edge pause/snaps)
      flipping = false;
      settling = true;
      settleTime = 0;
    }
  } else if (settling) {
    settleTime += dt;

    // Smoothly converge X to nearest exact flat
    const snapX = Math.round(coin.rotation.x / Math.PI) * Math.PI;
    coin.rotation.x = THREE.MathUtils.damp(coin.rotation.x, snapX, springTightness, 0.08);

    // Wobble (small tilt around Y/Z) that decays quickly
    const wobblePhase = Math.max(0, 1 - (settleTime / wobbleDuration));
    const wobbleAmt = wobbleTilt * wobblePhase;
    const wobble = Math.sin(settleTime * wobbleFreq * Math.PI * 2) * wobbleAmt;

    coin.rotation.y = THREE.MathUtils.damp(coin.rotation.y, wobble, 10, 0.03);
    coin.rotation.z = THREE.MathUtils.damp(coin.rotation.z, -wobble * 0.6, 10, 0.03);

    // Return Z & scale to rest
    coin.position.z = THREE.MathUtils.damp(coin.position.z, 0, 12, 0.08);
    coin.scale.x = THREE.MathUtils.damp(coin.scale.x, baseScale, 12, 0.08);
    coin.scale.y = coin.scale.z = coin.scale.x;

    const atFlat =
      Math.abs(coin.rotation.x - snapX) < 1e-3 &&
      Math.abs(coin.rotation.y - 0) < 1e-2 &&
      Math.abs(coin.rotation.z - 0) < 1e-2 &&
      Math.abs(coin.position.z) < 1e-2 &&
      Math.abs(coin.scale.x - baseScale) < 1e-2 &&
      wobblePhase < 0.02;

    if (atFlat) {
      // lock exact rest pose to avoid micro-jitter
      coin.rotation.set(snapX, 0, 0);
      coin.position.z = 0;
      coin.scale.set(baseScale, baseScale, baseScale);
      finishAndReport();
    }
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
      if (mag > 20 && !flipping && !settling) startFlip();
    }, { passive: true });
    if (motionBtn) { motionBtn.textContent = 'Motion Enabled'; motionBtn.disabled = true; }
  } catch {}
});
