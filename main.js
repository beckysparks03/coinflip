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

// Camera directly above coin
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 0, 6); // above
camera.lookAt(0, 0, 0);
scene.add(camera);

/* ---------- lighting ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
scene.add(new THREE.HemisphereLight(0xffffff, 0xdddddd, 1.0));

const dir1 = new THREE.DirectionalLight(0xffffff, 1.2);
dir1.position.set(5, 5, 6);
scene.add(dir1);

const dir2 = new THREE.DirectionalLight(0xffffff, 1.0);
dir2.position.set(-5, -5, 6);
scene.add(dir2);

const point = new THREE.PointLight(0xffffff, 0.6, 20);
point.position.set(0, 0, 8);
scene.add(point);

/* ---------- coin ---------- */
const coin = new THREE.Group();
scene.add(coin);

let ready = false;
let baseScale = 2.5;

/* ---------- load coin ---------- */
const loader = new GLTFLoader();
loader.load(
  './coin.glb',
  (gltf) => {
    const root = gltf.scene;
    root.scale.set(baseScale, baseScale, baseScale);

    // ✅ Lay the coin flat (XY plane), tails up
    root.rotation.set(-Math.PI / 2, 0, 0);  

    root.position.set(0, 0, 0);

    // Ensure shiny material if needed
    root.traverse((o) => {
      if (o.isMesh) {
        if (!o.material || !o.material.isMeshStandardMaterial) {
          o.material = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.9, roughness: 0.2 });
        } else {
          o.material.metalness = 0.9;
          o.material.roughness = 0.2;
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
      new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.9, roughness: 0.2 })
    );
    placeholder.rotation.set(-Math.PI / 2, 0, 0); // flat
    coin.add(placeholder);
    ready = true;
  }
);

/* ---------- flip physics ---------- */
let flipping = false;
let settling = false;
let t = 0;
let duration = 1.2;
let totalTurns = 5;
let height = 1.2;
let startRot = 0;
let targetRot = 0;

const resultEl = document.getElementById('result');
const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function startFlip() {
  if (!ready || flipping || settling) return;

  // Reset orientation flat, tails up
  coin.rotation.set(-Math.PI / 2, 0, 0);

  totalTurns = Math.floor(4 + Math.random() * 4); // 4–7 flips
  height = 1.2 + Math.random() * 0.8;
  duration = 1.0 + Math.random() * 0.6;

  startRot = coin.rotation.x;
  targetRot = startRot + totalTurns * Math.PI * 2;

  t = 0;
  flipping = true;
  if (resultEl) resultEl.textContent = '';
}

function finishAndReport() {
  flipping = false;
  settling = false;
  coin.position.z = 0;
  coin.scale.set(baseScale, baseScale, baseScale);

  const halfTurns = Math.round((coin.rotation.x - startRot) / Math.PI);
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

    // Rotate coin around X
    coin.rotation.x = THREE.MathUtils.lerp(startRot, targetRot, e);

    // Arc upwards
    coin.position.z = Math.sin(Math.PI * e) * height;

    // Scale boost for illusion
    const scaleBoost = 1 + 0.4 * Math.sin(Math.PI * e);
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


