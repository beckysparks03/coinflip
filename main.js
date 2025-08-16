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
scene.add(new THREE.AmbientLight(0xffffff, 1.35));
scene.add(new THREE.HemisphereLight(0xffffff, 0xeeeeee, 1.0));

const dir1 = new THREE.DirectionalLight(0xffffff, 1.6);
dir1.position.set(6, 6, 8);
scene.add(dir1);

const dir2 = new THREE.DirectionalLight(0xffffff, 1.2);
dir2.position.set(-6, -6, 8);
scene.add(dir2);

/* ---------- coin ---------- */
const coin = new THREE.Group();
scene.add(coin);

const baseScale = 2.7; // desired visible diameter
let ready = false;

/* ---------- helpers ---------- */
function shinyMaterialize(root) {
  root.traverse(o => {
    if (o.isMesh) {
      o.material = new THREE.MeshStandardMaterial({
        color: 0xf2f2f2,
        metalness: 0.95,
        roughness: 0.2
      });
    }
  });
}

function normalizeModel(root) {
  // put into a wrapper so we can offset children cleanly
  const wrapper = new THREE.Group();
  wrapper.add(root);

  // compute bounding box
  const box = new THREE.Box3().setFromObject(wrapper);
  const size = new THREE.Vector3();
  box.getSize(size);

  // recentre
  const center = new THREE.Vector3();
  box.getCenter(center);
  wrapper.position.sub(center);

  // find diameter (largest XY dimension)
  const diameter = Math.max(size.x, size.y);
  const scaleFactor = baseScale / diameter;
  wrapper.scale.setScalar(scaleFactor);

  return wrapper;
}

/* ---------- load coin ---------- */
const loader = new GLTFLoader();
loader.load(
  './coin.glb',
  (gltf) => {
    shinyMaterialize(gltf.scene);
    const normalized = normalizeModel(gltf.scene);

    coin.add(normalized);

    // random initial side
    const startHeads = Math.random() < 0.5;
    coin.rotation.set(startHeads ? Math.PI : 0, 0, 0);

    ready = true;
  },
  undefined,
  () => {
    const placeholder = new THREE.Mesh(
      new THREE.CylinderGeometry(baseScale / 2, baseScale / 2, 0.15, 96),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.95, roughness: 0.2 })
    );
    coin.add(placeholder);
    const startHeads = Math.random() < 0.5;
    coin.rotation.set(startHeads ? Math.PI : 0, 0, 0);
    ready = true;
  }
);

/* ---------- flip animation ---------- */
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

  coin.rotation.y = 0;
  coin.rotation.z = 0;
  coin.rotation.x = Math.round(coin.rotation.x / Math.PI) * Math.PI;

  flips = Math.floor(4 + Math.random() * 4);
  height = 1.2 + Math.random() * 0.9;
  duration = 1.0 + Math.random() * 0.65;
  scaleBoostMax = 0.4 + Math.random() * 0.15;

  const extra = Math.random() < 0.5 ? 0 : Math.PI;

  startX = coin.rotation.x;
  targetX = startX + flips * Math.PI * 2 + extra;

  t = 0;
  flipping = true;
  if (resultEl) resultEl.textContent = '';
}

function finishFlip() {
  flipping = false;
  coin.rotation.x = Math.round(targetX / Math.PI) * Math.PI;
  coin.rotation.y = 0;
  coin.rotation.z = 0;
  coin.position.z = 0;
  coin.scale.set(1, 1, 1); // normalized already

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

    coin.rotation.x = THREE.MathUtils.lerp(startX, targetX, e);
    coin.position.z = Math.sin(Math.PI * e) * height;

    const scaleBoost = 1 + scaleBoostMax * Math.sin(Math.PI * e);
    coin.scale.set(scaleBoost, scaleBoost, scaleBoost);

    const wobble = 0.12 * Math.sin(Math.PI * e);
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
  motionBtn.textContent = 'Motion Enabled';
  motionBtn.disabled = true;
});


