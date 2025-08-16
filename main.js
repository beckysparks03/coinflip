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

const dir2 = new THREE.DirectionalLight(0xffffff, 1.2);
dir2.position.set(-6, -6, 8);
scene.add(dir2);

const fill = new THREE.PointLight(0xffffff, 0.8, 30);
fill.position.set(0, 0, 10);
scene.add(fill);

/* ---------- coin ---------- */
const coin = new THREE.Group();
scene.add(coin);

let ready = false;
const baseScale = 2.7;
const baseRot = new THREE.Euler(-Math.PI / 2, 0, -Math.PI / 2); // flat XY plane

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

    // Recenter model so it's exactly at origin
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);

    root.scale.set(baseScale, baseScale, baseScale);
    root.rotation.copy(baseRot);

    coin.add(root);

    // Random heads/tails start
    const startHeads = Math.random() < 0.5;
    coin.rotation.copy(baseRot);
    if (startHeads) coin.rotation.x += Math.PI;

    ready = true;
  }
);

/* ---------- flip physics ---------- */
let flipping = false;
let t = 0;
let duration = 1.2;
let totalFlips = 5;
let height = 1.2;
let scaleBoostMax = 0.4;
let startX = 0;
let targetX = 0;
let desiredHeads = true;

const resultEl = document.getElementById('result');
const easeInOutCubic = (x) => (x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2);

function startFlip() {
  if (!ready || flipping) return;

  // Reset coin to flat base rotation
  coin.rotation.copy(baseRot);

  // Decide target side
  desiredHeads = Math.random() < 0.5;

  totalFlips = Math.floor(4 + Math.random() * 4);
  height = 1.2 + Math.random() * 0.9;
  duration = 1.0 + Math.random() * 0.65;
  scaleBoostMax = 0.4 + Math.random() * 0.15;

  startX = coin.rotation.x;
  targetX = startX + totalFlips * Math.PI * 2 + (desiredHeads ? Math.PI : 0);

  t = 0;
  flipping = true;
  if (resultEl) resultEl.textContent = '';
}

function finishFlip() {
  flipping = false;
  coin.rotation.x = targetX;
  coin.rotation.y = 0;
  coin.rotation.z = 0;
  coin.position.z = 0;
  coin.scale.set(baseScale, baseScale, baseScale);

  const isHeads = ((Math.round((targetX - baseRot.x) / Math.PI)) % 2 !== 0);
  if (resultEl) resultEl.textContent = isHeads ? 'Heads' : 'Tails';
}

/* ---------- animate ---------- */
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);

  if (flipping) {
    t += dt / duration;
    if (t >= 1) {
      finishFlip();
    } else {
      const e = easeInOutCubic(t);

      // Rotate about X
      coin.rotation.x = THREE.MathUtils.lerp(startX, targetX, e);

      // Arc upwards
      coin.position.z = Math.sin(Math.PI * e) * height;

      // Scale boost
      const scaleBoost = 1 + scaleBoostMax * Math.sin(Math.PI * e);
      coin.scale.set(baseScale * scaleBoost, baseScale * scaleBoost, baseScale * scaleBoost);

      // ✨ Add wobble DURING flip (not settle)
      const wobble = 0.1 * Math.sin(e * Math.PI * 10); // quick oscillation
      coin.rotation.y = wobble * (1 - e); // fades out near landing
      coin.rotation.z = wobble * 0.6 * (1 - e);
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
    if (mag > 20 && !flipping) startFlip();
  }, { passive: true });
  motionBtn.textContent = 'Motion Enabled';
  motionBtn.disabled = true;
});

