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

// Camera above looking down
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 0, 6);
camera.lookAt(0, 0, 0);
scene.add(camera);

/* ---------- lights ---------- */
// Stronger, brighter lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
scene.add(new THREE.HemisphereLight(0xffffff, 0xcccccc, 0.6));

const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(3, 5, 6);
scene.add(dir);

/* ---------- coin group ---------- */
const coin = new THREE.Group();
scene.add(coin);

let ready = false;
let baseScale = 2.5; // normal resting scale

/* ---------- load coin ---------- */
const loader = new GLTFLoader();
loader.load(
  './coin.glb',
  (gltf) => {
    const root = gltf.scene;
    root.scale.set(baseScale, baseScale, baseScale);
    root.rotation.x = Math.PI; // tails up
    root.position.set(0, 0, 0);

    root.traverse((o) => {
      if (o.isMesh) {
        if (!o.material || !o.material.isMeshStandardMaterial) {
          o.material = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.25 });
        } else {
          o.material.metalness = 0.9;
          o.material.roughness = 0.25;
        }
      }
    });

    coin.add(root);
    ready = true;
  },
  undefined,
  () => {
    // fallback placeholder
    const placeholder = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.15, 96),
      new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.25 })
    );
    placeholder.rotation.x = Math.PI;
    coin.add(placeholder);
    ready = true;
  }
);

/* ---------- flip params ---------- */
let flipping = false;
let settling = false;
let t = 0;
let duration = 1.2;
let totalTurns = 5;
let height = 1.2;
let startX = 0;
let targetX = 0;

const resultEl = document.getElementById('result');

const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function startFlip() {
  if (!ready || flipping || settling) return;

  coin.rotation.y = 0;
  coin.rotation.z = 0;
  coin.rotation.x = Math.round(coin.rotation.x / Math.PI) * Math.PI;

  totalTurns = Math.floor(4 + Math.random() * 4); // 4–7 flips
  height = 1.2 + Math.random() * 0.8;
  duration = 1.0 + Math.random() * 0.6;

  startX = coin.rotation.x;
  targetX = startX + totalTurns * Math.PI * 2;

  t = 0;
  flipping = true;
  if (resultEl) resultEl.textContent = '';
}

function finishAndReport() {
  flipping = false;
  settling = false;
  coin.position.z = 0;
  coin.scale.set(baseScale, baseScale, baseScale);

  const halfTurns = Math.round((coin.rotation.x - startX) / Math.PI);
  const isHeads = halfTurns % 2 !== 0;
  if (resultEl) resultEl.textContent = isHeads ? 'Heads' : 'Tails';
}

/* ---------- animate ---------- */
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);

  if (flipping) {
    t += dt / duration;
    if (t >= 1) {
      t = 1;
      flipping = false;
      settling = true;
    }

    const e = easeInOutCubic(t);

    // Rotate coin
    coin.rotation.x = THREE.MathUtils.lerp(startX, targetX, e);

    // Arc up/down
    coin.position.z = Math.sin(Math.PI * e) * height;

    // Scale up and back down (illusion of popping out)
    const scaleBoost = 1 + 0.4 * Math.sin(Math.PI * e); // up to +40% bigger
    coin.scale.set(baseScale * scaleBoost, baseScale * scaleBoost, baseScale * scaleBoost);
  } else if (settling) {
    const snapX = Math.round(coin.rotation.x / Math.PI) * Math.PI;
    coin.rotation.x = THREE.MathUtils.damp(coin.rotation.x, snapX, 12, 0.08);
    coin.position.z = THREE.MathUtils.damp(coin.position.z, 0, 12, 0.08);
    coin.scale.x = THREE.MathUtils.damp(coin.scale.x, baseScale, 12, 0.08);
    coin.scale.y = coin.scale.z = coin.scale.x;

    if (
      Math.abs(coin.rotation.x - snapX) < 1e-3 &&
      Math.abs(coin.position.z) < 1e-2 &&
      Math.abs(coin.scale.x - baseScale) < 1e-2
    ) {
      coin.rotation.x = snapX;
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

/* ---------- UI ---------- */
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
    if (mag > 20 && !flipping && !settling) startFlip();
  }, { passive: true });
  motionBtn.textContent = 'Motion Enabled';
  motionBtn.disabled = true;
});


