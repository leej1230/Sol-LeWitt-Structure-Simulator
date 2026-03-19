import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

// ── Scene setup ──────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0ede8);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(20, 18, 28);
camera.lookAt(6, 0, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// ── Controls ─────────────────────────────────────────────────────────
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.05;
orbitControls.target.set(6, 2, 6);

// FPS controls
const fpsControls = new PointerLockControls(camera, document.body);
let fpsEnabled = false;
const FLOOR_HALF = 60; // floor is 120x120
const CM_PER_UNIT = 25; // 1 unit cube = 9.8425 inches = 25cm
let eyeHeight = 180 / CM_PER_UNIT; // default 180cm = 7.2 units
const MOVE_SPEED = 10;

const keys = {};
document.addEventListener("keydown", (e) => { keys[e.code] = true; });
document.addEventListener("keyup", (e) => { keys[e.code] = false; });

// Mobile WASD buttons
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
const mobileWasd = document.getElementById("mobile-wasd");

mobileWasd.querySelectorAll("button").forEach((btn) => {
  const key = btn.dataset.key;
  btn.addEventListener("touchstart", (e) => { e.preventDefault(); keys[key] = true; });
  btn.addEventListener("touchend", (e) => { e.preventDefault(); keys[key] = false; });
  btn.addEventListener("touchcancel", () => { keys[key] = false; });
});

// Mobile touch-to-look (drag on canvas to rotate camera)
const euler = new THREE.Euler(0, 0, 0, "YXZ");
let touchLookId = null;
let touchLookX = 0;
let touchLookY = 0;
const TOUCH_SENSITIVITY = 0.003;

renderer.domElement.addEventListener("touchstart", (e) => {
  if (!fpsEnabled || touchLookId !== null) return;
  // Use the touch that's NOT on the WASD pad
  for (const touch of e.changedTouches) {
    if (touch.target === renderer.domElement) {
      touchLookId = touch.identifier;
      touchLookX = touch.clientX;
      touchLookY = touch.clientY;
      break;
    }
  }
}, { passive: true });

renderer.domElement.addEventListener("touchmove", (e) => {
  if (!fpsEnabled || touchLookId === null) return;
  for (const touch of e.changedTouches) {
    if (touch.identifier === touchLookId) {
      const dx = touch.clientX - touchLookX;
      const dy = touch.clientY - touchLookY;
      touchLookX = touch.clientX;
      touchLookY = touch.clientY;

      euler.setFromQuaternion(camera.quaternion);
      euler.y -= dx * TOUCH_SENSITIVITY;
      euler.x -= dy * TOUCH_SENSITIVITY;
      euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
      camera.quaternion.setFromEuler(euler);
      break;
    }
  }
}, { passive: true });

function onTouchLookEnd(e) {
  for (const touch of e.changedTouches) {
    if (touch.identifier === touchLookId) {
      touchLookId = null;
      break;
    }
  }
}
renderer.domElement.addEventListener("touchend", onTouchLookEnd, { passive: true });
renderer.domElement.addEventListener("touchcancel", onTouchLookEnd, { passive: true });

fpsControls.addEventListener("unlock", () => {
  // If user presses ESC, uncheck the toggle
  const fpsToggle = document.getElementById("fps-toggle");
  if (fpsToggle.checked) {
    fpsToggle.checked = false;
    disableFps();
  }
});

const savedOrbitState = { position: new THREE.Vector3(), target: new THREE.Vector3() };

function enableFps() {
  fpsEnabled = true;
  // Save orbit camera state
  savedOrbitState.position.copy(camera.position);
  savedOrbitState.target.copy(orbitControls.target);
  // Disable orbit
  orbitControls.enabled = false;
  // Place camera at eye height near the scene
  camera.position.set(0, eyeHeight, 10);
  camera.lookAt(0, eyeHeight, 0);
  // Show hint
  document.getElementById("fps-hint").style.display = "block";
  // Lock on next click
  const lockHandler = () => {
    if (fpsEnabled && !fpsControls.isLocked) {
      fpsControls.lock();
      document.getElementById("fps-hint").style.display = "none";
    }
  };
  renderer.domElement.addEventListener("click", lockHandler);
  fpsControls._lockHandler = lockHandler;

  // Show mobile WASD on touch devices
  if (isTouchDevice) mobileWasd.style.display = "block";
}

function disableFps() {
  fpsEnabled = false;
  if (fpsControls.isLocked) fpsControls.unlock();
  document.getElementById("fps-hint").style.display = "none";
  mobileWasd.style.display = "none";
  // Remove click handler
  if (fpsControls._lockHandler) {
    renderer.domElement.removeEventListener("click", fpsControls._lockHandler);
    fpsControls._lockHandler = null;
  }
  // Restore orbit camera
  camera.position.copy(savedOrbitState.position);
  orbitControls.target.copy(savedOrbitState.target);
  orbitControls.enabled = true;
}

function updateFps(delta) {
  if (!fpsEnabled) return;
  if (!fpsControls.isLocked && !isTouchDevice) return;

  const direction = new THREE.Vector3();
  const right = new THREE.Vector3();

  camera.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();
  right.crossVectors(direction, camera.up).normalize();

  const speed = MOVE_SPEED * delta;

  if (keys["KeyW"]) camera.position.addScaledVector(direction, speed);
  if (keys["KeyS"]) camera.position.addScaledVector(direction, -speed);
  if (keys["KeyA"]) camera.position.addScaledVector(right, -speed);
  if (keys["KeyD"]) camera.position.addScaledVector(right, speed);

  // Clamp to floor bounds (dynamic room size)
  const halfRoom = ROOM_SIZE / 2;
  const extent = currentSize * (currentSize + 1) / 2;
  const mid = (extent - 1) / 2;
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, mid - halfRoom, mid + halfRoom);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, mid - halfRoom, mid + halfRoom);
  camera.position.y = eyeHeight;
}

// ── Lighting (museum-style bright, even) ─────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
dirLight2.position.set(-10, 20, -10);
scene.add(dirLight2);

// ── Ceiling light fixture ────────────────────────────────────────────
const lightGroup = new THREE.Group();
scene.add(lightGroup);

// Fixture body (flat box on ceiling)
const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.8 });
const fixtureBase = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 2), fixtureMat);
fixtureBase.position.y = -0.075;
lightGroup.add(fixtureBase);

// Glowing panel
const panelMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xffffff,
  emissiveIntensity: 0.8,
});
const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), panelMat);
panel.rotation.x = Math.PI / 2;
panel.position.y = -0.16;
lightGroup.add(panel);

// Spot light from the fixture
const spotLight = new THREE.SpotLight(0xffffff, 30, 60, Math.PI / 4, 0.5, 1);
spotLight.position.set(0, -0.2, 0);
spotLight.target.position.set(0, -30, 0);
lightGroup.add(spotLight);
lightGroup.add(spotLight.target);

const ROOM_HEIGHT_VAL = 15;
lightGroup.position.set(6, ROOM_HEIGHT_VAL, 6);

// ── Museum room ──────────────────────────────────────────────────────
let ROOM_SIZE = 120;
const ROOM_HEIGHT = 15;
const ROOM_MARGIN = 20;
const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0xf5f2ed,
  roughness: 0.9,
  metalness: 0.0,
});

// Room meshes (created once, geometry swapped on resize)
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wallMaterial);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = ROOM_HEIGHT;
scene.add(ceiling);

const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wallMaterial);
scene.add(wallBack);

const wallFront = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wallMaterial);
wallFront.rotation.y = Math.PI;
scene.add(wallFront);

const wallLeft = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wallMaterial);
wallLeft.rotation.y = Math.PI / 2;
scene.add(wallLeft);

const wallRight = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wallMaterial);
wallRight.rotation.y = -Math.PI / 2;
scene.add(wallRight);

function computeRoomSize(maxN) {
  // Layout extent: cubes span from -0.5 to N*(N+1)/2 - 0.5 in both X and Z
  const extent = maxN * (maxN + 1) / 2;
  // Room must cover from -margin to extent + margin, centered at midpoint
  return Math.max(extent + ROOM_MARGIN * 2, 120);
}

function updateRoom(maxN) {
  const extent = maxN * (maxN + 1) / 2;
  ROOM_SIZE = computeRoomSize(maxN);
  const mid = (extent - 1) / 2; // center of cube layout

  // Floor
  floor.geometry.dispose();
  floor.geometry = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);
  floor.position.set(mid, 0, mid);
  floorMaterial.map.repeat.set(ROOM_SIZE / 15, ROOM_SIZE / 15);

  // Ceiling
  ceiling.geometry.dispose();
  ceiling.geometry = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);
  ceiling.position.set(mid, ROOM_HEIGHT, mid);

  // Walls
  const wallGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT);
  [wallBack, wallFront, wallLeft, wallRight].forEach((w) => {
    w.geometry.dispose();
    w.geometry = wallGeo;
  });

  wallBack.position.set(mid, ROOM_HEIGHT / 2, mid - ROOM_SIZE / 2);
  wallFront.position.set(mid, ROOM_HEIGHT / 2, mid + ROOM_SIZE / 2);
  wallLeft.position.set(mid - ROOM_SIZE / 2, ROOM_HEIGHT / 2, mid);
  wallRight.position.set(mid + ROOM_SIZE / 2, ROOM_HEIGHT / 2, mid);
}

// ── Wood plank floor ─────────────────────────────────────────────────

// Plank color palette: warm honey/golden oak tones
const plankColors = [
  [235, 215, 182],
  [230, 210, 175],
  [240, 220, 188],
];

function drawPlankGrain(ctx, x, y, w, h, baseColor) {
  const [r, g, b] = baseColor;

  // Fill plank base
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(x, y, w, h);

  // Grain lines running along plank length
  const grainCount = 15 + Math.floor(Math.random() * 20);
  for (let i = 0; i < grainCount; i++) {
    const gy = y + Math.random() * h;
    const darken = Math.random() > 0.5;
    const alpha = 0.06 + Math.random() * 0.12;
    ctx.strokeStyle = darken
      ? `rgba(${r * 0.8}, ${g * 0.75}, ${b * 0.65}, ${alpha})`
      : `rgba(${Math.min(r + 10, 255)}, ${Math.min(g + 8, 255)}, ${Math.min(b + 5, 255)}, ${alpha})`;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    for (let gx = x; gx <= x + w; gx += 8) {
      ctx.lineTo(gx, gy + Math.sin((gx - x) * 0.015) * (1 + Math.random() * 2));
    }
    ctx.stroke();
  }

  // Knots (occasional)
  if (Math.random() < 0.35) {
    const kx = x + w * 0.2 + Math.random() * w * 0.6;
    const ky = y + h * 0.2 + Math.random() * h * 0.6;
    const kr = 3 + Math.random() * 8;
    const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
    grad.addColorStop(0, `rgba(${r * 0.6}, ${g * 0.58}, ${b * 0.52}, 0.5)`);
    grad.addColorStop(0.4, `rgba(${r * 0.7}, ${g * 0.68}, ${b * 0.62}, 0.3)`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(kx, ky, kr, kr * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function createWoodTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Background (same as base plank tone)
  ctx.fillStyle = "rgb(235, 215, 182)";
  ctx.fillRect(0, 0, size, size);

  // Draw uniform planks in a grid with staggered rows
  const cols = 5;
  const rows = 24;
  const plankWidth = size / cols;
  const plankHeight = size / rows;
  let colorIdx = 0;

  for (let row = 0; row < rows; row++) {
    const py = row * plankHeight;
    const stagger = (row % 2) * (plankWidth / 2); // offset every other row

    for (let col = -1; col <= cols; col++) {
      const px = col * plankWidth + stagger;
      if (px + plankWidth < 0 || px > size) continue;

      const color = plankColors[Math.floor(Math.random() * plankColors.length)];

      // Shift all channels together to keep the same hue
      const shift = (Math.random() - 0.5) * 12;
      const shifted = [
        Math.max(0, Math.min(255, color[0] + shift)),
        Math.max(0, Math.min(255, color[1] + shift)),
        Math.max(0, Math.min(255, color[2] + shift)),
      ];

      drawPlankGrain(ctx, px, py, plankWidth, plankHeight, shifted);

      // Vertical joint line
      ctx.fillStyle = "rgba(140, 120, 90, 0.5)";
      ctx.fillRect(px + plankWidth - 0.5, py, 1, plankHeight);
    }

    // Horizontal gap between rows
    ctx.fillStyle = "rgba(140, 120, 90, 0.4)";
    ctx.fillRect(0, py + plankHeight - 0.5, size, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

const floorMaterial = new THREE.MeshStandardMaterial({
  map: createWoodTexture(),
  roughness: 0.7,
  metalness: 0.0,
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// ── Thick-bar cube helpers (Sol LeWitt style) ────────────────────────

const BAR_THICKNESS = 0.12;
const barMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.15,
  metalness: 0.0,
  flatShading: true,
});

// Square-profile bar geometries (shared)
const t = BAR_THICKNESS;
const barGeoX = new THREE.BoxGeometry(1, t, t);
const barGeoY = new THREE.BoxGeometry(t, 1, t);
const barGeoZ = new THREE.BoxGeometry(t, t, 1);
const cornerGeo = new THREE.BoxGeometry(t, t, t);

// ── Instanced cube building ──────────────────────────────────────────

// Collect all bar/corner world positions, then build InstancedMeshes
const cubesGroup = new THREE.Group();
scene.add(cubesGroup);

// Collect positions for a single unit cube at a world offset
function collectUnitCube(ox, oy, oz, barsX, barsY, barsZ, corners) {
  const h = 0.5;
  for (const [y, z] of [[-h, -h], [-h, h], [h, -h], [h, h]])
    barsX.push(ox, oy + y, oz + z);
  for (const [x, z] of [[-h, -h], [-h, h], [h, -h], [h, h]])
    barsY.push(ox + x, oy, oz + z);
  for (const [x, y] of [[-h, -h], [-h, h], [h, -h], [h, h]])
    barsZ.push(ox + x, oy + y, oz);
  for (const x of [-h, h])
    for (const y of [-h, h])
      for (const z of [-h, h])
        corners.push(ox + x, oy + y, oz + z);
}

// Collect all unit cubes for an NxN composite at a given world center
function collectCompositeCube(cx, cz, n, barsX, barsY, barsZ, corners) {
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        collectUnitCube(
          cx + x - (n - 1) / 2,
          y + 0.5 + BAR_THICKNESS / 2,
          cz + z - (n - 1) / 2,
          barsX, barsY, barsZ, corners
        );
      }
    }
  }
}

// Place a line of composites, collect into arrays, return face/lastCenter
function collectLine(sizes, axis, startFace, fixedVal, barsX, barsY, barsZ, corners) {
  let face = startFace;
  let lastCenter = 0;

  for (const n of sizes) {
    const center = face + n / 2;
    face = center + n / 2;

    const cx = axis === "x" ? center : fixedVal;
    const cz = axis === "z" ? center : fixedVal;
    collectCompositeCube(cx, cz, n, barsX, barsY, barsZ, corners);
    lastCenter = center;
  }

  return { face, lastCenter };
}

function buildInstancedMesh(geometry, positions) {
  const count = positions.length / 3;
  if (count === 0) return null;
  const mesh = new THREE.InstancedMesh(geometry, barMaterial, count);
  const mat = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    mat.makeTranslation(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    mesh.setMatrixAt(i, mat);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function buildSquareLoop(maxN) {
  // Clear previous
  while (cubesGroup.children.length) {
    const child = cubesGroup.children[0];
    child.dispose?.();
    cubesGroup.remove(child);
  }

  if (maxN < 1) return;

  updateRoom(maxN);

  // Collect all positions into flat arrays
  const barsX = [], barsY = [], barsZ = [], corners = [];

  const ascending = [];
  for (let i = 1; i <= maxN; i++) ascending.push(i);
  const descending = [];
  for (let i = maxN - 1; i >= 1; i--) descending.push(i);

  // 1x1 at origin
  collectCompositeCube(0, 0, 1, barsX, barsY, barsZ, corners);

  if (maxN >= 2) {
    const line1 = collectLine(ascending.slice(1), "x", 0.5, 0, barsX, barsY, barsZ, corners);
    const line2 = collectLine(ascending.slice(1), "z", 0.5, 0, barsX, barsY, barsZ, corners);

    if (descending.length > 0) {
      collectLine(descending, "z", maxN / 2, line1.lastCenter, barsX, barsY, barsZ, corners);
      collectLine(descending, "x", maxN / 2, line2.lastCenter, barsX, barsY, barsZ, corners);
    }
  }

  // Build 4 instanced meshes
  for (const [geo, positions] of [
    [barGeoX, barsX], [barGeoY, barsY], [barGeoZ, barsZ], [cornerGeo, corners]
  ]) {
    const mesh = buildInstancedMesh(geo, positions);
    if (mesh) cubesGroup.add(mesh);
  }
}

// Initial build
buildSquareLoop(5);
enableShadows();

// ── Credits ──────────────────────────────────────────────────────────
const creditBtn = document.getElementById("credit-btn");
const creditOverlay = document.getElementById("credit-overlay");
const creditClose = document.getElementById("credit-close");

creditBtn.addEventListener("click", () => creditOverlay.classList.add("open"));
creditClose.addEventListener("click", () => creditOverlay.classList.remove("open"));
creditOverlay.addEventListener("click", (e) => {
  if (e.target === creditOverlay) creditOverlay.classList.remove("open");
});

// ── Settings UI ──────────────────────────────────────────────────────
const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const sizeValue = document.getElementById("size-value");
const sizeDown = document.getElementById("size-down");
const sizeUp = document.getElementById("size-up");

let currentSize = 5;
const MIN_SIZE = 1;
const MAX_SIZE = 100;

function updateSizeButtons() {
  sizeDown.disabled = currentSize <= MIN_SIZE;
  sizeUp.disabled = currentSize >= MAX_SIZE;
}
updateSizeButtons();

settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.toggle("open");
});

sizeDown.addEventListener("click", () => {
  if (currentSize > MIN_SIZE) {
    currentSize--;
    sizeValue.textContent = currentSize;
    updateSizeButtons();
    buildSquareLoop(currentSize);
  }
});

sizeUp.addEventListener("click", () => {
  if (currentSize < MAX_SIZE) {
    currentSize++;
    sizeValue.textContent = currentSize;
    updateSizeButtons();
    buildSquareLoop(currentSize);
  }
});

const fpsToggle = document.getElementById("fps-toggle");
const hideWasdRow = document.getElementById("hide-wasd-row");
const hideWasdToggle = document.getElementById("hide-wasd-toggle");

fpsToggle.addEventListener("change", () => {
  if (fpsToggle.checked) {
    enableFps();
    if (isTouchDevice) hideWasdRow.style.display = "flex";
  } else {
    disableFps();
    hideWasdRow.style.display = "none";
    hideWasdToggle.checked = false;
  }
});

hideWasdToggle.addEventListener("change", () => {
  if (hideWasdToggle.checked) {
    mobileWasd.style.display = "none";
  } else if (fpsEnabled && isTouchDevice) {
    mobileWasd.style.display = "block";
  }
});

const heightSlider = document.getElementById("height-slider");
const heightValue = document.getElementById("height-value");
heightSlider.addEventListener("input", () => {
  heightValue.textContent = heightSlider.value;
  eyeHeight = parseInt(heightSlider.value, 10) / CM_PER_UNIT;
});

// ── Light position sliders ───────────────────────────────────────────
const lightXSlider = document.getElementById("light-x-slider");
const lightXValue = document.getElementById("light-x-value");
const lightZSlider = document.getElementById("light-z-slider");
const lightZValue = document.getElementById("light-z-value");

lightXSlider.addEventListener("input", () => {
  const val = parseFloat(lightXSlider.value);
  lightXValue.textContent = val;
  lightGroup.position.x = val;
});

lightZSlider.addEventListener("input", () => {
  const val = parseFloat(lightZSlider.value);
  lightZValue.textContent = val;
  lightGroup.position.z = val;
});

// ── Shadows toggle ───────────────────────────────────────────────────
function enableShadows() {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.camera.left = -80;
  dirLight.shadow.camera.right = 80;
  dirLight.shadow.camera.top = 80;
  dirLight.shadow.camera.bottom = -80;
  dirLight.shadow.bias = -0.001;

  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 1024;
  spotLight.shadow.mapSize.height = 1024;
  spotLight.shadow.bias = -0.002;

  floor.receiveShadow = true;
  cubesGroup.traverse((child) => {
    if (child.isInstancedMesh || child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  renderer.shadowMap.needsUpdate = true;
}

function disableShadows() {
  renderer.shadowMap.enabled = false;
  dirLight.castShadow = false;
  spotLight.castShadow = false;
  floor.receiveShadow = false;
  renderer.shadowMap.needsUpdate = true;
}

const rtToggle = document.getElementById("rt-toggle");
rtToggle.addEventListener("change", () => {
  if (rtToggle.checked) {
    enableShadows();
  } else {
    disableShadows();
  }
});

// ── Resize handling ──────────────────────────────────────────────────
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Animation loop ───────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (fpsEnabled) {
    updateFps(delta);
  } else {
    orbitControls.update();
  }

  renderer.render(scene, camera);
}
animate();
