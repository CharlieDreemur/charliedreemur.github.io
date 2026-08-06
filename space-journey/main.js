import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js";

const canvas = document.querySelector("#space-canvas");
const experience = document.querySelector("#experience");
const flightUi = document.querySelector(".flight-ui");
const loader = document.querySelector("#loader");
const loaderBar = document.querySelector("#loader-bar");
const loaderLabel = document.querySelector("#loader-label");
const replayButton = document.querySelector("#replay-button");
const soundToggle = document.querySelector("#sound-toggle");
const fullscreenToggle = document.querySelector("#fullscreen-toggle");
const fullscreenLabel = document.querySelector("#fullscreen-label");
const loaderFullscreen = document.querySelector("#loader-fullscreen");
const qualityToggle = document.querySelector("#quality-toggle");
const qualityLabel = document.querySelector("#quality-label");
const hud = document.querySelector("#hud");
const velocityLabel = document.querySelector("#velocity");
const distanceLabel = document.querySelector("#distance");
const etaLabel = document.querySelector("#eta");
const waypointLabel = document.querySelector("#waypoint");
const statusLabel = document.querySelector("#status");
const navTarget = document.querySelector(".nav-target");
const gauge = document.querySelector(".gauge");
const gunsight = document.querySelector(".gunsight");
const headingStrip = document.querySelector("#heading-strip");
const ladder = document.querySelector("#ladder");
const rollNeedle = document.querySelector("#roll-needle");
const tapeMarks = document.querySelector("#tape-marks");
const tapeShip = document.querySelector("#tape-ship");
const progressBar = document.querySelector("#progress-bar");
const targetCard = document.querySelector("#target");
const targetName = document.querySelector("#target-name");
const targetKind = document.querySelector("#target-kind");
const targetStat = document.querySelector("#target-stat");
const targetNote = document.querySelector("#target-note");
const systemBars = ["thrust", "reactor", "hull"].map((key) => ({
  key,
  alarms: key === "hull",
  shown: NaN,
  row: document.querySelector(`.bars li[data-key="${key}"]`),
  fill: document.querySelector(`#bar-${key}`),
  value: document.querySelector(`#val-${key}`),
}));

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobileDevice = window.matchMedia(
  "(pointer: coarse) and (max-width: 900px), (pointer: coarse) and (max-height: 900px)",
).matches;
const compactDevice = mobileDevice;
const flightDuration = reducedMotion ? 20 : 60;
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const constrainedDevice =
  compactDevice ||
  connection?.saveData ||
  (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

const qualityProfiles = {
  high: {
    dpr: 1.75,
    stars: [4800, 1800, 850],
    sphere: [96, 64],
    atmosphere: [64, 44],
    texture: 768,
    textureTier: 2048,
    octaves: 5,
    // Heavy HDR and grading work runs at half the pixel area, then an
    // edge-adaptive full-resolution pass reconstructs the final image.
    postScale: 0.67,
    bloomScale: 0.25,
    bloom: 0.9,
    streak: 0.42,
    aberration: 0.0016,
    grain: 0.022,
    dust: 900,
    asteroids: 260,
    clouds: true,
    shaftSamples: 32,
    shafts: 0.85,
  },
  balanced: {
    dpr: 1.3,
    stars: [3000, 1100, 420],
    sphere: [64, 44],
    atmosphere: [44, 30],
    texture: 512,
    textureTier: 1024,
    octaves: 4,
    postScale: 0.85,
    bloomScale: 0.22,
    bloom: 0.6,
    streak: 0.24,
    aberration: 0.0009,
    grain: 0.013,
    dust: 420,
    asteroids: 120,
    clouds: true,
    shaftSamples: 20,
    shafts: 0.8,
  },
  eco: {
    dpr: 1,
    stars: [1700, 620, 0],
    sphere: [40, 28],
    atmosphere: [30, 22],
    texture: 320,
    textureTier: 512,
    octaves: 3,
    postScale: 0.74,
    bloomScale: 0,
    bloom: 0,
    streak: 0,
    aberration: 0,
    grain: 0,
    dust: 0,
    asteroids: 0,
    // Cloud cover is a 9 KB texture at this tier, cheap enough to keep everywhere.
    clouds: true,
    // The shafts ride on the bright pass, which this tier does not run at all.
    shaftSamples: 0,
    shafts: 0,
  },
};

// tools/build-textures.py crops the solar disc with this much margin around the
// limb, so the limb sits inside the sprite rather than on its edge. Anything
// aligning to the limb in world units has to divide it back out.
const DISC_CROP_MARGIN = 1.04;
// How far the prominences reach past the limb, in solar radii.
const PROMINENCE_REACH = 1.75;

// Every point sprite in the scene — stars, galaxy, dust — is widened to at
// least this many pixels of the buffer it rasterises into, and dimmed by the
// area it gains so the frame keeps the same light. Narrower than this a sprite
// cannot drift smoothly: its coverage snaps from one pixel to the next and it
// flickers at frame rate. Measured on a dot crossing one pixel, peak brightness
// swings 54% at the ~1px these would otherwise be, 11% at 2px and 8% here.
// Raising it further keeps helping, but the sprites visibly soften first.
const SPRITE_MIN_PIXELS = 2.4;
// Floor on that dimming, so the faintest sprites widen rather than being
// extinguished. Tuned with the width above to hold total star light where it
// was before either existed.
const SPRITE_DIM_FLOOR = 0.208;

// Multiplier on how far each flyby body sits from the flight axis. The corridor
// runs down x = y = 0, so this only opens the bodies out sideways and leaves the
// pacing — which is set by their depth — untouched. Earth is the destination and
// stays on the axis regardless.
const LATERAL_SPREAD = 1.2;
const offAxis = (x, y, z) => [x * LATERAL_SPREAD, y * LATERAL_SPREAD, z];

// Kept well off the flight axis so every body shows a terminator instead of flat front lighting.
const sunDirection = new THREE.Vector3(-0.78, 0.36, 0.36).normalize();
const sunUniform = { value: sunDirection };
const frameUniforms = {
  time: { value: 0 },
};
const viewportUniforms = {
  pixelRatio: { value: 1 },
};

let renderer;
let scene;
let camera;
let clock;
let postScene;
let postCamera;
let postQuad;
let sceneTarget;
let bloomTargetA;
let bloomTargetB;
let streakTargetA;
let streakTargetB;
let shaftTarget;
let brightMaterial;
let blurMaterial;
let streakMaterial;
let shaftMaterial;
let compositeMaterial;
let gradedTarget;
let upscaleMaterial;
let gpuBenchmark;
// Where the light shafts converge. Set when the sun is placed.
let sunWorldPosition = null;
let starLayers = [];
let starMaterials = [];
let starLayerSequence = 0;
let celestialBodies = [];
let occluders = [];
let nebulaSprites = [];
let nebulaDim = 1;
let galaxy;
let galaxyMaterial;
let asteroidField;
let dustField;
let warpLines;
let sharedSurfaceGeometry;
let sharedShellGeometry;
let flightStartedAt = 0;
let flightProgress = 0;
let handoffStartedAt = 0;
let lensZoom = 1;
let state = "idle";
let frameId;
let pointerX = 0;
let pointerY = 0;
let viewYaw = 0;
let viewPitch = 0;
let yawVelocity = 0;
let pitchVelocity = 0;
let isCameraDragging = false;
let cameraPointerId = null;
let cameraPointerType = "mouse";
let dragLastX = 0;
let dragLastY = 0;
let dragDistance = 0;
let lastTouchTapAt = 0;
let audio;
let noiseBuffer = null;
let launchCueArmed = false;
let plasmaRoar = 0;
// Restored on replay, since the touchdown mix pulls both of these to silence.
// The score sits lower than the old ambient bed did because it is a far hotter
// master: 0.10 RMS against the previous 0.06, so matching the old fader would
// have put it 1.7x over the drive and the cues.
const MUSIC_LEVEL = 0.55;
const ENGINE_LEVEL = 0.045;
// The score drifts up out of the drive rather than being present from the first
// frame. It rides the music fader alone: the master carries the ignition cue in
// the same instant, and slowing that would blunt the one sound that needs an
// attack. Eight seconds because the excerpt opens busy enough that a shorter ramp
// disappears into the music's own dynamics — at 5.5 s it measured as noise.
const MUSIC_FADE_IN = 8;
let qualityMode = "auto";
let qualityLevel = connection?.saveData ? "eco" : constrainedDevice ? "balanced" : "high";

// ?quality=high|balanced|eco pins the tier, which is handy for capturing reference frames.
const queryParameters = new URLSearchParams(window.location.search);
const requestedQuality = queryParameters.get("quality");
if (requestedQuality && qualityProfiles[requestedQuality]) {
  qualityMode = requestedQuality;
  qualityLevel = requestedQuality;
}
const benchmarkMode = queryParameters.get("benchmark") === "1";
const nativeRendering = queryParameters.get("native") === "1";
const benchmarkFreeze = benchmarkMode && queryParameters.get("freeze") === "1";
const benchmarkSeek = THREE.MathUtils.clamp(
  Number.parseFloat(queryParameters.get("seek") || "0"),
  0,
  0.99,
);
let currentWaypointIndex = -1;
let lastHudUpdate = 0;
let performanceWindowStart = performance.now();
let performanceFrames = 0;
let slowWindows = 0;
let fastWindows = 0;
let adaptivePixelScale = 1;
let resizeFrame = 0;
let viewportSettleTimer = 0;
let viewportObserver = null;
let journeyVisualState = "";
let hullAlarm = false;
let frameVisuallyBlank = false;
const drawingBufferSize = new THREE.Vector2();
const sphereGeometryCache = new Map();
const stellarTextureCache = new Map();
const stellarMaterialCache = new Map();
const flightOcclusionSamples = [];

const waypoints = [
  // Status lines stay under about 27 characters: the readout is right-aligned to
  // the gutter, and on a 430 px screen anything longer eats it.
  { at: 0, name: "MILKY WAY HALO", status: "DEPARTING THE GALACTIC RIM" },
  { at: 0.14, name: "PERSEUS ARM", status: "CROSSING THE GALACTIC ARM" },
  { at: 0.32, name: "CELESTIAL GARDEN", status: "PLANETARY SYSTEM DETECTED" },
  { at: 0.52, name: "STELLAR NURSERY", status: "NEW STARS IGNITING NEARBY" },
  { at: 0.7, name: "SOL SYSTEM", status: "SOLAR BEACON LOCKED" },
  { at: 0.86, name: "LUNAR ORBIT", status: "ENTERING CIS-LUNAR SPACE" },
  { at: 0.95, name: "EARTH APPROACH", status: "ATMOSPHERIC ENTRY ARMED" },
  { at: 0.975, name: "RE-ENTRY", status: "HEAT SHIELD OVERLOAD" },
];

// The voyage opens this far behind the planetary corridor and spends the run-in
// over the first quarter of the flight. The distance is what buys the empty sky
// at the start: fog is exponential in range, so from back here Earth sits at
// about 97% extinction and the nearest giant at 77%, which turns them into a
// point and a dim disc without touching the layout that the rest of the trip is
// composed around. Stars are unfogged, so the field itself stays bright.
const approachDistance = 612;
const journeyStartZ = 8 + approachDistance;
const journeyEndZ = -1004;

const cameraLimits = {
  yaw: 0.95,
  pitch: 0.6,
};

// Attitude instruments read in degrees; these convert a look direction into the
// pixel travel of the heading tape and the pitch ladder.
const HEADING_PX_PER_DEG = 5;
const LADDER_PX_PER_DEG = 3.4;
const BASE_HEADING = 180;
const DEG = 180 / Math.PI;

// Cached so the per-frame attitude pass only writes transforms it has changed.
const attitude = { heading: NaN, pitch: NaN, roll: NaN, px: NaN, py: NaN };

// A body's own angular radius is under half a degree for most of the flight, so
// the crosshair gets a floor to aim into. Once locked, a target keeps the lock
// slightly past its own cone, otherwise the card flickers on the limb.
const LOCK_FLOOR = 0.042;
const LOCK_RELEASE = 1.45;
// A body only introduces itself once it is close enough to read as a world, at
// twelve of its own radii. The floor is what keeps that reachable for the small
// ones: look range stops 36 degrees off the nose, and Mars and the moon swing
// abeam of the ship well before they are twelve radii away, so on the radii
// alone their cards would open onto a bearing the pilot cannot turn to.
const LOCK_REACH = 12;
const LOCK_REACH_FLOOR = 700;
const targets = [];
const aimDirection = new THREE.Vector3();
const aimOffset = new THREE.Vector3();
let lockedTarget = null;

function registerTarget(info, position, radius) {
  targets.push({
    ...info,
    center: new THREE.Vector3(...position),
    radius,
    reach: Math.max(radius * LOCK_REACH, LOCK_REACH_FLOOR),
  });
}

function updateTargeting() {
  if (state !== "flying" || !targets.length) return;
  // Rendering has already updated matrixWorld for this exact frame. Reading its
  // forward axis avoids getWorldDirection updating the camera and its ancestors
  // a second time.
  const cameraMatrix = camera.matrixWorld.elements;
  aimDirection.set(-cameraMatrix[8], -cameraMatrix[9], -cameraMatrix[10]).normalize();

  let best = null;
  let bestRangeSq = Infinity;
  for (const target of targets) {
    aimOffset.subVectors(target.center, camera.position);
    const rangeSq = aimOffset.lengthSq();
    if (rangeSq < 1 || rangeSq > target.reach * target.reach || rangeSq >= bestRangeSq) continue;
    const range = Math.sqrt(rangeSq);
    const offset = Math.acos(
      THREE.MathUtils.clamp(aimOffset.dot(aimDirection) / range, -1, 1),
    );
    const cone = Math.max(Math.asin(Math.min(target.radius / range, 1)), LOCK_FLOOR);
    if (offset > (target === lockedTarget ? cone * LOCK_RELEASE : cone)) continue;
    best = target;
    bestRangeSq = rangeSq;
  }

  if (best === lockedTarget) return;
  lockedTarget = best;
  experience.classList.toggle("is-locked", Boolean(best));
  if (!best) return;
  targetName.textContent = best.name;
  targetKind.textContent = best.kind;
  targetStat.textContent = best.stat;
  targetNote.textContent = best.note;
  targetCard.classList.remove("is-acquiring");
  void targetCard.offsetWidth;
  targetCard.classList.add("is-acquiring");
}

function clearLock() {
  lockedTarget = null;
  experience.classList.remove("is-locked");
  targetCard.classList.remove("is-acquiring");
}

function buildInstruments() {
  const headings = document.createDocumentFragment();
  for (let deg = 0; deg < 360; deg += 10) {
    const tick = document.createElement("span");
    const major = deg % 30 === 0;
    tick.className = major ? "heading__tick" : "heading__tick heading__tick--minor";
    tick.style.left = `${deg * HEADING_PX_PER_DEG}px`;
    if (major) tick.textContent = String(deg).padStart(3, "0");
    headings.append(tick);
  }
  headingStrip.append(headings);

  const rungs = document.createDocumentFragment();
  for (let deg = -20; deg <= 20; deg += 10) {
    const line = document.createElement("div");
    line.className = deg === 0 ? "ladder__line ladder__line--zero" : "ladder__line";
    line.style.top = `${-deg * LADDER_PX_PER_DEG}px`;
    const label = deg === 0 ? "" : String(Math.abs(deg));
    line.innerHTML = `<span>${label}</span><span>${label}</span>`;
    rungs.append(line);
  }
  ladder.append(rungs);

  const marks = document.createDocumentFragment();
  waypoints.forEach((point, index) => {
    const mark = document.createElement("span");
    mark.className = "tape__mark";
    mark.style.left = `${point.at * 100}%`;
    mark.innerHTML = `<b></b>`;
    mark.firstChild.textContent = point.name;
    mark.dataset.index = String(index);
    marks.append(mark);
  });
  tapeMarks.append(marks);
}

// Yaw and pitch already drive the camera; feeding them to the glass as well is
// what makes the projection feel attached to the ship instead of the page.
function updateAttitude() {
  const yawDeg = viewYaw * DEG;
  const pitchDeg = viewPitch * DEG;
  const heading = (BASE_HEADING - yawDeg + 360) % 360;
  // The hull banks into the turn, so the roll needle answers a drag the way an
  // aircraft would rather than sitting dead while the horizon swings.
  const roll = THREE.MathUtils.clamp(-yawDeg * 0.42 + camera.rotation.z * DEG * 6, -24, 24);

  if (Math.abs(heading - attitude.heading) > 0.02) {
    attitude.heading = heading;
    headingStrip.style.transform = `translateX(${-heading * HEADING_PX_PER_DEG}px)`;
  }
  if (Math.abs(pitchDeg - attitude.pitch) > 0.02) {
    attitude.pitch = pitchDeg;
    ladder.style.transform = `translateY(${pitchDeg * LADDER_PX_PER_DEG}px)`;
  }
  if (Math.abs(roll - attitude.roll) > 0.02) {
    attitude.roll = roll;
    rollNeedle.style.transform = `translateX(-50%) rotate(${roll}deg)`;
  }

  const px = THREE.MathUtils.clamp(yawDeg / 36, -1, 1);
  const py = THREE.MathUtils.clamp(pitchDeg / 22, -1, 1);
  if (Math.abs(px - attitude.px) > 0.002) {
    attitude.px = px;
    hud.style.setProperty("--px", px.toFixed(3));
  }
  if (Math.abs(py - attitude.py) > 0.002) {
    attitude.py = py;
    hud.style.setProperty("--py", py.toFixed(3));
  }
}

function updateSystemBars(values) {
  systemBars.forEach((bar) => {
    const level = THREE.MathUtils.clamp(values[bar.key], 0, 100);
    const rounded = Math.round(level);
    if (rounded === bar.shown) return;
    bar.shown = rounded;
    bar.value.textContent = String(rounded).padStart(2, "0");
    bar.fill.style.width = `${level.toFixed(1)}%`;
    // Only the hull raises an alarm; a throttled engine is not a fault.
    if (!bar.alarms) return;
    bar.row.classList.toggle("is-warn", level < 92 && level >= 72);
    bar.row.classList.toggle("is-critical", level < 72);
  });
}

function setLoading(percent, label) {
  loaderBar.style.width = `${percent}%`;
  if (label) loaderLabel.textContent = label;
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function updateFullscreenUi() {
  const active = Boolean(getFullscreenElement());
  document.documentElement.classList.toggle("is-mobile-fullscreen", mobileDevice && active);
  updateMobileUiFrame();
  fullscreenToggle.setAttribute("aria-pressed", String(active));
  fullscreenToggle.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
  fullscreenLabel.textContent = active ? "WINDOWED" : "FULLSCREEN";
}

let orientationLockFailed = false;

function updateMobileUiFrame() {
  if (!mobileDevice || !getFullscreenElement()) {
    flightUi.style.removeProperty("width");
    flightUi.style.removeProperty("height");
    flightUi.style.removeProperty("--flight-ui-scale");
    return;
  }

  // Treat the HUD as one 1080×608 design surface. Expanding the wrapper by the
  // inverse scale before shrinking it keeps every percentage anchor in place;
  // changing rem sizes independently is what made the two clusters converge.
  const width = Math.max(1, experience.clientWidth);
  const height = Math.max(1, experience.clientHeight);
  const scale = Math.min(1, width / 1080, height / 608);
  flightUi.style.width = `${width / scale}px`;
  flightUi.style.height = `${height / scale}px`;
  flightUi.style.setProperty("--flight-ui-scale", String(scale));
}

function updateLandscapeFallback() {
  const portrait = window.innerHeight > window.innerWidth;
  const emulateLandscape =
    mobileDevice &&
    Boolean(getFullscreenElement()) &&
    portrait &&
    (orientationLockFailed || !screen.orientation?.lock);
  document.documentElement.classList.toggle("is-landscape-emulated", emulateLandscape);
}

async function lockMobileLandscape() {
  if (!mobileDevice || !getFullscreenElement()) {
    updateLandscapeFallback();
    return false;
  }

  if (!screen.orientation?.lock) {
    orientationLockFailed = true;
    updateLandscapeFallback();
    refreshViewportAfterModeChange();
    return false;
  }

  try {
    await screen.orientation.lock("landscape");
    orientationLockFailed = false;
    updateLandscapeFallback();
    refreshViewportAfterModeChange();
    return true;
  } catch {
    // iOS and some Android WebViews expose fullscreen without granting the
    // orientation lock. Rotate the authored 16:9 experience instead of leaving
    // it as a small letterbox in the middle of a portrait screen.
    orientationLockFailed = true;
    updateLandscapeFallback();
    refreshViewportAfterModeChange();
    return false;
  }
}

function requestImmersiveMode() {
  if (getFullscreenElement()) {
    lockMobileLandscape();
    return;
  }

  // Fullscreen the document root rather than #experience itself. Some mobile
  // browsers keep fixed descendants of an element-fullscreen container tied to
  // the pre-fullscreen containing block, stretching the canvas after rotation.
  const fullscreenTarget = document.documentElement;
  let request;
  try {
    request = fullscreenTarget.requestFullscreen
      ? fullscreenTarget.requestFullscreen({ navigationUI: "hide" })
      : fullscreenTarget.webkitRequestFullscreen?.();
  } catch {
    return;
  }
  Promise.resolve(request).then(lockMobileLandscape).catch(() => {
    // A denied fullscreen request must never prevent the journey from starting.
  });
}

function exitImmersiveMode() {
  try {
    const exit = document.exitFullscreen
      ? document.exitFullscreen()
      : document.webkitExitFullscreen?.();
    Promise.resolve(exit).catch(() => {});
  } catch {
    // The browser may already be leaving fullscreen via its own controls.
  }
}

function toggleFullscreen() {
  if (getFullscreenElement()) exitImmersiveMode();
  else requestImmersiveMode();
}

function initFullscreenControls() {
  fullscreenToggle.addEventListener("click", toggleFullscreen);
  loaderFullscreen.addEventListener("click", requestImmersiveMode);
  const fullscreenTarget = document.documentElement;
  const fullscreenSupported = Boolean(
    fullscreenTarget.requestFullscreen || fullscreenTarget.webkitRequestFullscreen,
  );
  if (!fullscreenSupported) {
    fullscreenToggle.hidden = true;
    loaderFullscreen.hidden = true;
  }

  const onFullscreenChange = () => {
    updateFullscreenUi();
    refreshViewportAfterModeChange();
    if (getFullscreenElement()) {
      lockMobileLandscape();
    } else {
      orientationLockFailed = false;
      updateLandscapeFallback();
      try {
        screen.orientation?.unlock?.();
      } catch {
        // Some browsers expose unlock but reject it outside installed apps.
      }
    }
  };
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  const onOrientationChange = () => {
    updateLandscapeFallback();
    refreshViewportAfterModeChange();
  };
  screen.orientation?.addEventListener?.("change", onOrientationChange);
  window.addEventListener("orientationchange", onOrientationChange);
  window.visualViewport?.addEventListener("resize", onResize);
  if ("ResizeObserver" in window) {
    viewportObserver = new ResizeObserver(onResize);
    viewportObserver.observe(experience);
  }
  updateFullscreenUi();
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function getOrCreate(cache, key, create) {
  if (!cache.has(key)) cache.set(key, create());
  return cache.get(key);
}

function getSphereGeometry(widthSegments, heightSegments) {
  const key = `${widthSegments}x${heightSegments}`;
  return getOrCreate(
    sphereGeometryCache,
    key,
    () => new THREE.SphereGeometry(1, widthSegments, heightSegments),
  );
}

function getCompositeDefines(profile) {
  const defines = {};
  if (profile.bloomScale > 0) defines.USE_BLOOM = "";
  if (profile.aberration > 0) defines.USE_ABERRATION = "";
  if (profile.grain > 0 && !usesReconstruction(profile)) defines.USE_GRAIN = "";
  if (profile.bloomScale > 0 && profile.shaftSamples > 0) defines.USE_SHAFTS = "";
  return defines;
}

function getInternalRenderScale(profile = qualityProfiles[qualityLevel]) {
  return nativeRendering ? 1 : profile.postScale;
}

function usesReconstruction(profile = qualityProfiles[qualityLevel]) {
  return getInternalRenderScale(profile) < 0.999;
}

function getUpscaleDefines() {
  // The DOM optical layer already supplies display-resolution grain. Reapplying
  // the WebGL grain after reconstruction lifts linear near-black space because
  // it no longer passes through the original composite/tone-map ordering.
  return {};
}

function updateQualityUi() {
  const label = qualityMode === "auto" ? `AUTO · ${qualityLevel.toUpperCase()}` : qualityLevel.toUpperCase();
  qualityLabel.textContent = label;
  qualityToggle.dataset.mode = qualityLevel;
  qualityToggle.setAttribute("aria-label", `Graphics quality: ${label}. Click to switch.`);
  experience.classList.toggle("quality-eco", qualityLevel === "eco");
}

function getViewportSize() {
  // Fullscreen intentionally letterboxes #experience to 16:9. Render at that
  // box's real dimensions so WebGL, the camera, and the DOM overlay share one
  // aspect ratio rather than stretching a full-screen buffer into the box.
  if (getFullscreenElement()) {
    return {
      width: Math.max(1, experience.clientWidth),
      height: Math.max(1, experience.clientHeight),
    };
  }
  return {
    width: Math.max(1, window.innerWidth || document.documentElement.clientWidth),
    height: Math.max(1, window.innerHeight || document.documentElement.clientHeight),
  };
}

function getTargetPixelRatio(profile, width, height) {
  const pixelBudgets = { high: 4600000, balanced: 2600000, eco: 1500000 };
  const budgetRatio = Math.sqrt(pixelBudgets[qualityLevel] / (width * height));
  return Math.min(
    window.devicePixelRatio,
    profile.dpr * adaptivePixelScale,
    Math.max(0.72, budgetRatio * adaptivePixelScale),
  );
}

function syncPixelRatioUniforms(pixelRatio) {
  const internalPixelRatio = pixelRatio * getInternalRenderScale();
  viewportUniforms.pixelRatio.value = internalPixelRatio;
  starMaterials.forEach((material) => {
    material.uniforms.uSize.value = material.userData.baseSize * internalPixelRatio;
  });
}

function applyViewportResolution({ force = false } = {}) {
  if (!renderer) return;
  const { width, height } = getViewportSize();
  const pixelRatio = getTargetPixelRatio(qualityProfiles[qualityLevel], width, height);
  if (!force && Math.abs(renderer.getPixelRatio() - pixelRatio) < 0.01) return;

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  syncPixelRatioUniforms(pixelRatio);
  updatePostResolution();
}

function refreshRenderResolution() {
  applyViewportResolution();
}

function applyQualityLevel(level) {
  qualityLevel = level;
  const profile = qualityProfiles[level];
  refreshRenderResolution();
  starLayers.forEach((layer) => {
    layer.visible =
      (level !== "eco" || !layer.userData.optional) &&
      layer.material.uniforms.uFade.value > 0;
  });
  nebulaDim = level === "eco" ? 0.62 : 1;
  nebulaSprites.forEach((sprite) => {
    sprite.material.opacity = sprite.userData.baseOpacity * nebulaDim;
  });
  if (dustField) {
    dustField.visible = profile.dust > 0;
  }
  if (asteroidField) asteroidField.visible = profile.asteroids > 0;

  if (compositeMaterial) {
    compositeMaterial.uniforms.uBloomStrength.value = profile.bloom;
    compositeMaterial.uniforms.uStreakStrength.value = profile.streak;
    compositeMaterial.uniforms.uAberration.value = profile.aberration;
    compositeMaterial.uniforms.uGrain.value = profile.grain;
    compositeMaterial.defines = getCompositeDefines(profile);
    compositeMaterial.needsUpdate = true;
    upscaleMaterial.uniforms.uGrain.value = profile.grain;
    upscaleMaterial.defines = getUpscaleDefines(profile);
    upscaleMaterial.needsUpdate = true;
    updatePostResolution();
  }
  updateQualityUi();
}

function cycleQuality() {
  adaptivePixelScale = 1;
  slowWindows = 0;
  fastWindows = 0;
  if (qualityMode === "auto") {
    qualityMode = "high";
    applyQualityLevel("high");
  } else if (qualityMode === "high") {
    qualityMode = "eco";
    applyQualityLevel("eco");
  } else {
    qualityMode = "auto";
    applyQualityLevel(connection?.saveData ? "eco" : constrainedDevice ? "balanced" : "high");
  }
}

function monitorPerformance(now) {
  if (qualityMode !== "auto") return;
  performanceFrames += 1;
  const windowDuration = now - performanceWindowStart;
  if (windowDuration < 2000) return;

  const fps = (performanceFrames * 1000) / windowDuration;
  if (fps < 52) {
    slowWindows += 1;
    fastWindows = 0;
  } else if (fps > 58) {
    fastWindows += 1;
    slowWindows = Math.max(0, slowWindows - 1);
  } else {
    slowWindows = Math.max(0, slowWindows - 1);
    fastWindows = 0;
  }

  // Resolution is adjusted in small steps before changing any scene content or
  // cinematic effects. This keeps the composition intact while targeting 60 fps.
  if (slowWindows >= 2 && adaptivePixelScale > 0.62) {
    adaptivePixelScale = Math.max(0.62, adaptivePixelScale - 0.1);
    refreshRenderResolution();
    slowWindows = 0;
  } else if (fastWindows >= 3 && adaptivePixelScale < 1) {
    adaptivePixelScale = Math.min(1, adaptivePixelScale + 0.05);
    refreshRenderResolution();
    fastWindows = 0;
  }

  performanceFrames = 0;
  performanceWindowStart = now;
}

function updatePostResolution() {
  if (!sceneTarget || !renderer) return;
  const profile = qualityProfiles[qualityLevel];
  renderer.getDrawingBufferSize(drawingBufferSize);

  const internalScale = getInternalRenderScale(profile);
  const reconstruct = usesReconstruction(profile);
  const sceneWidth = Math.max(1, Math.floor(drawingBufferSize.x * internalScale));
  const sceneHeight = Math.max(1, Math.floor(drawingBufferSize.y * internalScale));
  sceneTarget.setSize(sceneWidth, sceneHeight);
  gradedTarget.setSize(reconstruct ? sceneWidth : 1, reconstruct ? sceneHeight : 1);
  compositeMaterial.uniforms.uResolution.value.set(sceneWidth, sceneHeight);
  upscaleMaterial.uniforms.uSourceResolution.value.set(sceneWidth, sceneHeight);
  upscaleMaterial.uniforms.uOutputResolution.value.copy(drawingBufferSize);

  // Bloom and streaks run at a fraction of the frame, which is where the savings come from.
  const bloomScale = profile.bloomScale;
  const bloomWidth = bloomScale > 0 ? Math.max(1, Math.floor(sceneWidth * bloomScale)) : 1;
  const bloomHeight = bloomScale > 0 ? Math.max(1, Math.floor(sceneHeight * bloomScale)) : 1;
  bloomTargetA.setSize(bloomWidth, bloomHeight);
  bloomTargetB.setSize(bloomWidth, bloomHeight);
  streakTargetA.setSize(bloomWidth, Math.max(1, Math.floor(bloomHeight * 0.5)));
  streakTargetB.setSize(bloomWidth, Math.max(1, Math.floor(bloomHeight * 0.5)));
  shaftTarget.setSize(bloomWidth, bloomHeight);
}

function createPostTarget(type = THREE.HalfFloatType, depthBuffer = false) {
  return new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type,
  });
}

function renderPass(material, target) {
  postQuad.material = material;
  renderer.setRenderTarget(target);
  renderer.render(postScene, postCamera);
}

class GpuFrameBenchmark {
  constructor(webglRenderer) {
    this.gl = webglRenderer.getContext();
    this.extension =
      benchmarkMode && webglRenderer.capabilities.isWebGL2
        ? this.gl.getExtension("EXT_disjoint_timer_query_webgl2")
        : null;
    this.pending = [];
    this.samples = new Map();
    this.active = null;
    this.frames = 0;

    window.spaceJourneyBenchmark = {
      supported: Boolean(this.extension),
      native: nativeRendering,
      snapshot: () => this.snapshot(),
    };
    if (benchmarkMode && !this.extension) {
      console.warn("GPU timer queries are unavailable; benchmark results will contain CPU frame data only.");
    }
  }

  begin(label) {
    if (!this.extension || this.active || this.pending.length > 96) return;
    const query = this.gl.createQuery();
    this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, query);
    this.active = { label, query };
  }

  end() {
    if (!this.active) return;
    this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  poll() {
    if (!this.extension) return;
    const disjoint = this.gl.getParameter(this.extension.GPU_DISJOINT_EXT);
    for (let index = this.pending.length - 1; index >= 0; index -= 1) {
      const entry = this.pending[index];
      if (!this.gl.getQueryParameter(entry.query, this.gl.QUERY_RESULT_AVAILABLE)) continue;
      if (!disjoint) {
        const milliseconds = this.gl.getQueryParameter(entry.query, this.gl.QUERY_RESULT) / 1e6;
        const values = this.samples.get(entry.label) ?? [];
        values.push(milliseconds);
        if (values.length > 600) values.shift();
        this.samples.set(entry.label, values);
      }
      this.gl.deleteQuery(entry.query);
      this.pending.splice(index, 1);
    }
  }

  finishFrame() {
    if (!benchmarkMode) return;
    this.frames += 1;
    if (this.frames % 180 === 0) {
      console.info("Space Journey GPU benchmark", this.snapshot());
    }
  }

  snapshot() {
    const stages = {};
    let estimatedFrameMs = 0;
    for (const [label, values] of this.samples) {
      if (!values.length) continue;
      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      stages[label] = {
        samples: sorted.length,
        medianMs: Number(median.toFixed(3)),
        p95Ms: Number(p95.toFixed(3)),
      };
      estimatedFrameMs += median;
    }
    return {
      supported: Boolean(this.extension),
      native: nativeRendering,
      quality: qualityLevel,
      internalScale: getInternalRenderScale(),
      estimatedFrameMs: Number(estimatedFrameMs.toFixed(3)),
      stages,
    };
  }
}

function createFilmGrainTexture() {
  const size = 64;
  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = size;
  noiseCanvas.height = size;
  const context = noiseCanvas.getContext("2d");
  const image = context.createImageData(size, size);
  const random = mulberry32(9182);

  for (let index = 0; index < image.data.length; index += 4) {
    const value = Math.floor(random() * 256);
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  return createImmutableCanvasTexture(noiseCanvas, {
    colorSpace: THREE.NoColorSpace,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  });
}

const fullscreenVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

function initPostProcessing() {
  const profile = qualityProfiles[qualityLevel];
  // A half-float scene buffer keeps highlights above 1.0 so the bloom has real energy.
  const bufferType = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
  sceneTarget = createPostTarget(bufferType, true);
  sceneTarget.texture.name = "SpaceJourney.SceneHDR";
  bloomTargetA = createPostTarget(bufferType);
  bloomTargetB = createPostTarget(bufferType);
  streakTargetA = createPostTarget(bufferType);
  streakTargetB = createPostTarget(bufferType);
  shaftTarget = createPostTarget(bufferType);
  // Keep the graded source in half-float. Quantising linear shadows to 8-bit
  // before the final sRGB conversion lifts near-black space into visible grey
  // steps even though the display output itself is only 8-bit.
  gradedTarget = createPostTarget(bufferType);

  postScene = new THREE.Scene();
  postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  brightMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: sceneTarget.texture },
      uThreshold: { value: 0.85 },
      uKnee: { value: 0.55 },
    },
    vertexShader: fullscreenVertexShader,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uThreshold;
      uniform float uKnee;
      varying vec2 vUv;

      void main() {
        vec3 color = texture2D(tDiffuse, vUv).rgb;
        float brightness = max(color.r, max(color.g, color.b));
        float soft = clamp(brightness - uThreshold + uKnee, 0.0, uKnee * 2.0);
        soft = soft * soft / (4.0 * uKnee + 0.0001);
        float contribution = max(soft, brightness - uThreshold) / max(brightness, 0.0001);
        gl_FragColor = vec4(color * contribution, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  blurMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: bloomTargetA.texture },
      uDirection: { value: new THREE.Vector2(1, 0) },
      uRadius: { value: 1 },
    },
    vertexShader: fullscreenVertexShader,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 uDirection;
      uniform float uRadius;
      varying vec2 vUv;

      void main() {
        // Nine-tap gaussian, separated into two cheap passes.
        vec2 step = uDirection * uRadius;
        vec3 color = texture2D(tDiffuse, vUv).rgb * 0.227027;
        color += texture2D(tDiffuse, vUv + step * 1.3846153846).rgb * 0.3162162162;
        color += texture2D(tDiffuse, vUv - step * 1.3846153846).rgb * 0.3162162162;
        color += texture2D(tDiffuse, vUv + step * 3.2307692308).rgb * 0.0702702703;
        color += texture2D(tDiffuse, vUv - step * 3.2307692308).rgb * 0.0702702703;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  // Crepuscular rays. The bright pass already holds the star and nothing else
  // that is not a highlight, so marching each pixel back toward the star and
  // accumulating what it crosses builds the shafts directly — and anything
  // opaque in the way contributes nothing, which is what carves them. Sampling
  // the bright pass before the bloom blur keeps the rays defined instead of
  // arriving pre-smeared.
  shaftMaterial = new THREE.ShaderMaterial({
    defines: { SHAFT_SAMPLES: profile.shaftSamples || 1 },
    uniforms: {
      tDiffuse: { value: bloomTargetA.texture },
      uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
      uStrength: { value: 0 },
    },
    vertexShader: fullscreenVertexShader,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 uOrigin;
      uniform float uStrength;
      varying vec2 vUv;

      void main() {
        if (uStrength <= 0.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        // Density below one stops the march short of the star, so the rays stay
        // rays rather than converging into a second disc on top of it.
        vec2 delta = (vUv - uOrigin) * (0.72 / float(SHAFT_SAMPLES));
        vec2 coordinate = vUv;
        float weight = 1.0;
        vec3 total = vec3(0.0);
        float sum = 0.0;

        for (int index = 0; index < SHAFT_SAMPLES; index += 1) {
          coordinate -= delta;
          total += texture2D(tDiffuse, coordinate).rgb * weight;
          sum += weight;
          weight *= 0.94;
        }

        gl_FragColor = vec4(total / max(sum, 0.0001) * uStrength, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  streakMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: bloomTargetA.texture },
      uStep: { value: new THREE.Vector2(0.004, 0) },
      uAttenuation: { value: 0.88 },
    },
    vertexShader: fullscreenVertexShader,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 uStep;
      uniform float uAttenuation;
      varying vec2 vUv;

      void main() {
        // Anamorphic smear: sample outward along one axis with geometric falloff.
        // The centre used to be fetched twice by index 0. Preserve its exact
        // weight while issuing one texture lookup instead of two.
        vec3 color = texture2D(tDiffuse, vUv).rgb * 2.0;
        float weight = uAttenuation;
        float total = 2.0;
        for (int index = 1; index < 8; index += 1) {
          float offset = float(index);
          color += texture2D(tDiffuse, vUv + uStep * offset).rgb * weight;
          color += texture2D(tDiffuse, vUv - uStep * offset).rgb * weight;
          total += weight * 2.0;
          weight *= uAttenuation;
        }
        gl_FragColor = vec4(color / total, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const grainTexture = createFilmGrainTexture();
  compositeMaterial = new THREE.ShaderMaterial({
    defines: getCompositeDefines(profile),
    uniforms: {
      tDiffuse: { value: sceneTarget.texture },
      tBloom: { value: bloomTargetA.texture },
      tStreak: { value: streakTargetB.texture },
      tShaft: { value: shaftTarget.texture },
      uShaftStrength: { value: profile.shafts },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: frameUniforms.time,
      tNoise: { value: grainTexture },
      uBloomStrength: { value: profile.bloom },
      uStreakStrength: { value: profile.streak },
      uAberration: { value: profile.aberration },
      uGrain: { value: profile.grain },
      uExposure: { value: 1.05 },
      uFlight: { value: 0 },
      uEntryHeat: { value: 0 },
      uPixelate: { value: 0 },
      uFadeOut: { value: 1 },
    },
    vertexShader: fullscreenVertexShader,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D tBloom;
      uniform sampler2D tStreak;
      uniform sampler2D tShaft;
      uniform float uShaftStrength;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform sampler2D tNoise;
      uniform float uBloomStrength;
      uniform float uStreakStrength;
      uniform float uAberration;
      uniform float uGrain;
      uniform float uExposure;
      uniform float uFlight;
      uniform float uEntryHeat;
      uniform float uPixelate;
      uniform float uFadeOut;
      varying vec2 vUv;

      // Narkowicz ACES approximation, the usual filmic curve for this look.
      vec3 acesFilmic(vec3 color) {
        const float a = 2.51;
        const float b = 0.03;
        const float c = 2.43;
        const float d = 0.59;
        const float e = 0.14;
        return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
      }

      float randomNoise(vec2 coordinate) {
        vec2 offset = vec2(fract(uTime * 0.75487766), fract(uTime * 0.56984029));
        return texture2D(tNoise, fract(coordinate / 64.0 + offset)).r;
      }

      void main() {
        // Quantising the finished frame lets the photographic Earth degrade into
        // the same chunky grid as the pixel-art avatar it hands off to, so the
        // switch reads as one image resolving instead of two crossfading.
        vec2 frameUv = vUv;
        if (uPixelate > 0.0001) {
          float columns = mix(560.0, 78.0, uPixelate);
          vec2 grid = vec2(columns, max(1.0, floor(columns * uResolution.y / max(uResolution.x, 1.0))));
          frameUv = (floor(vUv * grid) + 0.5) / grid;
        }

        vec2 centered = frameUv - 0.5;
        float edgeDistance = length(centered);

        // Slight barrel distortion mimics a wide cinema prime.
        vec2 distorted = frameUv + centered * edgeDistance * edgeDistance * 0.028;
        vec3 color;
        #ifdef USE_ABERRATION
          // Keep the frame centre clean; fringing only builds up toward the corners.
          float aberrationFalloff = smoothstep(0.22, 0.72, edgeDistance);
          vec2 chromaOffset =
            centered * uAberration * (1.0 + uFlight * 1.4) * aberrationFalloff * (1.0 - uPixelate);
          if (aberrationFalloff <= 0.0 || uPixelate >= 1.0) {
            // The three channel coordinates are identical in the clean centre
            // and at full pixelation, so one fetch produces the same sample.
            color = texture2D(tDiffuse, distorted).rgb;
          } else {
            color.r = texture2D(tDiffuse, distorted + chromaOffset).r;
            color.g = texture2D(tDiffuse, distorted).g;
            color.b = texture2D(tDiffuse, distorted - chromaOffset).b;
          }
        #else
          color = texture2D(tDiffuse, distorted).rgb;
        #endif

        #ifdef USE_BLOOM
          // Both come from blurred buffers, so they smear straight across the
          // quantisation and leave the frame looking merely out of focus. They
          // retire as the grid closes in, which is what lets the blocks read.
          // The same applies once Earth fills the frame: a bright-pass bloom is
          // built for point highlights against sky, and turns a sunlit cloud
          // deck spanning every pixel into flat haze. uEntryHeat already tracks
          // exactly that stretch of the descent.
          float optics = (1.0 - uPixelate) * (1.0 - uEntryHeat * 0.62);
          if (optics > 0.0) {
            vec3 bloom = texture2D(tBloom, distorted).rgb;
            vec3 streak = texture2D(tStreak, distorted).rgb;
            color += bloom * uBloomStrength * (1.0 + uFlight * 0.5) * optics;
            color += streak * vec3(0.55, 0.78, 1.0) * uStreakStrength * (1.0 + uFlight) * optics;
          }
        #endif

        #ifdef USE_SHAFTS
          // Warmed a little against the star's own colour: the rays are sunlight
          // scattered through dust, so they should read hotter than the highlight
          // that threw them. Retired alongside the other optics for the same
          // reasons — a blurred buffer smears across the pixelation grid, and a
          // full-frame planet turns any of this into flat haze.
          if (uShaftStrength > 0.0) {
            vec3 shaft = texture2D(tShaft, distorted).rgb;
            color += shaft * vec3(1.0, 0.86, 0.66) * uShaftStrength
              * (1.0 - uPixelate) * (1.0 - uEntryHeat * 0.62);
          }
        #endif

        if (uEntryHeat > 0.0001) {
          // Re-entry plasma: the shock layer wraps the canopy from the edges in,
          // added before the tone curve so it rolls off to white at its peak.
          // Kept to the outer frame: the shock layer streams past the canopy, so
          // washing the centre would only turn the planet below it muddy.
          float rim = smoothstep(0.36, 0.74, edgeDistance);
          float flicker = 0.88 + 0.12 * sin(uTime * 23.0 + edgeDistance * 34.0);
          vec3 plasma = mix(vec3(1.0, 0.34, 0.09), vec3(1.0, 0.79, 0.46), rim);
          color += plasma * rim * uEntryHeat * flicker * 1.7;
          color += vec3(1.0, 0.5, 0.2) * uEntryHeat * uEntryHeat * 0.06;
        }

        color = acesFilmic(color * uExposure);

        // Cool shadows, warm highlights: a restrained cinematic split tone.
        float level = dot(color, vec3(0.2126, 0.7152, 0.0722));
        vec3 shadowTint = vec3(0.86, 0.95, 1.12);
        vec3 highlightTint = vec3(1.06, 1.0, 0.94);
        color *= mix(shadowTint, highlightTint, smoothstep(0.16, 0.78, level));
        color = (color - 0.5) * 1.06 + 0.5;

        float vignette = 1.0 - smoothstep(0.32, 0.86, edgeDistance);
        // The vignette would otherwise crush the plasma exactly where it burns.
        color *= mix(mix(0.42, 0.82, uEntryHeat), 1.0, vignette);

        #ifdef USE_GRAIN
          if (uGrain > 0.0001 && uPixelate < 1.0) {
            float grain = (randomNoise(gl_FragCoord.xy) - 0.5) * uGrain;
            color += grain * (1.2 - level * 0.7) * (1.0 - uPixelate);
          }
        #endif

        // The avatar has to land on black. Earth fills the frame edge to edge by
        // touchdown, so without this the pixel portrait ends up sitting on a
        // bloomed grey field instead of the empty sky the home page opens on.
        gl_FragColor = vec4(max(color, 0.0) * uFadeOut, 1.0);
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  upscaleMaterial = new THREE.ShaderMaterial({
    defines: getUpscaleDefines(profile),
    uniforms: {
      tDiffuse: { value: gradedTarget.texture },
      tNoise: { value: grainTexture },
      uSourceResolution: { value: new THREE.Vector2(1, 1) },
      uOutputResolution: { value: new THREE.Vector2(1, 1) },
      uTime: frameUniforms.time,
      uGrain: { value: profile.grain },
      uPixelate: compositeMaterial.uniforms.uPixelate,
      uSharpness: { value: 0.14 },
    },
    vertexShader: fullscreenVertexShader,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D tNoise;
      uniform vec2 uSourceResolution;
      uniform vec2 uOutputResolution;
      uniform float uTime;
      uniform float uGrain;
      uniform float uPixelate;
      uniform float uSharpness;
      varying vec2 vUv;

      float sjLuminance(vec3 color) {
        return dot(color, vec3(0.2126, 0.7152, 0.0722));
      }

      float randomNoise(vec2 coordinate) {
        vec2 offset = vec2(fract(uTime * 0.75487766), fract(uTime * 0.56984029));
        return texture2D(tNoise, fract(coordinate / 64.0 + offset)).r;
      }

      void main() {
        vec2 texel = 1.0 / max(uSourceResolution, vec2(1.0));
        vec3 center = texture2D(tDiffuse, vUv).rgb;
        vec3 color = center;
        // Smooth sky and broad gradients are already reconstructed exactly by
        // the texture unit's bilinear filter. Detail only needs the neighbour
        // pair along its dominant gradient; sampling the perpendicular pair
        // produced almost no visible recovery but doubled reconstruction reads.
        float centerLuma = sjLuminance(center);
        float gradientX = abs(dFdx(centerLuma));
        float gradientY = abs(dFdy(centerLuma));
        float localGradient = gradientX + gradientY;
        if (localGradient > 0.0025) {
          vec2 axis = gradientX >= gradientY ? vec2(texel.x, 0.0) : vec2(0.0, texel.y);
          vec3 forward = texture2D(tDiffuse, vUv + axis).rgb;
          vec3 backward = texture2D(tDiffuse, vUv - axis).rgb;
          vec3 neighborMin = min(center, min(forward, backward));
          vec3 neighborMax = max(center, max(forward, backward));
          vec3 laplacian = center * 2.0 - forward - backward;
          float contrast = max(
            abs(centerLuma - sjLuminance(forward)),
            abs(centerLuma - sjLuminance(backward))
          );
          // Stronger restoration on low-contrast texture detail, gentler at
          // hard silhouettes where overshoot would create a halo.
          float adaptiveStrength = uSharpness * mix(1.0, 0.48, smoothstep(0.06, 0.34, contrast));
          color = clamp(
            center + laplacian * adaptiveStrength,
            neighborMin - vec3(0.018),
            neighborMax + vec3(0.018)
          );
        }

        #ifdef USE_GRAIN
          if (uGrain > 0.0001 && uPixelate < 1.0) {
            float level = sjLuminance(color);
            float grain = (randomNoise(gl_FragCoord.xy) - 0.5) * uGrain;
            color += grain * (1.2 - level * 0.7) * (1.0 - uPixelate);
          }
        #endif

        gl_FragColor = vec4(max(color, 0.0), 1.0);
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compositeMaterial);
  postQuad.frustumCulled = false;
  postScene.add(postQuad);

  // The post scene never moves, but it is rendered six times per frame. Freeze
  // its transforms so Three.js does not rebuild the same matrices for each pass.
  postQuad.updateMatrix();
  postQuad.matrixAutoUpdate = false;
  postCamera.updateMatrixWorld(true);
  postCamera.matrixAutoUpdate = false;
  postScene.updateMatrixWorld(true);
  postScene.matrixWorldAutoUpdate = false;
  updatePostResolution();
}

function compilePostMaterials() {
  // A post scene contains one quad, so compile() only sees whichever material is
  // currently attached to it. Warm every pass under the opaque loader to avoid
  // compiling bright, blur, or streak shaders during the first visible frame.
  const originalMaterial = postQuad.material;
  for (const material of [
    brightMaterial,
    blurMaterial,
    streakMaterial,
    shaftMaterial,
    compositeMaterial,
    upscaleMaterial,
  ]) {
    postQuad.material = material;
    renderer.compile(postScene, postCamera);
  }
  postQuad.material = originalMaterial;
}

const shaftProjection = new THREE.Vector3();

function updateLightShafts() {
  const { uOrigin, uStrength } = shaftMaterial.uniforms;
  if (!sunWorldPosition) {
    uStrength.value = 0;
    return;
  }

  // project() divides by w, which for a point behind the camera flips the sign
  // and lands it back inside the frame mirrored through the centre. The rays
  // would then stream out of empty sky opposite the star.
  shaftProjection.copy(sunWorldPosition).applyMatrix4(camera.matrixWorldInverse);
  if (shaftProjection.z >= 0) {
    uStrength.value = 0;
    return;
  }

  shaftProjection.applyMatrix4(camera.projectionMatrix);
  uOrigin.value.set(shaftProjection.x * 0.5 + 0.5, shaftProjection.y * 0.5 + 0.5);

  // Held at full strength while the star is in frame and released over the next
  // half-frame's worth of travel past the edge. Cutting at the edge instead pops
  // a full set of rays out of the image in one frame.
  const excursion = Math.max(Math.abs(shaftProjection.x), Math.abs(shaftProjection.y));
  uStrength.value = 1 - THREE.MathUtils.smoothstep(excursion, 1, 2);
}

function renderFinalComposite() {
  const reconstruct = usesReconstruction();
  gpuBenchmark?.begin("composite");
  renderPass(compositeMaterial, reconstruct ? gradedTarget : null);
  gpuBenchmark?.end();
  if (reconstruct) {
    gpuBenchmark?.begin("upscale");
    renderPass(upscaleMaterial, null);
    gpuBenchmark?.end();
  }
}

function renderCinematicFrame() {
  const profile = qualityProfiles[qualityLevel];
  const { uFadeOut, uPixelate } = compositeMaterial.uniforms;
  gpuBenchmark?.poll();

  // Once the hand-off has reached black, the composite result is guaranteed to
  // be black regardless of every scene and post-process input. Draw that black
  // result once, then leave the canvas untouched while the DOM avatar finishes
  // its transition instead of spending the final seconds rendering invisible
  // pixels.
  if (uFadeOut.value <= 0) {
    if (!frameVisuallyBlank) {
      renderFinalComposite();
      frameVisuallyBlank = true;
    }
    return;
  }
  frameVisuallyBlank = false;

  gpuBenchmark?.begin("scene");
  renderer.setRenderTarget(sceneTarget);
  // Only the 3D pass needs a clear. Every post-process pass is an opaque
  // fullscreen draw, so clearing those targets first is pure bandwidth waste.
  renderer.clear(true, true, false);
  renderer.render(scene, camera);
  gpuBenchmark?.end();

  // Pixelation reaches exactly one shortly before the frame fades fully out.
  // At that point the composite shader multiplies both optical buffers by zero,
  // so refreshing five invisible fullscreen passes has no effect on the image.
  if (profile.bloomScale > 0 && uPixelate.value < 1) {
    gpuBenchmark?.begin("optics");
    brightMaterial.uniforms.tDiffuse.value = sceneTarget.texture;
    renderPass(brightMaterial, bloomTargetA);

    // Before the blur passes below overwrite bloomTargetA with their result.
    if (profile.shaftSamples > 0) {
      updateLightShafts();
      renderPass(shaftMaterial, shaftTarget);
    }

    const streakTexel = 1 / bloomTargetA.width;
    streakMaterial.uniforms.tDiffuse.value = bloomTargetA.texture;
    streakMaterial.uniforms.uStep.value.set(streakTexel * 2, 0);
    renderPass(streakMaterial, streakTargetA);
    streakMaterial.uniforms.tDiffuse.value = streakTargetA.texture;
    streakMaterial.uniforms.uStep.value.set(streakTexel * 14, 0);
    renderPass(streakMaterial, streakTargetB);

    blurMaterial.uniforms.tDiffuse.value = bloomTargetA.texture;
    blurMaterial.uniforms.uDirection.value.set(1 / bloomTargetA.width, 0);
    renderPass(blurMaterial, bloomTargetB);
    blurMaterial.uniforms.tDiffuse.value = bloomTargetB.texture;
    blurMaterial.uniforms.uDirection.value.set(0, 1 / bloomTargetA.height);
    renderPass(blurMaterial, bloomTargetA);
    gpuBenchmark?.end();
  }

  renderFinalComposite();
  gpuBenchmark?.finishFrame();
}

function releaseCpuTextureSourceAfterUpload(texture) {
  texture.onUpdate = () => {
    // The WebGL copy is now complete. These immutable sources otherwise keep
    // every decoded image/canvas alive for the whole 52-second journey.
    texture.source.data = null;
    texture.onUpdate = null;
  };
  // Upload immediately while the source is available. Deferring every texture
  // until the first visible render creates a large one-frame upload spike.
  renderer.initTexture(texture);
  return texture;
}

function prepareImmutableTexture(
  texture,
  {
    colorSpace = THREE.SRGBColorSpace,
    wrapS,
    wrapT,
    minFilter,
    magFilter,
    generateMipmaps,
    anisotropy = false,
  } = {},
) {
  texture.colorSpace = colorSpace;
  if (wrapS !== undefined) texture.wrapS = wrapS;
  if (wrapT !== undefined) texture.wrapT = wrapT;
  if (minFilter !== undefined) texture.minFilter = minFilter;
  if (magFilter !== undefined) texture.magFilter = magFilter;
  if (generateMipmaps !== undefined) texture.generateMipmaps = generateMipmaps;
  if (anisotropy) {
    texture.anisotropy = Math.min(
      renderer.capabilities.getMaxAnisotropy(),
      qualityLevel === "high" ? 8 : 4,
    );
  }
  return releaseCpuTextureSourceAfterUpload(texture);
}

function createImmutableCanvasTexture(source, options) {
  return prepareImmutableTexture(new THREE.CanvasTexture(source), options);
}

function createCanvasTexture(draw, size = 512) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = size;
  textureCanvas.height = size;
  const context = textureCanvas.getContext("2d");
  draw(context, size);
  return createImmutableCanvasTexture(textureCanvas, { anisotropy: true });
}

function discardStrictlyTransparentFragments(material, cacheKey) {
  const previousCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, webglRenderer) => {
    previousCompile.call(material, shader, webglRenderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <alphatest_fragment>",
      "if (diffuseColor.a == 0.0) discard;\n#include <alphatest_fragment>",
    );
  };
  const previousCacheKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${previousCacheKey()}|zero-alpha:${cacheKey}`;
  return material;
}

function getStellarMaterial(texture, color, opacity) {
  const key = `${texture.uuid}|${color}|${opacity}`;
  return getOrCreate(
    stellarMaterialCache,
    key,
    () =>
      discardStrictlyTransparentFragments(
        new THREE.SpriteMaterial({
          map: texture,
          color,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
        "stellar",
      ),
  );
}

function registerFadingSprite(sprite, { baseOpacity = 1, fadeRadius = 0 } = {}) {
  sprite.userData.baseOpacity = baseOpacity;
  sprite.userData.fadeRadius = fadeRadius;
  scene.add(sprite);
  nebulaSprites.push(sprite);
  return sprite;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function hash3(x, y, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ seed, 1274126177);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
}

function valueNoise3(x, y, z, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fy = y - yi;
  const fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);

  const c000 = hash3(xi, yi, zi, seed);
  const c100 = hash3(xi + 1, yi, zi, seed);
  const c010 = hash3(xi, yi + 1, zi, seed);
  const c110 = hash3(xi + 1, yi + 1, zi, seed);
  const c001 = hash3(xi, yi, zi + 1, seed);
  const c101 = hash3(xi + 1, yi, zi + 1, seed);
  const c011 = hash3(xi, yi + 1, zi + 1, seed);
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);

  const x00 = c000 + (c100 - c000) * sx;
  const x10 = c010 + (c110 - c010) * sx;
  const x01 = c001 + (c101 - c001) * sx;
  const x11 = c011 + (c111 - c011) * sx;
  const y0 = x00 + (x10 - x00) * sy;
  const y1 = x01 + (x11 - x01) * sy;
  return y0 + (y1 - y0) * sz;
}

// Sampling noise on the unit sphere keeps equirectangular maps free of pole pinching.
// Positional arguments avoid allocating an options object for every texel.
function sphereFbm(x, y, z, frequency, octaves, seed, ridged = false) {
  let amplitude = 1;
  let normalization = 0;
  let total = 0;
  let scale = frequency;

  for (let octave = 0; octave < octaves; octave += 1) {
    let sample = valueNoise3(x * scale, y * scale, z * scale, seed + octave * 1013);
    if (ridged) sample = 1 - Math.abs(sample * 2 - 1);
    total += sample * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    scale *= 2.02;
  }

  return total / normalization;
}

function createEquirectCanvas(width) {
  const equirectCanvas = document.createElement("canvas");
  equirectCanvas.width = width;
  equirectCanvas.height = Math.max(2, Math.round(width / 2));
  return equirectCanvas;
}

function configureSurfaceTexture(texture, srgb) {
  return prepareImmutableTexture(texture, {
    colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace,
    wrapS: THREE.RepeatWrapping,
    anisotropy: true,
  });
}

function loadTexture(loader, url, srgb) {
  return new Promise((resolve) => {
    loader.load(
      url,
      (texture) => resolve(configureSurfaceTexture(texture, srgb)),
      undefined,
      () => resolve(null),
    );
  });
}

/*
 * Earth and the Moon use compressed photographic maps baked from NASA imagery.
 * The fetch is kicked off before the procedural planets are generated so the
 * download overlaps with CPU-side texture baking.
 */
function loadPhotographicSurfaces() {
  const tier = qualityProfiles[qualityLevel].textureTier;
  const loader = new THREE.TextureLoader();
  return Promise.all([
    loadTexture(loader, `textures/earth-day-${tier}.webp`, true),
    loadTexture(loader, `textures/earth-night-${tier}.webp`, true),
    // R holds elevation relief for the bump map, G holds ocean-aware roughness.
    loadTexture(loader, `textures/earth-orm-${tier}.webp`, false),
    loadTexture(loader, `textures/earth-clouds-${tier}.webp`, false),
    loadTexture(loader, `textures/moon-${tier}.webp`, true),
    loadTexture(loader, `textures/sun-${tier}.webp`, true),
    loadTexture(loader, `textures/jupiter-${tier}.webp`, true),
    loadTexture(loader, `textures/mars-${tier}.webp`, true),
  ]).then(([day, night, orm, clouds, moon, sun, jupiter, mars]) => {
    let earth = null;
    if (day && orm) {
      earth = { map: day, bumpMap: orm, roughnessMap: orm, nightMap: night, cloudMap: clouds };
    } else {
      // A partial Earth set cannot be rendered by the photographic path. Release
      // any successfully uploaded partners before falling back to the procedural
      // surface, otherwise a transient request failure strands GPU memory.
      for (const texture of [day, night, orm, clouds]) texture?.dispose();
    }

    return {
      sun,
      jupiter: jupiter ? { map: jupiter } : null,
      // Martian albedo tracks its terrain closely enough to double as a height field.
      mars: mars ? { map: mars, bumpMap: mars } : null,
      earth,
      // The lunar albedo doubles as its own height field, which avoids a second download.
      moon: moon ? { map: moon, bumpMap: moon } : null,
    };
  });
}

function finalizeTexture(source, { srgb = true, repeat = true } = {}) {
  return createImmutableCanvasTexture(source, {
    colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace,
    wrapS: repeat ? THREE.RepeatWrapping : undefined,
    anisotropy: true,
  });
}

function mixChannel(a, b, amount) {
  return a + (b - a) * amount;
}

function smootherstep(edge0, edge1, value) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

function createLongitudeLookup(width) {
  const cosine = new Float64Array(width);
  const sine = new Float64Array(width);
  for (let column = 0; column < width; column += 1) {
    const longitude = (column / width) * Math.PI * 2;
    cosine[column] = Math.cos(longitude);
    sine[column] = Math.sin(longitude);
  }
  return { cosine, sine };
}

/*
 * Every planet surface is baked once on the CPU into equirectangular canvases.
 * Detail therefore costs load time instead of per-frame GPU time.
 */
function createPlanetSurface(kind, seed, palette) {
  const profile = qualityProfiles[qualityLevel];
  const width = profile.texture;
  const albedoCanvas = createEquirectCanvas(width);
  const height = albedoCanvas.height;
  const context = albedoCanvas.getContext("2d");
  const albedo = context.createImageData(width, height);

  const bumpCanvas = createEquirectCanvas(width);
  const bumpContext = bumpCanvas.getContext("2d");
  const bump = bumpContext.createImageData(width, height);

  const isEarth = kind === "earth";
  const roughnessCanvas = isEarth ? createEquirectCanvas(width) : null;
  const roughnessContext = roughnessCanvas?.getContext("2d");
  const roughness = roughnessContext?.createImageData(width, height);
  const nightCanvas = isEarth ? createEquirectCanvas(width) : null;
  const nightContext = nightCanvas?.getContext("2d");
  const night = nightContext?.createImageData(width, height);

  const octaves = profile.octaves;
  const random = mulberry32(seed);
  const stormLongitude = random() * Math.PI * 2;
  const stormLatitude = (random() - 0.5) * 0.5;
  const longitude = createLongitudeLookup(width);

  for (let row = 0; row < height; row += 1) {
    const latitude = (row / (height - 1)) * Math.PI;
    const sinLatitude = Math.sin(latitude);
    const cosLatitude = Math.cos(latitude);
    const gasZonal = cosLatitude * 34 + Math.sin(cosLatitude * 5.2) * 3.8;

    for (let column = 0; column < width; column += 1) {
      const dirX = sinLatitude * longitude.cosine[column];
      const dirY = cosLatitude;
      const dirZ = sinLatitude * longitude.sine[column];
      const index = (row * width + column) * 4;

      let red = 0;
      let green = 0;
      let blue = 0;
      let relief = 0;

      if (isEarth) {
        const continents = sphereFbm(dirX, dirY, dirZ, 2.1, octaves, seed);
        const detail = sphereFbm(dirX, dirY, dirZ, 7.4, 3, seed + 91);
        const elevation = continents * 0.78 + detail * 0.22;
        const polar = Math.abs(dirY);
        const iceLine = 0.74 - detail * 0.1;
        // Roughly a third of the sphere stays above the waterline, as on Earth.
        const seaLevel = 0.63;
        const isLand = elevation > seaLevel;

        if (isLand) {
          const landHeight = smootherstep(seaLevel, 0.82, elevation);
          const aridity = sphereFbm(dirX, dirY, dirZ, 3.6, 3, seed + 311);
          const equatorial = 1 - Math.abs(dirY);
          const desert = smootherstep(0.48, 0.68, aridity) * smootherstep(0.45, 0.85, equatorial);
          red = mixChannel(46, 132, desert);
          green = mixChannel(92, 112, desert);
          blue = mixChannel(52, 68, desert);
          red = mixChannel(red, 122, landHeight * 0.8);
          green = mixChannel(green, 116, landHeight * 0.8);
          blue = mixChannel(blue, 104, landHeight * 0.8);
          relief = 120 + landHeight * 135;
        } else {
          const depth = smootherstep(seaLevel, 0.36, elevation);
          const shallows = smootherstep(seaLevel - 0.035, seaLevel, elevation);
          red = mixChannel(16, 5, depth);
          green = mixChannel(88, 38, depth);
          blue = mixChannel(150, 96, depth);
          red = mixChannel(red, 34, shallows);
          green = mixChannel(green, 128, shallows);
          blue = mixChannel(blue, 164, shallows);
          relief = 60 - depth * 40;
        }

        if (polar > iceLine) {
          const ice = smootherstep(iceLine, iceLine + 0.14, polar);
          red = mixChannel(red, 236, ice);
          green = mixChannel(green, 245, ice);
          blue = mixChannel(blue, 252, ice);
          relief = mixChannel(relief, 190, ice);
        }

        if (roughness) {
          const oceanRoughness = isLand ? 226 : 48;
          roughness.data[index] = oceanRoughness;
          roughness.data[index + 1] = oceanRoughness;
          roughness.data[index + 2] = oceanRoughness;
          roughness.data[index + 3] = 255;
        }

        if (night) {
          let lights = 0;
          if (isLand && polar < 0.72) {
            const density = sphereFbm(dirX, dirY, dirZ, 26, 3, seed + 733);
            const coastal = 1 - smootherstep(seaLevel, seaLevel + 0.12, elevation);
            const cluster = smootherstep(0.62, 0.82, density);
            lights = cluster * (0.35 + coastal * 0.65);
          }
          night.data[index] = Math.round(255 * lights);
          night.data[index + 1] = Math.round(206 * lights);
          night.data[index + 2] = Math.round(138 * lights);
          night.data[index + 3] = 255;
        }
      } else if (kind === "gas") {
        // Domain warping churns the edges of the belts. The warp has to stay well
        // under the band frequency: push it higher and the zonal structure
        // dissolves into blobs that read as stains rather than weather.
        const warp = sphereFbm(dirX, dirY, dirZ, 3.1, octaves, seed + 17);
        const swirl = sphereFbm(dirX, dirY, dirZ, 8.2, 3, seed + 53);
        const shear = sphereFbm(dirX, dirY, dirZ, 17, 2, seed + 131);
        // Belt widths vary with latitude, as the zonal jets do on a real giant.
        const band = Math.sin(gasZonal + warp * 2 + swirl * 0.8 + shear * 0.35) * 0.5 + 0.5;
        // A weaker second harmonic splits the major belts into the finer ribbons
        // a real giant shows between its zones.
        const ribbon = Math.sin(gasZonal * 2.7 + swirl * 1.4) * 0.5 + 0.5;
        const stripe = smootherstep(0.14, 0.86, band * 0.76 + ribbon * 0.24);
        const paletteIndex = stripe * (palette.length - 1);
        const lowIndex = Math.floor(paletteIndex);
        const highIndex = Math.min(lowIndex + 1, palette.length - 1);
        const blend = paletteIndex - lowIndex;
        const low = palette[lowIndex];
        const high = palette[highIndex];
        red = mixChannel(low[0], high[0], blend);
        green = mixChannel(low[1], high[1], blend);
        blue = mixChannel(low[2], high[2], blend);

        const stormDistanceX = Math.atan2(dirZ, dirX) - stormLongitude;
        const wrappedX = Math.atan2(Math.sin(stormDistanceX), Math.cos(stormDistanceX));
        const stormDistance = Math.hypot(wrappedX * 0.55, dirY - stormLatitude);
        const storm = 1 - smootherstep(0.06, 0.19, stormDistance);
        if (storm > 0) {
          const curl = sphereFbm(dirX, dirY, dirZ, 14, 3, seed + 907);
          red = mixChannel(red, 236, storm * (0.55 + curl * 0.45));
          green = mixChannel(green, 148, storm * 0.75);
          blue = mixChannel(blue, 108, storm * 0.75);
        }
        relief = 90 + band * 60 + storm * 50;
      } else {
        const ridges = sphereFbm(dirX, dirY, dirZ, 3.2, octaves, seed, true);
        const grain = sphereFbm(dirX, dirY, dirZ, 12.5, 3, seed + 421);
        const craters = sphereFbm(dirX, dirY, dirZ, 7.5, 2, seed + 137);
        const crater = smootherstep(0.62, 0.78, craters) - smootherstep(0.78, 0.9, craters) * 0.6;
        const shade = ridges * 0.62 + grain * 0.24 + crater * 0.3;
        const paletteIndex = Math.min(shade, 0.999) * (palette.length - 1);
        const lowIndex = Math.floor(paletteIndex);
        const highIndex = Math.min(lowIndex + 1, palette.length - 1);
        const blend = paletteIndex - lowIndex;
        const low = palette[lowIndex];
        const high = palette[highIndex];
        red = mixChannel(low[0], high[0], blend);
        green = mixChannel(low[1], high[1], blend);
        blue = mixChannel(low[2], high[2], blend);
        relief = 40 + shade * 210;
      }

      albedo.data[index] = Math.round(Math.min(Math.max(red, 0), 255));
      albedo.data[index + 1] = Math.round(Math.min(Math.max(green, 0), 255));
      albedo.data[index + 2] = Math.round(Math.min(Math.max(blue, 0), 255));
      albedo.data[index + 3] = 255;

      const reliefValue = Math.round(Math.min(Math.max(relief, 0), 255));
      bump.data[index] = reliefValue;
      bump.data[index + 1] = reliefValue;
      bump.data[index + 2] = reliefValue;
      bump.data[index + 3] = 255;
    }
  }

  context.putImageData(albedo, 0, 0);
  bumpContext.putImageData(bump, 0, 0);
  if (roughnessContext && roughness) roughnessContext.putImageData(roughness, 0, 0);
  if (nightContext && night) nightContext.putImageData(night, 0, 0);

  return {
    map: finalizeTexture(albedoCanvas),
    bumpMap: finalizeTexture(bumpCanvas, { srgb: false }),
    roughnessMap: roughnessCanvas ? finalizeTexture(roughnessCanvas, { srgb: false }) : null,
    nightMap: nightCanvas ? finalizeTexture(nightCanvas) : null,
  };
}

function createCloudTexture(seed) {
  const profile = qualityProfiles[qualityLevel];
  const cloudCanvas = createEquirectCanvas(Math.round(profile.texture * 0.75));
  const width = cloudCanvas.width;
  const height = cloudCanvas.height;
  const context = cloudCanvas.getContext("2d");
  const image = context.createImageData(width, height);
  const octaves = Math.min(4, Math.max(3, profile.octaves));
  const longitude = createLongitudeLookup(width);

  for (let row = 0; row < height; row += 1) {
    const latitude = (row / (height - 1)) * Math.PI;
    const sinLatitude = Math.sin(latitude);
    const cosLatitude = Math.cos(latitude);
    // Thin the cover near the equator so the ocean and city lights stay visible.
    const belt = 0.62 + Math.abs(Math.sin(latitude * 3.1)) * 0.24;

    for (let column = 0; column < width; column += 1) {
      const dirX = sinLatitude * longitude.cosine[column];
      const dirY = cosLatitude;
      const dirZ = sinLatitude * longitude.sine[column];
      const swirl = sphereFbm(dirX, dirY, dirZ, 2.4, octaves, seed);
      const wisps = sphereFbm(dirX + swirl * 0.4, dirY, dirZ + swirl * 0.4, 6.4, 3, seed + 271);
      const coverage = smootherstep(belt - 0.16, belt + 0.2, swirl * 0.6 + wisps * 0.4);
      const value = Math.round(255 * coverage);
      const index = (row * width + column) * 4;
      image.data[index] = 255;
      image.data[index + 1] = 255;
      image.data[index + 2] = 255;
      image.data[index + 3] = value;
    }
  }

  context.putImageData(image, 0, 0);
  return finalizeTexture(cloudCanvas);
}

function createRingTexture(seed) {
  const ringCanvas = document.createElement("canvas");
  ringCanvas.width = 1024;
  ringCanvas.height = 4;
  const context = ringCanvas.getContext("2d");
  const image = context.createImageData(ringCanvas.width, ringCanvas.height);
  const random = mulberry32(seed);
  // Narrow, sharp-edged divisions. Broad structure comes from the zones below;
  // scattering many deep gaps across the whole span reads as loose wire hoops.
  const gaps = Array.from({ length: 3 }, () => ({
    center: 0.3 + random() * 0.6,
    width: 0.004 + random() * 0.01,
  }));

  for (let column = 0; column < ringCanvas.width; column += 1) {
    const t = column / (ringCanvas.width - 1);

    // Saturn-like zoning: a faint inner ring, a dense bright one, a wide
    // division, then a medium outer ring.
    let density =
      0.34 * smootherstep(0, 0.12, t) +
      0.54 * smootherstep(0.15, 0.33, t) -
      0.36 * smootherstep(0.59, 0.66, t) +
      0.28 * smootherstep(0.69, 0.76, t);
    // Shallow ringlets keep the system reading as a solid sheet up close.
    density *= 0.84 + 0.16 * Math.sin(t * 430 + Math.sin(t * 29) * 2.3);
    density = Math.min(Math.max(density, 0), 1);

    gaps.forEach((gap) => {
      density *= smootherstep(0, gap.width, Math.abs(t - gap.center));
    });

    density *= smootherstep(0, 0.04, t) * (1 - smootherstep(0.93, 1, t));

    const warmth = 0.55 + 0.45 * Math.sin(t * 11.3);
    const red = Math.round(mixChannel(176, 226, warmth));
    const green = Math.round(mixChannel(154, 199, warmth));
    const blue = Math.round(mixChannel(126, 168, warmth));

    for (let row = 0; row < ringCanvas.height; row += 1) {
      const index = (row * ringCanvas.width + column) * 4;
      image.data[index] = red;
      image.data[index + 1] = green;
      image.data[index + 2] = blue;
      image.data[index + 3] = Math.round(density * 255);
    }
  }

  context.putImageData(image, 0, 0);
  return finalizeTexture(ringCanvas, { repeat: false });
}

function createNebulaTexture(color, seed = 5) {
  const [baseRed, baseGreen, baseBlue] = color.match(/\d+/g).map(Number);
  const size = qualityLevel === "high" ? 512 : 256;
  const nebulaCanvas = document.createElement("canvas");
  nebulaCanvas.width = size;
  nebulaCanvas.height = size;
  const context = nebulaCanvas.getContext("2d");
  const image = context.createImageData(size, size);
  const octaves = qualityLevel === "high" ? 5 : 4;
  const random = mulberry32(seed * 977);
  const coordinates = new Float64Array(size);
  for (let index = 0; index < size; index += 1) {
    coordinates[index] = (index / size - 0.5) * 2;
  }

  for (let row = 0; row < size; row += 1) {
    const y = coordinates[row];
    const rowOffset = row * size;
    for (let column = 0; column < size; column += 1) {
      const x = coordinates[column];
      const distance = Math.hypot(x, y);
      const index = (rowOffset + column) * 4;

      if (distance > 1) {
        image.data[index + 3] = 0;
        continue;
      }

      // Two warped noise fields give filaments a wispy, volumetric silhouette.
      const warp = sphereFbm(x * 1.6, y * 1.6, 0.35, 1.7, 3, seed + 5);
      const filaments = sphereFbm(x * 2.4 + warp, y * 2.4 - warp, warp * 1.3, 2.3, octaves, seed, true);
      const core = Math.pow(1 - distance, 2.1);
      const density = Math.min(Math.max(filaments * 1.25 - 0.22, 0), 1) * core;
      const hot = Math.pow(density, 2.4);

      image.data[index] = Math.round(Math.min(baseRed * density + 235 * hot, 255));
      image.data[index + 1] = Math.round(Math.min(baseGreen * density + 226 * hot, 255));
      image.data[index + 2] = Math.round(Math.min(baseBlue * density + 255 * hot, 255));
      image.data[index + 3] = Math.round(Math.min(density * 320, 255));
    }
  }

  context.putImageData(image, 0, 0);

  context.globalCompositeOperation = "lighter";
  for (let star = 0; star < 60; star += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = 0.4 + random() * 1.1;
    context.fillStyle = `rgba(255,255,255,${0.25 + random() * 0.5})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalCompositeOperation = "source-over";

  return finalizeTexture(nebulaCanvas, { repeat: false });
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/*
 * True at any point on the flight path where this star would be seen inside a
 * planet's silhouette. Stars are meant to read as an infinitely distant
 * backdrop, so one drawn across a nearby gas giant destroys the sense of scale.
 */
const toStar = new THREE.Vector3();
const toBody = new THREE.Vector3();

function prepareFlightOcclusionSamples() {
  flightOcclusionSamples.length = 0;
  // Body direction and angular radius depend only on the sampled camera point,
  // not on the thousands of candidate stars. Cache them once instead of
  // repeating the same vector normalisation and trigonometry for every point.
  const steps = 20;
  for (let step = 0; step <= steps; step += 1) {
    const cameraPosition = new THREE.Vector3(
      0,
      0,
      journeyStartZ - (step / steps) * (journeyStartZ - journeyEndZ),
    );
    const blockers = [];
    for (const occluder of occluders) {
      toBody.subVectors(occluder.center, cameraPosition);
      const distance = toBody.length();
      if (distance <= occluder.radius) continue;
      blockers.push({
        distance,
        direction: toBody.clone().multiplyScalar(1 / distance),
        cosRadius: Math.cos(Math.asin(occluder.radius / distance) * 1.2),
      });
    }
    flightOcclusionSamples.push({ cameraPosition, blockers });
  }
}

function overlapsOccluder(star) {
  for (const sample of flightOcclusionSamples) {
    toStar.subVectors(star, sample.cameraPosition);
    const starDistance = toStar.length();

    for (const blocker of sample.blockers) {
      if (starDistance >= blocker.distance) continue;
      // A small margin keeps stars from clinging to the limb.
      const cosSeparation = toStar.dot(blocker.direction) / starDistance;
      if (cosSeparation > blocker.cosRadius) return true;
    }
  }
  return false;
}

function addStarLayer(count, spread, size, color, seed, depth = { near: 80, far: -820 }) {
  const positions = new Float32Array(count * 3);
  const twinkle = new Float32Array(count);
  const magnitudes = new Float32Array(count);
  const temperatures = new Float32Array(count);
  const random = mulberry32(seed);
  const candidate = new THREE.Vector3();
  let written = 0;

  for (let index = 0; index < count; index += 1) {
    const radius = 45 + Math.pow(random(), 0.35) * spread;
    const angle = random() * Math.PI * 2;
    candidate.set(
      Math.cos(angle) * radius,
      (random() - 0.5) * spread * 0.72,
      depth.near - random() * (depth.near - depth.far),
    );
    const flicker = random();
    // A real sky is mostly faint stars with a handful of bright ones. Drawing
    // them all at one size and one colour is what makes a starfield read as
    // noise, so each gets its own magnitude and colour temperature.
    const magnitude = 0.55 + Math.pow(random(), 4) * 4.4;
    const temperature = 0.5 + (random() + random() + random() - 1.5) * 0.62;
    if (overlapsOccluder(candidate)) continue;

    positions[written * 3] = candidate.x;
    positions[written * 3 + 1] = candidate.y;
    positions[written * 3 + 2] = candidate.z;
    twinkle[written] = flicker;
    magnitudes[written] = magnitude;
    temperatures[written] = THREE.MathUtils.clamp(temperature, 0, 1);
    written += 1;
  }

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uSize: { value: size * renderer.getPixelRatio() },
      uTime: frameUniforms.time,
      uFade: { value: 1 },
    },
    vertexShader: `
      attribute float aTwinkle;
      attribute float aMagnitude;
      attribute float aTemperature;
      uniform float uSize;
      uniform float uTime;
      varying float vBrightness;
      varying float vGlint;
      varying vec3 vTint;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        #ifdef STATIC_STARS
          float pulse = 0.86;
        #else
          float pulse = 0.86 + 0.07 * sin(uTime * (0.7 + aTwinkle) + aTwinkle * 31.4);
        #endif
        // Faint stars are dim as well as small; size alone reads as a resolution
        // artefact rather than distance.
        vBrightness = pulse * mix(0.68, 1.16, clamp((aMagnitude - 0.55) / 4.4, 0.0, 1.0));
        // Only the handful of first-magnitude stars earn a lens glint.
        vGlint = smoothstep(2.4, 4.2, aMagnitude);

        // Stand-in for a blackbody ramp: hot blue through white to amber.
        vec3 cool = vec3(0.62, 0.78, 1.0);
        vec3 neutral = vec3(1.0, 0.97, 0.94);
        vec3 warm = vec3(1.0, 0.68, 0.42);
        vTint = aTemperature < 0.5
          ? mix(cool, neutral, aTemperature * 2.0)
          : mix(neutral, warm, (aTemperature - 0.5) * 2.0);

        // Deliberately not scaled by the pulse. These sprites are only a few
        // pixels across, so scaling one snaps it between whole pixels of
        // coverage and the star reads as a hard blink rather than a shimmer —
        // that size step, not the brightness, was carrying most of what the
        // twinkle looked like. The constant is the pulse's own centre, so every
        // star keeps the size it had.
        float pointSize = uSize * aMagnitude * 0.86 * clamp(260.0 / -viewPosition.z, 0.55, 3.2);

        // Widened and dimmed per SPRITE_MIN_PIXELS. This, not the pulse above,
        // is what the field's fast shimmer was: most of the field sits below a
        // pixel here, because the scene rasterises at two thirds of the output
        // resolution, and the driver floors those at one pixel — so they render
        // as a single hard pixel that jumps to the next as it drifts rather
        // than sliding between them.
        float widened = max(pointSize, ${SPRITE_MIN_PIXELS});
        vBrightness *= max((pointSize * pointSize) / (widened * widened), ${SPRITE_DIM_FLOOR});
        gl_PointSize = widened;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uFade;
      varying float vBrightness;
      varying float vGlint;
      varying vec3 vTint;

      void main() {
        vec2 offset = gl_PointCoord - 0.5;
        float distanceToCenter = length(offset);
        float core = 1.0 - smoothstep(0.02, 0.34, distanceToCenter);
        float halo = 1.0 - smoothstep(0.1, 0.5, distanceToCenter);
        float alpha = (core + halo * 0.42) * vBrightness * uFade;

        if (vGlint > 0.0) {
          // Thin cross flare, the way a bright star resolves through a lens.
          float spike = max(0.0, 1.0 - abs(offset.x) * 13.0) * max(0.0, 1.0 - abs(offset.y) * 3.4)
            + max(0.0, 1.0 - abs(offset.y) * 13.0) * max(0.0, 1.0 - abs(offset.x) * 3.4);
          alpha += spike * vGlint * 0.5 * vBrightness * uFade;
        }

        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uColor * vTint * (1.0 + core * 0.65), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const animatedMaterial = material;
  const staticMaterial = material.clone();
  staticMaterial.defines = { ...staticMaterial.defines, STATIC_STARS: "" };
  for (const starMaterial of [staticMaterial, animatedMaterial]) {
    starMaterial.userData.baseSize = size;
    starMaterial.userData.fadesNearEarth = depth.far > -1000;
    starMaterials.push(starMaterial);
  }
  const rotationRate = (starLayerSequence + 1) * 0.000012;
  starLayerSequence += 1;
  // One giant buffer keeps every vertex alive until its final star leaves the
  // frustum. Depth slices preserve the exact point data and shared shader while
  // allowing Three.js to reject corridor sections already behind the camera.
  const depthSpan = Math.max(1, depth.near - depth.far);
  const sliceCount = Math.min(6, Math.max(1, Math.ceil(depthSpan / 240)));
  const bucketCounts = new Uint32Array(sliceCount * 2);
  const sliceFor = (z) =>
    Math.min(sliceCount - 1, Math.max(0, Math.floor(((depth.near - z) / depthSpan) * sliceCount)));
  // Threshold on how large a share of the field animates at all. There is no air
  // out here for a star to twinkle through, so this is a lens conceit rather
  // than an observation, and a fifth of the sky doing it at once was enough to
  // read as noise across the whole backdrop.
  const bucketFor = (index) => sliceFor(positions[index * 3 + 2]) * 2 + (twinkle[index] >= 0.9 ? 1 : 0);

  for (let index = 0; index < written; index += 1) {
    bucketCounts[bucketFor(index)] += 1;
  }

  const slices = Array.from({ length: sliceCount * 2 }, (_, index) => ({
    position: new Float32Array(bucketCounts[index] * 3),
    twinkle: new Float32Array(bucketCounts[index]),
    magnitude: new Float32Array(bucketCounts[index]),
    temperature: new Float32Array(bucketCounts[index]),
    written: 0,
  }));
  for (let index = 0; index < written; index += 1) {
    const slice = slices[bucketFor(index)];
    const target = slice.written;
    slice.position[target * 3] = positions[index * 3];
    slice.position[target * 3 + 1] = positions[index * 3 + 1];
    slice.position[target * 3 + 2] = positions[index * 3 + 2];
    slice.twinkle[target] = twinkle[index];
    slice.magnitude[target] = magnitudes[index];
    slice.temperature[target] = temperatures[index];
    slice.written += 1;
  }

  const createdLayers = [];
  for (let bucket = 0; bucket < slices.length; bucket += 1) {
    const slice = slices[bucket];
    if (!slice.written) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(slice.position, 3));
    geometry.setAttribute("aTwinkle", new THREE.BufferAttribute(slice.twinkle, 1));
    geometry.setAttribute("aMagnitude", new THREE.BufferAttribute(slice.magnitude, 1));
    geometry.setAttribute("aTemperature", new THREE.BufferAttribute(slice.temperature, 1));
    geometry.computeBoundingSphere();
    const stars = new THREE.Points(
      geometry,
      bucket % 2 === 0 ? staticMaterial : animatedMaterial,
    );
    stars.userData.rotationRate = rotationRate;
    scene.add(stars);
    starLayers.push(stars);
    createdLayers.push(stars);
  }
  return createdLayers;
}

function createAtmosphereMaterial(glowColor, intensity, thickness) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uGlowColor: { value: new THREE.Color(glowColor) },
      uSunDirection: sunUniform,
      uIntensity: { value: intensity },
      uThickness: { value: thickness },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uGlowColor;
      uniform vec3 uSunDirection;
      uniform float uIntensity;
      uniform float uThickness;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normalDirection = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(normalDirection, viewDirection), 0.0), uThickness);
        float sunAlignment = dot(normalDirection, uSunDirection);

        // Daylight drives the shell, with a warm band held at the terminator.
        float daylight = smoothstep(-0.26, 0.4, sunAlignment);
        float terminator = 1.0 - smoothstep(0.0, 0.3, abs(sunAlignment));
        float forwardScatter = pow(max(dot(viewDirection, -uSunDirection), 0.0), 7.0);

        vec3 sunsetColor = vec3(1.0, 0.52, 0.26);
        vec3 tint = mix(uGlowColor, sunsetColor, terminator * 0.65);
        // The floor under the daylight term used to be high enough to keep the
        // shell alight around the unlit limb as well. On a gas giant lit from
        // three-quarters behind the camera, that closed into an unbroken bright
        // outline around the whole disc and the planet read as a decal cut from
        // the sky. An atmosphere is only visible where the sun is in it, so this
        // must decay to nothing: the glow should end in an arc.
        float alpha = fresnel * uIntensity * (0.012 + daylight * 1.05);
        vec3 color = tint * (0.9 + fresnel * 1.7 + forwardScatter * 2.4 + terminator * 0.6);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

function createRingMaterial(radius, seed, center) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uRingMap: { value: createRingTexture(seed) },
      uInnerRadius: { value: radius * 1.32 },
      uOuterRadius: { value: radius * 2.32 },
      uPlanetRadius: { value: radius },
      uPlanetCenter: { value: new THREE.Vector3(...center) },
      uSunDirection: sunUniform,
    },
    vertexShader: `
      varying float vRingRadius;
      varying vec3 vWorldPosition;

      void main() {
        vRingRadius = length(position.xy);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uRingMap;
      uniform float uInnerRadius;
      uniform float uOuterRadius;
      uniform float uPlanetRadius;
      uniform vec3 uPlanetCenter;
      uniform vec3 uSunDirection;
      varying float vRingRadius;
      varying vec3 vWorldPosition;

      void main() {
        float span = (vRingRadius - uInnerRadius) / (uOuterRadius - uInnerRadius);
        if (span < 0.0 || span > 1.0) discard;
        vec4 ring = texture2D(uRingMap, vec2(span, 0.5));
        // Zero-alpha gaps cannot affect either color or depth. Reject them before
        // the shadow and backlight math rather than shading invisible ring space.
        if (ring.a == 0.0) discard;

        // Approximate the planet shadow as a cylinder cast along the sun direction.
        vec3 toFragment = vWorldPosition - uPlanetCenter;
        float alongSun = dot(toFragment, uSunDirection);
        vec3 perpendicular = toFragment - uSunDirection * alongSun;
        float perpendicularLength = length(perpendicular);
        float shadow = 1.0;
        if (alongSun < 0.0) {
          shadow = mix(0.22, 1.0, smoothstep(uPlanetRadius * 0.86, uPlanetRadius * 1.16, perpendicularLength));
        }

        // Ice particles scatter strongly when the ring is viewed against the sun.
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float backlight = pow(max(dot(viewDirection, -uSunDirection), 0.0), 2.6);
        vec3 color = ring.rgb * (0.68 + backlight * 1.5) * shadow;
        gl_FragColor = vec4(color, ring.a * (0.55 + backlight * 0.45) * shadow);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // The ring is one flat, non-self-intersecting sheet. Double-sided transparent
  // materials otherwise render back and front in separate passes in Three.js.
  material.forceSinglePass = true;
  return material;
}

function applyNightLights(material, nightMap) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDirection = sunUniform;
    shader.uniforms.uNightMap = { value: nightMap };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSurfaceNormalW;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvSurfaceNormalW = normalize(mat3(modelMatrix) * objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uSunDirection;\nuniform sampler2D uNightMap;\nvarying vec3 vSurfaceNormalW;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         float sunFacing = dot(normalize(vSurfaceNormalW), uSunDirection);
         float nightMask = smoothstep(0.14, -0.24, sunFacing);
         if (nightMask > 0.0) {
           totalEmissiveRadiance += texture2D(uNightMap, vMapUv).rgb * nightMask * 2.6;
         }`,
      );
  };
  material.customProgramCacheKey = () => "space-journey-night-lights";
}

/*
 * The star that lights this scene sits almost behind the camera, so the flyby
 * bodies are nearly full discs with the terminator swung round out of sight.
 * That is what a photographic map on a sphere needs least: with no shadow to
 * shape it, the disc reads as a sticker cut from the sky. A real atmosphere
 * darkens toward the limb, where a line of sight leaves it at a grazing angle
 * and less light is scattered back — Jupiter's limb is visibly dimmer than its
 * centre in every Cassini frame. Reproducing it restores the roundness the
 * lighting angle cannot give, and it works on a fully lit disc, which is
 * exactly the case that has nothing else to shape it.
 */
function applyLimbDarkening(material, amount) {
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey?.() ?? "";
  material.onBeforeCompile = (shader, webglRenderer) => {
    if (previousCompile) previousCompile(shader, webglRenderer);
    shader.uniforms.uLimbDarkening = { value: amount };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uLimbDarkening;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         // The classic linear limb-darkening law, on the cosine of the angle
         // between the surface and the line of sight.
         float grazingAngle = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
         diffuseColor.rgb *= 1.0 - uLimbDarkening * (1.0 - grazingAngle);`,
      );
  };
  // Two bodies sharing a limb coefficient can share a compiled program; two on
  // different ones cannot, since it is baked in as a uniform default here.
  material.customProgramCacheKey = () => `${previousKey}|limb-${amount.toFixed(2)}`;
}

function addCelestialBody({
  radius,
  position,
  surface,
  glowColor,
  // Copy for the targeting card. Registered here so the lock volume can never
  // drift from the geometry it belongs to.
  info = null,
  ring = false,
  emissive = 0.03,
  clouds = false,
  atmosphereIntensity = 0.72,
  atmosphereThickness = 3.2,
  rotationSpeed = 0.0007,
  // Gas giants scatter through a deep atmosphere and darken hard at the limb;
  // airless rock falls off far less.
  limbDarkening = 0.42,
  seed = 1,
  // Bodies that fill a large part of the frame need a finer silhouette,
  // otherwise the limb reads as a polygon.
  detail = 1,
}) {
  const group = new THREE.Group();
  group.position.set(...position);
  const profile = qualityProfiles[qualityLevel];

  const material = new THREE.MeshStandardMaterial({
    map: surface.map,
    bumpMap: surface.bumpMap ?? null,
    bumpScale: radius * (surface.roughnessMap ? 0.03 : 0.012),
    roughnessMap: surface.roughnessMap ?? null,
    roughness: surface.roughnessMap ? 1 : 0.86,
    metalness: 0.02,
    emissive: new THREE.Color(glowColor),
    emissiveIntensity: emissive,
  });
  if (surface.nightMap) applyNightLights(material, surface.nightMap);
  if (limbDarkening > 0) applyLimbDarkening(material, limbDarkening);

  const geometry =
    detail === 1
      ? sharedSurfaceGeometry
      : getSphereGeometry(
          Math.round(profile.sphere[0] * detail),
          Math.round(profile.sphere[1] * detail),
        );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(radius);
  mesh.rotation.z = 0.21;
  group.add(mesh);

  let cloudMesh = null;
  if (clouds && profile.clouds) {
    const cloudMap = surface.cloudMap ?? createCloudTexture(seed + 61);
    const cloudMaterial = discardStrictlyTransparentFragments(
      new THREE.MeshStandardMaterial({
        color: "#eef7ff",
        alphaMap: cloudMap,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
      }),
      "clouds",
    );
    cloudMesh = new THREE.Mesh(
      sharedShellGeometry,
      cloudMaterial,
    );
    cloudMesh.scale.setScalar(radius * 1.012);
    cloudMesh.rotation.z = 0.21;
    group.add(cloudMesh);
  }

  const atmosphere = new THREE.Mesh(
    sharedShellGeometry,
    createAtmosphereMaterial(glowColor, atmosphereIntensity, atmosphereThickness),
  );
  atmosphere.scale.setScalar(radius * 1.035);
  group.add(atmosphere);

  if (ring) {
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(
        radius * 1.32,
        radius * 2.32,
        qualityLevel === "high" ? 192 : 96,
        1,
      ),
      createRingMaterial(radius, seed, position),
    );
    ringMesh.rotation.x = Math.PI * 0.34;
    ringMesh.rotation.y = -0.36;
    group.add(ringMesh);
  }

  scene.add(group);
  celestialBodies.push({ group, mesh, cloudMesh, rotationSpeed });
  // Recorded so the star field can carve itself out of the volume in front of
  // each body; see addStarLayer.
  occluders.push({ center: new THREE.Vector3(...position), radius: radius * 1.04 });
  if (info) registerTarget(info, position, radius);
  return group;
}

function addNebula(position, scale, color, opacity = 0.36, seed = 5) {
  // One billboard reads as a decal pasted onto the sky. Three copies of the same
  // filament bake, rotated and offset against each other, interfere into
  // something with apparent depth for the price of two extra draw calls.
  const map = createNebulaTexture(color, seed);
  const layers = [
    { scale: 1, rotation: 0, weight: 0.52, offset: [0, 0, 0] },
    { scale: 1.36, rotation: 2.2, weight: 0.3, offset: [scale * 0.1, -scale * 0.07, -scale * 0.16] },
    { scale: 0.74, rotation: 4.4, weight: 0.26, offset: [-scale * 0.09, scale * 0.06, scale * 0.13] },
  ];

  layers.forEach((layer) => {
    const layerOpacity = opacity * layer.weight;
    const material = new THREE.SpriteMaterial({
      map,
      transparent: true,
      opacity: layerOpacity,
      rotation: layer.rotation,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    discardStrictlyTransparentFragments(material, "nebula");
    const sprite = new THREE.Sprite(material);
    sprite.position.set(
      position[0] + layer.offset[0],
      position[1] + layer.offset[1],
      position[2] + layer.offset[2],
    );
    sprite.scale.set(scale * layer.scale, scale * layer.scale * 0.72, 1);
    // A billboard cannot be flown through: once the camera is inside it, the
    // additive haze just washes out whatever lies beyond. Dissolve it instead.
    registerFadingSprite(sprite, { baseOpacity: layerOpacity, fadeRadius: scale * 1.2 });
  });
}

function addAsteroidBelt(center, innerRadius, outerRadius, seed) {
  const count = qualityProfiles[qualityLevel].asteroids;
  if (count === 0) return;

  // One subdivision keeps the silhouette irregular under non-uniform scaling;
  // the bare icosahedron read as a paper cutout at flyby range.
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const material = new THREE.MeshStandardMaterial({
    // Asteroid albedo sits well below the pale tone used before, which made the
    // belt the brightest thing on screen, but charcoal loses it against space.
    color: "#584f42",
    roughness: 0.96,
    metalness: 0.04,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const translation = new THREE.Vector3();
  const scaling = new THREE.Vector3();
  const tone = new THREE.Color();
  const random = mulberry32(seed);

  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = innerRadius + Math.pow(random(), 0.7) * (outerRadius - innerRadius);
    const size = 0.3 + Math.pow(random(), 2.8) * 2.2;
    translation.set(
      center[0] + Math.cos(angle) * radius,
      center[1] + (random() - 0.5) * radius * 0.5,
      center[2] + Math.sin(angle) * radius * 0.85,
    );
    euler.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    quaternion.setFromEuler(euler);
    scaling.set(size, size * (0.6 + random() * 0.6), size * (0.7 + random() * 0.5));
    matrix.compose(translation, quaternion, scaling);
    mesh.setMatrixAt(index, matrix);
    // Instance colour only modulates the material albedo, so the belt still
    // darkens even where instancing colour is unavailable.
    // Rock this far out reflects under a tenth of what falls on it. Lit by a key
    // this strong, a mid-grey albedo came back near white and the belt crossed
    // the frame as a field of evenly bright pebbles with no shadow in any of
    // them — and it did it in front of Earth, which by then is the subject.
    // Dark albedo under a hard light is what gives each one a lit face and a
    // black one, which is the whole reason to draw them faceted.
    tone.setHSL(0.07 + random() * 0.04, 0.05 + random() * 0.1, 0.2 + Math.pow(random(), 1.5) * 0.3);
    mesh.setColorAt(index, tone);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  asteroidField = mesh;
  scene.add(mesh);
}

// Dust rides with the camera so parallax reads even in otherwise empty space.
function addSpaceDust() {
  const count = qualityProfiles[qualityLevel].dust;
  if (count === 0) return;

  const positions = new Float32Array(count * 3);
  const drift = new Float32Array(count);
  const random = mulberry32(2411);

  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (random() - 0.5) * 90;
    positions[index * 3 + 1] = (random() - 0.5) * 60;
    positions[index * 3 + 2] = -random() * 150;
    drift[index] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aDrift", new THREE.BufferAttribute(drift, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: frameUniforms.time,
      uPixelRatio: viewportUniforms.pixelRatio,
      uSpeed: { value: 0 },
      uFade: { value: 1 },
    },
    vertexShader: `
      attribute float aDrift;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uSpeed;
      varying float vFade;

      void main() {
        vec3 animated = position;
        animated.x += sin(uTime * 0.35 + aDrift * 12.0) * 1.6;
        animated.y += cos(uTime * 0.29 + aDrift * 9.0) * 1.2;
        animated.z = mod(animated.z + uTime * (2.0 + aDrift * 3.0) * (0.4 + uSpeed * 6.0), 150.0) - 150.0;
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        // Faded at both ends of the corridor. The near ramp keeps a mote from
        // swelling across the lens as it passes; the far one covers the wrap
        // above, which teleports a mote that has gone by back to the far plane.
        // Without it the mote reappears there at full strength, and with the
        // whole field cycling that is a steady scatter of specks blinking into
        // existence — the same read as a flickering star.
        float depthFade = smoothstep(-4.0, -30.0, viewPosition.z)
          * (1.0 - smoothstep(-130.0, -150.0, viewPosition.z));
        vFade = depthFade * (0.35 + aDrift * 0.65);
        // Widened and dimmed per SPRITE_MIN_PIXELS, as the star layers are.
        float pointSize = (0.9 + aDrift * 1.7) * uPixelRatio * clamp(60.0 / -viewPosition.z, 0.4, 2.4);
        float widened = max(pointSize, ${SPRITE_MIN_PIXELS});
        vFade *= max((pointSize * pointSize) / (widened * widened), ${SPRITE_DIM_FLOOR});
        gl_PointSize = widened;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uFade;
      varying float vFade;

      void main() {
        float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
        float alpha = (1.0 - smoothstep(0.1, 0.5, distanceToCenter)) * vFade * uFade;
        if (alpha < 0.01) discard;
        // Faint on purpose: these motes sit between the camera and everything
        // else, so at full strength they read as stars stuck to a planet's disc.
        gl_FragColor = vec4(vec3(0.78, 0.88, 1.0), alpha * 0.19);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  dustField = new THREE.Points(geometry, material);
  dustField.frustumCulled = false;
  camera.add(dustField);
}

function addSpiralGalaxy(centerZ) {
  const counts = { high: 9000, balanced: 5200, eco: 2400 };
  const count = counts[qualityLevel];
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const random = mulberry32(7319);
  const warm = new THREE.Color("#ffe1b8");
  const blue = new THREE.Color("#79c7ff");
  const violet = new THREE.Color("#a779ff");
  const color = new THREE.Color();
  // Two arms, as in a grand-design spiral. The previous five were wound at a
  // fixed angle-per-unit-radius, which is an Archimedean spiral rather than the
  // logarithmic one a galaxy actually forms, and at that pitch each arm closed a
  // full turn every 120 units and came back around on top of itself. Five of
  // them overlapping that way left no gap anywhere: the arms stopped reading as
  // arms and the galaxy became a set of concentric dotted rings, which is the
  // single thing in the frame that most looked like a diagram.
  const armCount = 2;
  const outerRadius = 184;
  // Winds the arms about three quarters of a turn from core to rim — enough to
  // curve clearly, not enough to wrap back over themselves.
  const windingRate = 1.55;
  const candidate = new THREE.Vector3();
  let written = 0;

  for (let index = 0; index < count; index += 1) {
    // A quarter of the population ignores the arms: a bulge at the core and a
    // thin scatter between the arms. Real spirals are not empty in between, and
    // the gaps between two arms are wide enough to look cut out without it.
    const isField = index % 4 === 3;
    const radius = 3 + Math.pow(random(), isField ? 1.5 : 0.58) * outerRadius;
    const normalizedRadius = radius / outerRadius;
    // Arms broaden with distance from the core and blur out entirely at the rim,
    // so they end by dissolving rather than stopping.
    const spread = 0.16 + normalizedRadius * 0.85;
    const angle = isField
      ? random() * Math.PI * 2
      : (index % armCount) * Math.PI +
        Math.log(radius / 3) * windingRate +
        (random() - 0.5) * spread;
    const thickness = (random() - 0.5) * (2.5 + radius * 0.055);
    if (normalizedRadius < 0.28) color.copy(warm).lerp(blue, normalizedRadius / 0.28);
    else color.copy(blue).lerp(violet, (normalizedRadius - 0.28) / 0.72);
    // Arms are where the young, bright stars are; the field between them is
    // older and dimmer. Without this the two populations read as one flat sheet.
    color.multiplyScalar((0.74 + random() * 0.5) * (isField ? 0.5 : 1));
    const size = (0.5 + Math.pow(random(), 5) * 2.3) * (isField ? 0.8 : 1);

    // The arms sit closer to the camera than the planets do, so without this
    // they would sparkle across every disc downstream.
    candidate.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.62, centerZ + thickness);
    if (overlapsOccluder(candidate)) continue;

    const offset = written * 3;
    positions[offset] = candidate.x;
    positions[offset + 1] = candidate.y;
    positions[offset + 2] = candidate.z;
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    sizes[written] = size;
    written += 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions.subarray(0, written * 3), 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors.subarray(0, written * 3), 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes.subarray(0, written), 1));
  galaxyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: frameUniforms.time,
      uPixelRatio: viewportUniforms.pixelRatio,
      uFade: { value: 1 },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      varying vec3 vColor;
      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vColor = aColor;
        vec3 animatedPosition = position;
        animatedPosition.xy += vec2(
          sin(uTime * 0.16 + position.y * 0.03),
          cos(uTime * 0.13 + position.x * 0.03)
        ) * 0.16;
        vec4 viewPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
        // Widened and dimmed per SPRITE_MIN_PIXELS, and needed more here than in
        // the star layers: the drift above never stops, so without it the whole
        // arm carries a standing frame-rate flicker.
        float pointSize = aSize * uPixelRatio * clamp(290.0 / -viewPosition.z, 0.55, 4.5);
        float widened = max(pointSize, ${SPRITE_MIN_PIXELS});
        vColor *= max((pointSize * pointSize) / (widened * widened), ${SPRITE_DIM_FLOOR});
        gl_PointSize = widened;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uFade;
      varying vec3 vColor;

      void main() {
        float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
        float alpha = (1.0 - smoothstep(0.08, 0.5, distanceToCenter)) * uFade;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vColor * (1.15 + alpha * 0.7), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  galaxy = new THREE.Points(geometry, galaxyMaterial);
  galaxy.rotation.z = 0.18;
  scene.add(galaxy);

  // A luminous bed under the arms. Points alone resolve as points at this range
  // however many are drawn, and a galaxy that is only points reads as confetti;
  // the unresolved light between the stars is most of what makes one look like a
  // galaxy. Two broad, very faint sheets are enough to sit the stars in light.
  addNebula([0, 0, centerZ + 2], 185, "rgba(93,126,255,0.55)", 0.22, 31);
  addNebula([-38, 22, centerZ + 6], 250, "rgba(120,150,255,0.42)", 0.1, 88);
  addNebula([44, -26, centerZ + 5], 215, "rgba(150,120,255,0.42)", 0.085, 12);
  addStellarBeacon([0, 0, centerZ + 3], 15, { fadeRadius: 260 });
}

// Plasma tongues climbing off the solar limb. A camera-facing quad rather than
// modelled geometry: the structure is entirely in the noise field, and the star
// is far enough away that anything modelled would be sub-pixel across.
function addSolarProminences(position, solarRadius, intensity) {
  const octaves = qualityProfiles[qualityLevel].octaves;
  const extent = solarRadius * 2 * PROMINENCE_REACH;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: frameUniforms.time,
      uLimb: { value: solarRadius / (extent * 0.5) },
      uIntensity: { value: intensity },
    },
    // Billboarded in the vertex shader, like a sprite: the quad is built in view
    // space from the object's origin, so it needs no per-frame work on the CPU.
    // The geometry carries the real extent so the bounding sphere still culls.
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec4 origin = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        gl_Position = projectionMatrix * (origin + vec4(position.xy, 0.0, 0.0));
      }
    `,
    fragmentShader: `
      #define OCTAVES ${octaves}

      uniform float uTime;
      uniform float uLimb;
      uniform float uIntensity;
      varying vec2 vUv;

      float hash13(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float noise3(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(
            mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
            mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x),
            f.y
          ),
          mix(
            mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
            mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x),
            f.y
          ),
          f.z
        );
      }

      float fbm(vec3 p) {
        float sum = 0.0;
        float amplitude = 0.5;
        for (int index = 0; index < OCTAVES; index += 1) {
          sum += amplitude * noise3(p);
          p *= 2.03;
          amplitude *= 0.5;
        }
        return sum;
      }

      // A prominence follows a magnetic arch: two feet at the limb and a thin,
      // turbulent loop suspended above it. Using an ellipse rather than another
      // radial noise field is what makes these read as solar plasma instead of
      // a fringe of flames.
      float magneticLoop(
        vec2 point,
        float angle,
        float halfWidth,
        float height,
        float seed,
        float rate,
        float phase
      ) {
        // An arch inflates, rises, and subsides again over a few tens of
        // seconds. The amplitude reaches zero at the trough so events genuinely
        // come and go rather than merely breathing in place: as fixed geometry
        // these five arches are the most salient thing on the star, and while
        // they hold still the whole limb reads as a still image however much
        // the noise threaded through them is moving.
        float life = sin(uTime * rate + phase);
        float amplitude = smoothstep(-0.55, 0.5, life);
        if (amplitude <= 0.0) return 0.0;
        height *= 0.7 + 0.36 * life;

        vec2 radial = vec2(cos(angle), sin(angle));
        vec2 tangent = vec2(-radial.y, radial.x);
        float x = dot(point, tangent);
        float y = dot(point, radial) - uLimb;
        vec2 loopPoint = vec2(x / halfWidth, y / height);
        float loopDistance = abs(length(loopPoint) - 1.0);
        float arch = 1.0 - smoothstep(0.035, 0.12, loopDistance);
        float aboveLimb = smoothstep(-0.012, 0.025, y);
        float crown = 1.0 - smoothstep(1.02, 1.16, loopPoint.y);
        float strands = fbm(vec3(loopPoint * vec2(3.2, 1.7), seed + uTime * 0.3));
        strands = 0.42 + smoothstep(0.28, 0.82, strands) * 0.9;
        return arch * aboveLimb * crown * strands * amplitude;
      }

      void main() {
        vec2 offset = vUv * 2.0 - 1.0;
        float radius = length(offset);
        // The corners are outside the reach, and the disc covers everything well
        // inside the limb, so neither is worth shading.
        if (radius > 1.0 || radius < uLimb * 0.9) discard;

        // The star turns and the plumes turn with it. Everything else here only
        // breathes in place — tongues change shape but never travel — and a
        // silhouette that stays put reads as a still image no matter how much
        // the inside of it is moving.
        float spin = uTime * 0.05;
        vec2 turned = vec2(
          offset.x * cos(spin) - offset.y * sin(spin),
          offset.x * sin(spin) + offset.y * cos(spin)
        );
        vec2 heading = turned / max(radius, 0.0001);

        float altitude = max(0.0, (radius - uLimb) / (1.0 - uLimb));

        // A very thin, broken chromosphere connects the disc to the outer gas.
        // It is deliberately irregular so it never becomes a perfect neon ring.
        float rimNoise = fbm(vec3(heading * 4.8, uTime * 0.19));
        float chromosphere = exp(-altitude * 32.0);
        chromosphere *= 0.22 + smoothstep(0.32, 0.78, rimNoise) * 0.7;
        chromosphere *= smoothstep(uLimb * 0.995, uLimb + 0.018, radius);

        // Long, hair-thin coronal streamers. Coarse noise opens only a handful
        // of active sectors; ridged fine noise splits each one into strands.
        // Scroll rates have to be read against how much of each axis the plume
        // actually spans, not taken as speeds. Altitude runs 0 to 1 here, so at
        // the 0.11 the flow started on, a feature needed twenty seconds to climb
        // from limb to tip; the sector gate, spanning 0.45 of a unit at 0.025,
        // took the better part of a minute to open or close. Both were slower
        // than the star is ever on screen for.
        float curl = noise3(vec3(heading * 1.35, altitude * 0.8 + uTime * 0.13));
        vec3 flow = vec3(heading * 3.1, altitude * 2.2 - uTime * 0.55);
        float coarse = fbm(vec3(heading * 1.2, altitude * 0.45 - uTime * 0.13));
        float fine = fbm(flow + (curl - 0.5) * 2.8);
        float ridges = 1.0 - abs(fine * 2.0 - 1.0);
        float sectorGate = smoothstep(0.5, 0.76, coarse);
        float filaments = smoothstep(0.58, 0.9, ridges) * sectorGate;
        float streamerReach = pow(max(0.0, 1.0 - altitude), 2.35);
        float streamers = filaments * streamerReach;
        streamers *= smoothstep(uLimb + 0.005, uLimb + 0.055, radius);

        // Several differently sized magnetic arches keep the silhouette
        // asymmetric. Paired nearby arcs make the larger events look braided.
        // Evaluated in the turned frame with everything else, so the arches ride
        // around the limb with the star rather than hanging off a fixed point of
        // the screen. Rates are deliberately unrelated, so the five never fall
        // into step with each other.
        float loops = 0.0;
        loops += magneticLoop(turned, 0.18, 0.105, 0.16, 1.2, 0.37, 0.0);
        loops += magneticLoop(turned, 0.22, 0.078, 0.125, 2.7, 0.52, 2.1) * 0.72;
        loops += magneticLoop(turned, 1.72, 0.068, 0.10, 4.1, 0.44, 4.3) * 0.74;
        loops += magneticLoop(turned, 3.42, 0.135, 0.205, 6.3, 0.31, 1.2) * 0.9;
        loops += magneticLoop(turned, 4.92, 0.085, 0.13, 8.8, 0.48, 5.6) * 0.78;

        float plasma = chromosphere + streamers * 0.82 + loops * 1.25;
        if (plasma < 0.004) discard;

        // Hot feet approach yellow-white; suspended gas cools through orange
        // into deep red. This matches the AIA 304 texture without flattening all
        // three layers into the same colour.
        vec3 cool = vec3(0.92, 0.055, 0.008);
        vec3 warm = vec3(1.0, 0.28, 0.025);
        vec3 hot = vec3(1.0, 0.82, 0.34);
        vec3 tint = mix(warm, cool, smoothstep(0.18, 0.9, altitude));
        tint = mix(tint, hot, exp(-altitude * 13.0) * 0.72);
        float energy = chromosphere * 0.75 + streamers + loops * 1.2;
        gl_FragColor = vec4(tint * energy * uIntensity, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  });

  const flames = new THREE.Mesh(new THREE.PlaneGeometry(extent, extent), material);
  flames.position.set(...position);
  scene.add(flames);
  return flames;
}

function addStellarBeacon(position, size, options = {}) {
  const {
    coreColor = "#c9f6ff",
    haloColor = "#7baeff",
    innerStop = "rgba(95,211,255,0.72)",
    outerStop = "rgba(66,121,255,0.2)",
    spikes = true,
    // A photographic disc drawn over the glow, for a star close enough to resolve.
    photosphere = null,
    photosphereScale = 0.34,
    // The disc hides everything inside its own radius, so a star that resolves
    // needs its corona sized independently or the entire bright half of the
    // gradient ends up buried and the limb sits against empty space.
    coronaScale = 1,
    // Intensity of the plasma tongues around the limb; 0 leaves them off.
    prominences = 0,
    // Where the disc sits on the tone curve decides how much of its limb
    // darkening survives. Mapped at full value the whole disc lands above the
    // ACES knee, which compresses a 34% falloff into 6% on screen and hands back
    // a flat matte ball; the texture's gradient is intact, it is being tone
    // mapped away. Trimming here drops it onto the responsive stretch.
    // Per-channel scale on the baked disc. The overall level decides where the
    // disc lands on the tone curve; the imbalance between the channels is what
    // survives it as colour. ACES pulls the three channels toward each other as
    // they climb, so a disc scaled neutrally at a level this high comes back out
    // white however golden the texture underneath it is.
    photosphereGain = [1, 1, 1],
    // Set for stars the flight path passes through rather than approaches.
    fadeRadius = 0,
    // Only a star with a resolvable disc is worth aiming at; see addCelestialBody.
    info = null,
    // Distant stars are a pinprick inside a wide halo. A body with a resolvable
    // disc, like the sun, overrides these stops to widen the solid core.
    stops = [
      [0, "rgba(255,255,255,1)"],
      [0.03, "rgba(220,251,255,0.95)"],
      [0.09, innerStop],
      [0.24, outerStop],
      [1, "rgba(19,32,98,0)"],
    ],
  } = options;

  const textureKey = JSON.stringify([spikes, stops]);
  const glowTexture = getOrCreate(stellarTextureCache, textureKey, () =>
    createCanvasTexture((context, textureSize) => {
      const center = textureSize / 2;
      const gradient = context.createRadialGradient(center, center, 0, center, center, center);
      stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
      context.fillStyle = gradient;
      context.fillRect(0, 0, textureSize, textureSize);

      if (!spikes) return;

      // Soft diffraction spikes sell the "captured through a lens" look.
      context.globalCompositeOperation = "lighter";
      const spikeGradient = context.createLinearGradient(0, center, textureSize, center);
      spikeGradient.addColorStop(0, "rgba(255,255,255,0)");
      spikeGradient.addColorStop(0.5, "rgba(255,255,255,0.32)");
      spikeGradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = spikeGradient;
      context.fillRect(0, center - textureSize * 0.0035, textureSize, textureSize * 0.007);
      context.save();
      context.translate(center, center);
      context.rotate(Math.PI / 2);
      context.translate(-center, -center);
      context.fillRect(0, center - textureSize * 0.002, textureSize, textureSize * 0.004);
      context.restore();
      context.globalCompositeOperation = "source-over";
    }, 384),
  );

  // Prominences are drawn before the halo so the corona sits over their roots,
  // which is what keeps the tongues looking attached to the limb.
  if (prominences > 0) {
    addSolarProminences(position, (size * photosphereScale * 0.5) / DISC_CROP_MARGIN, prominences);
  }

  // Distance fog tints toward near-black, which on an additive sprite erases the
  // star entirely. Stars are light sources, so they opt out of fog.
  const glow = new THREE.Sprite(getStellarMaterial(glowTexture, coreColor, 1));
  glow.position.set(...position);
  glow.scale.set(size * coronaScale, size * coronaScale, 1);
  registerFadingSprite(glow, { fadeRadius });

  const rays = new THREE.Sprite(getStellarMaterial(glowTexture, haloColor, 0.16));
  rays.position.set(...position);
  rays.scale.set(size * 3.4, size * 0.09, 1);
  registerFadingSprite(rays, { baseOpacity: 0.16, fadeRadius });

  if (photosphere) {
    // Normal blending, drawn after the halo, so the sunspots read as dark
    // against the surface instead of being added into the glow.
    const discMaterial = new THREE.SpriteMaterial({
      map: photosphere,
      color: new THREE.Color(...photosphereGain),
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    // The bake fades the disc out over a wide ramp so the limb dissolves into
    // the corona, but the ramp opens well inside the limb and stays partly open
    // past it, where the texture has already fallen to the near-black it uses
    // beyond the edge. That band is a seventh of the radius of half-transparent
    // near-black over a saturated corona, and it reads as a grey ring around the
    // star. Steepening the curve keeps the disc solid out to the limb and closes
    // it immediately after, without touching the baked texture.
    discMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <alphatest_fragment>",
        "diffuseColor.a = smoothstep(0.2, 0.8, diffuseColor.a);\n#include <alphatest_fragment>",
      );
    };
    discardStrictlyTransparentFragments(discMaterial, "photosphere");
    const disc = new THREE.Sprite(discMaterial);
    disc.position.set(...position);
    disc.scale.set(size * photosphereScale, size * photosphereScale, 1);
    disc.renderOrder = 1;
    // A star with a resolvable disc occludes the star field like a planet does.
    occluders.push({
      center: new THREE.Vector3(...position),
      radius: size * photosphereScale * 0.5,
    });
    if (info) registerTarget(info, position, size * photosphereScale * 0.5);
    // Deliberately not an eco-dimmed sprite: fading the surface would let the
    // halo bleed through and wash the sunspots out.
    scene.add(disc);
  }

  return glow;
}

function addWarpTunnel() {
  const lineCount = qualityLevel === "eco" ? 70 : qualityLevel === "balanced" ? 120 : 180;
  const positions = new Float32Array(lineCount * 6);
  const colors = new Float32Array(lineCount * 6);
  const random = mulberry32(404);

  for (let index = 0; index < lineCount; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 8 + Math.pow(random(), 0.58) * 80;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.62;
    const z = -24 - random() * 260;
    const offset = index * 6;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    positions[offset + 3] = x * 1.02;
    positions[offset + 4] = y * 1.02;
    positions[offset + 5] = z + 3 + random() * 11;

    // Uniform brightness along a segment reads as a scratch on the lens. Fading
    // the leading end to black turns each one into a trail, and varying the peak
    // stops them from looking stamped from one template.
    const peak = 0.35 + random() * 0.65;
    colors[offset] = 0;
    colors[offset + 1] = 0;
    colors[offset + 2] = 0;
    colors[offset + 3] = peak;
    colors[offset + 4] = peak;
    colors[offset + 5] = peak;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    color: "#bcefff",
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  warpLines = new THREE.LineSegments(geometry, material);
  warpLines.frustumCulled = false;
  warpLines.visible = false;
  camera.add(warpLines);
}

async function buildScene() {
  const profile = qualityProfiles[qualityLevel];
  sharedSurfaceGeometry = getSphereGeometry(profile.sphere[0], profile.sphere[1]);
  sharedShellGeometry = getSphereGeometry(profile.atmosphere[0], profile.atmosphere[1]);
  const photographicSurfaces = loadPhotographicSurfaces();
  setLoading(12, "PLOTTING THE CORRIDOR…");
  addWarpTunnel();
  addSpaceDust();
  await nextFrame();

  // Saturn is the only planet still generated rather than photographed, so it is
  // baked while the photographic maps are still in flight.
  setLoading(30, "SPREADING THE PLANETARY RINGS…");
  addCelestialBody({
    radius: 78,
    // Below the flight axis on purpose: the sun sits up and to the left, and at
    // this size the planet and its rings eclipse it for the whole first half.
    position: offAxis(-302, -148, -648),
    // Saturn's belts are far lower contrast than Jupiter's; a dark end near
    // black turns the zonal banding into humbug stripes.
    surface: createPlanetSurface("gas", 8, [
      [138, 106, 70],
      [186, 152, 104],
      [216, 192, 148],
      [238, 226, 200],
    ]),
    glowColor: "#ffc77c",
    info: {
      name: "SATURN",
      kind: "RINGED GIANT",
      stat: "R 58,232 KM",
      note: "Rings 70,000 km across and only tens of metres thick.",
    },
    ring: true,
    emissive: 0.03,
    atmosphereIntensity: 0.62,
    rotationSpeed: 0.0011,
    limbDarkening: 0.6,
    detail: 1.3,
    seed: 8,
  });
  await nextFrame();

  setLoading(52, "RECEIVING PLANETARY IMAGERY…");
  const surfaces = await photographicSurfaces;

  // The hero flyby: the path skims roughly 90 units above Jupiter's cloud tops,
  // so it swells to fill most of the frame before falling behind.
  addCelestialBody({
    radius: 118,
    position: offAxis(204, -54, -430),
    surface:
      surfaces.jupiter ??
      createPlanetSurface("gas", 17, [
        [64, 46, 36],
        [156, 116, 72],
        [204, 174, 124],
        [228, 212, 182],
      ]),
    glowColor: "#ffd6a4",
    info: {
      name: "JUPITER",
      kind: "GAS GIANT",
      stat: "R 69,911 KM",
      note: "Its Great Red Spot has raged for three centuries.",
    },
    emissive: 0.02,
    atmosphereIntensity: 0.5,
    atmosphereThickness: 3.6,
    rotationSpeed: 0.0009,
    // The largest disc in the film and the one lit closest to head-on, so it has
    // the least shadow of its own to go on.
    limbDarkening: 0.68,
    detail: 3,
    seed: 17,
  });
  await nextFrame();

  setLoading(64, "RENDERING THE RED PLANET…");
  addCelestialBody({
    radius: 30,
    position: offAxis(-149, -66, -742),
    surface:
      surfaces.mars ??
      createPlanetSurface("rock", 29, [
        [46, 24, 16],
        [124, 62, 38],
        [186, 108, 72],
        [226, 176, 148],
      ]),
    glowColor: "#ff9f6b",
    info: {
      name: "MARS",
      kind: "TERRESTRIAL",
      stat: "R 3,390 KM",
      note: "Olympus Mons rises 22 km, the tallest volcano known.",
    },
    emissive: 0.02,
    atmosphereIntensity: 0.3,
    atmosphereThickness: 4.2,
    rotationSpeed: 0.0006,
    limbDarkening: 0.34,
    seed: 29,
  });

  addAsteroidBelt(offAxis(31, 4, -812), 34, 96, 613);
  await nextFrame();

  setLoading(74, "RECEIVING EARTH IMAGERY…");

  addCelestialBody({
    radius: 16,
    position: offAxis(168, -48, -930),
    surface:
      surfaces.moon ??
      createPlanetSurface("rock", 2, [
        [46, 44, 42],
        [118, 114, 108],
        [186, 182, 172],
        [232, 230, 224],
      ]),
    glowColor: "#dce7ef",
    info: {
      name: "LUNA",
      kind: "NATURAL SATELLITE",
      stat: "R 1,737 KM",
      note: "Tidally locked; one face never turns away from Earth.",
    },
    atmosphereIntensity: 0.16,
    atmosphereThickness: 4.6,
    rotationSpeed: 0.0004,
    // Regolith backscatters strongly toward the light: a full moon really is
    // close to uniformly bright across its disc.
    limbDarkening: 0.12,
    seed: 2,
  });

  setLoading(80, "RESTORING EARTH…");
  addCelestialBody({
    radius: 38,
    position: [0, 0, -1048],
    surface: surfaces.earth ?? createPlanetSurface("earth", 1984),
    glowColor: "#4fc7ff",
    info: {
      name: "EARTH",
      kind: "HOME · DESTINATION",
      stat: "R 6,371 KM",
      note: "The only world confirmed to hold life. Journey's end.",
    },
    emissive: 0.015,
    clouds: true,
    atmosphereIntensity: 0.8,
    atmosphereThickness: 3.2,
    rotationSpeed: 0.0005,
    // Held back: this disc fills the frame at the hand-off and has a terminator
    // of its own to shape it, so the limb only needs settling, not darkening.
    limbDarkening: 0.26,
    seed: 1984,
  });
  await nextFrame();

  setLoading(84, "LIGHTING STARS AND NEBULAE…");
  addNebula([-95, 35, -610], 330, "rgba(91,76,255,0.55)", 0.34, 3);
  addNebula([115, -25, -745], 370, "rgba(224,67,255,0.55)", 0.26, 11);
  addNebula([-30, 38, -875], 320, "rgba(49,224,255,0.55)", 0.2, 19);
  addStellarBeacon([-78, 34, -782], 34);

  // Anchor the key light to a visible star so shading and art direction agree.
  // 420 keeps the sun ~20 degrees off the flight axis and framed for the first
  // half of the trip; at 900 it sat on the frame edge and left within ten seconds.
  const sunDistance = 420;
  sunWorldPosition = new THREE.Vector3(
    sunDirection.x * sunDistance,
    sunDirection.y * sunDistance,
    -1048 + sunDirection.z * sunDistance,
  );
  addStellarBeacon(
    sunWorldPosition.toArray(),
    // Everything about the star is expressed as a fraction of this — corona,
    // photosphere, prominence reach, occluder — so growing it here keeps all the
    // ratios those were calibrated against.
    325,
    {
      // Keep the unresolved core white; the resolved disc below uses NASA's
      // red-orange AIA 304 Å data so its surface and eruptions remain visible.
      coreColor: "#ffffff",
      haloColor: "#ffd9a6",
      // Diffraction spikes are a point-source artifact. On a star resolved to
      // several hundred pixels they draw a hard cross over the disc that reads
      // as a reticle rather than as a lens, so the sun keeps only its halo.
      spikes: false,
      // The photosphere texture supplies the disc, so these stops only have to
      // describe the corona around it. With the corona at twice the beacon size
      // the limb lands at 0.317 of the gradient, so full strength is held to
      // just past that and everything after is the halo: a steep first drop for
      // the bright ring against the limb, then a long tail out to three solar
      // radii. Anchoring these to the wrong radius is what buried the entire
      // bright half of the corona behind the disc and left the limb ending on a
      // hard edge against empty space.
      // The level at the limb matters more than the shape: a corona brighter
      // than the disc it surrounds turns limb darkening into a dark ring, since
      // the eye reads the rim against the halo rather than against the disc.
      // These are set to hand off at roughly the brightness the darkened limb
      // arrives at, then decay to nothing by three solar radii.
      stops: [
        [0, "rgba(255,244,214,0.5)"],
        [0.26, "rgba(255,238,198,0.42)"],
        [0.315, "rgba(255,230,182,0.15)"],
        [0.36, "rgba(255,224,172,0.055)"],
        [0.46, "rgba(255,218,166,0.032)"],
        [0.62, "rgba(255,212,160,0.014)"],
        [0.8, "rgba(255,208,156,0.006)"],
        [1, "rgba(255,206,154,0)"],
      ],
      coronaScale: 2,
      // The replacement texture is already colour-mapped. A neutral gain keeps
      // its gold/black contrast instead of tinting it a second time.
      photosphereGain: [1, 1, 1],
      prominences: 0.68,
      photosphere: surfaces.sun,
      info: {
        name: "SOL",
        kind: "G2V MAIN SEQUENCE",
        stat: "R 696,340 KM",
        note: "A 5,800 K photosphere — the source of all our light.",
      },
      // At a third of this it was 40 px of screen and bloom turned the
      // granulation and sunspots into a featureless white ball.
      photosphereScale: 0.66,
    },
  );
  await nextFrame();

  // Built last so every planet and the sun are registered as occluders. The
  // flythrough layers also stop short of Earth; a separate backdrop sits behind it.
  setLoading(92, "LIGHTING THE STAR FIELD…");
  prepareFlightOcclusionSamples();
  addSpiralGalaxy(-190);
  // Near-white layer tints: each star now carries its own colour temperature,
  // and a saturated layer colour would multiply the warm ones into mud.
  addStarLayer(profile.stars[0], 920, 0.72, "#f2f7ff", 12);
  addStarLayer(profile.stars[1], 680, 1.35, "#ffffff", 47);
  if (profile.stars[2] > 0) {
    addStarLayer(profile.stars[2], 520, 1.8, "#e8f0ff", 91).forEach((layer) => {
      layer.userData.optional = true;
    });
  }
  addStarLayer(profile.stars[1], 1500, 1.05, "#f0f6ff", 173, { near: -1180, far: -1750 });
  // The run-in crosses empty sky, which is the point, but with nothing close
  // enough to shift against the camera it reads as a still frame for a quarter
  // of the flight. A third of the corridor's count over twice its spread gives
  // the parallax back without filling the emptiness in.
  addStarLayer(Math.round(profile.stars[0] / 3), 1350, 0.86, "#eaf1ff", 229, {
    near: journeyStartZ + 140,
    far: 60,
  });

  const keyLight = new THREE.DirectionalLight("#fff2dc", 4.2);
  keyLight.position.copy(sunDirection).multiplyScalar(100);
  scene.add(keyLight);

  // There is nothing out here to bounce light back onto a night side, and the
  // fill this used to carry was strong enough to raise each body's albedo out of
  // shadow — Saturn's cloud bands were legible right across its dark face, in
  // blue, which is the single thing that most made these read as lit models
  // rather than worlds. What is left is a trace: enough that a silhouette does
  // not fall to a flat black hole in the frame, not enough to compete with the
  // key. Deep shadow is the point.
  const rimLight = new THREE.DirectionalLight("#4d7bff", 0.06);
  rimLight.position.copy(sunDirection).multiplyScalar(-100);
  scene.add(rimLight);
  scene.add(new THREE.AmbientLight("#2b466d", 0.028));
  scene.add(new THREE.HemisphereLight("#4f9bf5", "#0d0722", 0.05));

  setLoading(95, "BRINGING SHIP SYSTEMS ONLINE…");
  await nextFrame();
}

function freezeStaticSceneTransforms() {
  // Object3D.updateMatrixWorld calls updateMatrix on every object whose local
  // transform is automatic, even when that transform has never changed. Most of
  // this scene is static; shader time and parent camera motion provide its
  // animation. Bake those local matrices once while leaving the small set of
  // genuinely moving objects automatic.
  const movingObjects = new Set([
    camera,
    galaxy,
    asteroidField,
    warpLines,
    ...starLayers,
  ]);
  celestialBodies.forEach(({ group, mesh, cloudMesh }) => {
    movingObjects.add(group);
    movingObjects.add(mesh);
    if (cloudMesh) movingObjects.add(cloudMesh);
  });

  scene.traverse((object) => {
    if (movingObjects.has(object)) return;
    object.updateMatrix();
    object.matrixAutoUpdate = false;
  });
}

function initRenderer() {
  const profile = qualityProfiles[qualityLevel];
  const { width, height } = getViewportSize();
  renderer = new THREE.WebGLRenderer({
    canvas,
    // The scene is rendered into a non-MSAA post target. Enabling MSAA on the
    // final canvas therefore allocates extra buffers without smoothing geometry.
    antialias: false,
    alpha: false,
    depth: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(getTargetPixelRatio(profile, width, height));
  // CSS owns the display size (including the fullscreen letterbox). Do not bake
  // the initial window dimensions into inline canvas styles, or they survive the
  // fullscreen resize and stretch/crop an otherwise-correct backing buffer.
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Scene renders linear into the HDR buffer; tone mapping happens in the composite pass.
  renderer.toneMapping = THREE.NoToneMapping;
  gpuBenchmark = new GpuFrameBenchmark(renderer);

  scene = new THREE.Scene();
  scene.background = new THREE.Color("#01030a");
  scene.fog = new THREE.FogExp2("#030712", 0.00115);
  renderer.autoClear = false;
  renderer.setClearColor(scene.background, 1);

  camera = new THREE.PerspectiveCamera(
    compactDevice ? 66 : 58,
    width / height,
    0.1,
    // Far enough to hold the backdrop star layer from the new start point. Star
    // materials carry no fog, so anything the frustum cuts there would visibly
    // pop in rather than fade up as the ship closes.
    2500,
  );
  camera.position.set(0, 0, journeyStartZ);
  scene.add(camera);
  clock = new THREE.Clock();
  updateQualityUi();
}

// One buffer of white noise, shared by the plasma layer and both cues. Two
// seconds outlasts the longest sweep and is cheap enough to fill on demand.
function getNoiseBuffer(context) {
  if (noiseBuffer) return noiseBuffer;
  const samples = Math.floor(context.sampleRate * 2);
  noiseBuffer = context.createBuffer(1, samples, context.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let index = 0; index < samples; index += 1) channel[index] = Math.random() * 2 - 1;
  return noiseBuffer;
}

function createAudioEngine() {
  if (audio) return audio;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  const context = new AudioContext();
  const master = context.createGain();
  const musicGain = context.createGain();
  const engineGain = context.createGain();
  const sfxGain = context.createGain();
  const filter = context.createBiquadFilter();
  const oscillatorA = context.createOscillator();
  const oscillatorB = context.createOscillator();
  const music = new Audio("./aphelion-flight.mp3");
  const musicSource = context.createMediaElementSource(music);

  master.gain.value = 0;
  musicGain.gain.value = MUSIC_LEVEL;
  engineGain.gain.value = ENGINE_LEVEL;
  // Cues are mixed under the score rather than over it: ignition and touchdown
  // are events in the same room, not a separate trailer.
  sfxGain.gain.value = 0.58;
  filter.type = "lowpass";
  filter.frequency.value = 180;
  oscillatorA.type = "sawtooth";
  oscillatorA.frequency.value = 42;
  oscillatorB.type = "sine";
  oscillatorB.frequency.value = 57;
  music.loop = true;
  music.preload = "auto";

  musicSource.connect(musicGain);
  musicGain.connect(master);
  oscillatorA.connect(engineGain);
  oscillatorB.connect(engineGain);
  engineGain.connect(filter);
  filter.connect(master);
  sfxGain.connect(master);

  // Re-entry plasma: a band of noise whose level rides the same curve as the
  // heat shader, with an LFO on it so the roar shakes with the hull instead of
  // sitting under the buffeting as a flat hiss.
  const entrySource = context.createBufferSource();
  const entryBand = context.createBiquadFilter();
  const entryGain = context.createGain();
  const buffetLfo = context.createOscillator();
  const buffetDepth = context.createGain();
  entrySource.buffer = getNoiseBuffer(context);
  entrySource.loop = true;
  entryBand.type = "bandpass";
  entryBand.frequency.value = 760;
  entryBand.Q.value = 0.65;
  entryGain.gain.value = 0;
  buffetLfo.type = "sine";
  buffetLfo.frequency.value = 11.5;
  buffetDepth.gain.value = 0;
  entrySource.connect(entryBand).connect(entryGain).connect(master);
  buffetLfo.connect(buffetDepth).connect(entryGain.gain);

  master.connect(context.destination);
  oscillatorA.start();
  oscillatorB.start();
  entrySource.start();
  buffetLfo.start();

  audio = {
    context,
    master,
    filter,
    musicGain,
    engineGain,
    sfxGain,
    entryGain,
    buffetDepth,
    oscillatorA,
    oscillatorB,
    music,
    enabled: false,
  };
  return audio;
}

// Four compact "systems online" gestures mirror the panel boot delays in CSS:
// left propulsion, right navigation, gunsight, then the trajectory tape. Each
// combines a relay snap with a short descending servo; the final two-note chirp
// confirms the cockpit as a whole rather than making every panel beep.
function playCockpitBootCue() {
  if (!audio || audio.context.state !== "running") return;
  const { context, sfxGain } = audio;
  const start = context.currentTime + 0.04;
  const stages = [
    { at: 0, pan: -0.62, pitch: 138 },
    { at: 0.14, pan: 0.62, pitch: 156 },
    { at: 0.28, pan: 0, pitch: 174 },
    { at: 0.42, pan: 0, pitch: 118 },
  ];

  stages.forEach(({ at, pan, pitch }, index) => {
    const when = start + at;
    const relay = context.createBufferSource();
    const relayFilter = context.createBiquadFilter();
    const relayGain = context.createGain();
    const servo = context.createOscillator();
    const servoFilter = context.createBiquadFilter();
    const servoGain = context.createGain();
    const output = context.createGain();
    const panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;

    relay.buffer = getNoiseBuffer(context);
    relayFilter.type = "bandpass";
    relayFilter.frequency.value = 1900 + index * 420;
    relayFilter.Q.value = 2.4;
    relayGain.gain.setValueAtTime(0.13, when);
    relayGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.055);

    servo.type = index === 3 ? "triangle" : "sawtooth";
    servo.frequency.setValueAtTime(pitch, when);
    servo.frequency.exponentialRampToValueAtTime(pitch * 0.46, when + 0.34);
    servoFilter.type = "lowpass";
    servoFilter.frequency.setValueAtTime(920, when);
    servoFilter.frequency.exponentialRampToValueAtTime(260, when + 0.34);
    servoGain.gain.setValueAtTime(0.0001, when);
    servoGain.gain.exponentialRampToValueAtTime(index === 3 ? 0.055 : 0.075, when + 0.025);
    servoGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.38);

    output.gain.value = 0.62;
    relay.connect(relayFilter).connect(relayGain).connect(output);
    servo.connect(servoFilter).connect(servoGain).connect(output);
    if (panner) {
      panner.pan.value = pan;
      output.connect(panner).connect(sfxGain);
    } else {
      output.connect(sfxGain);
    }

    relay.start(when);
    relay.stop(when + 0.065);
    servo.start(when);
    servo.stop(when + 0.4);
  });

  [659.25, 987.77].forEach((frequency, index) => {
    const tone = context.createOscillator();
    const toneGain = context.createGain();
    const when = start + 0.78 + index * 0.11;
    tone.type = "sine";
    tone.frequency.value = frequency;
    toneGain.gain.setValueAtTime(0.0001, when);
    toneGain.gain.exponentialRampToValueAtTime(0.105, when + 0.025);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    tone.connect(toneGain).connect(sfxGain);
    tone.start(when);
    tone.stop(when + 0.24);
  });
}

// Ignition, in three layers: a sub that drops as the drive catches, a noise band
// that opens upward for the acceleration, and a short bright transient so the cue
// has an attack rather than only a swell.
function playLaunchCue() {
  if (!audio || audio.context.state !== "running") return;
  const { context, sfxGain } = audio;
  // Sound comes up over half a second, and an ignition scheduled at zero spends
  // its attack inside that ramp. The cue waits for the mix to arrive.
  const start = context.currentTime + 0.35;

  const sub = context.createOscillator();
  const subGain = context.createGain();
  sub.type = "sine";
  sub.frequency.setValueAtTime(126, start);
  sub.frequency.exponentialRampToValueAtTime(34, start + 1.9);
  subGain.gain.setValueAtTime(0.0001, start);
  subGain.gain.exponentialRampToValueAtTime(1.15, start + 0.18);
  subGain.gain.exponentialRampToValueAtTime(0.0001, start + 2.7);
  sub.connect(subGain).connect(sfxGain);
  sub.start(start);
  sub.stop(start + 2.8);

  const sweep = context.createBufferSource();
  const sweepBand = context.createBiquadFilter();
  const sweepGain = context.createGain();
  sweep.buffer = getNoiseBuffer(context);
  sweepBand.type = "bandpass";
  sweepBand.Q.value = 1.1;
  sweepBand.frequency.setValueAtTime(170, start);
  sweepBand.frequency.exponentialRampToValueAtTime(2600, start + 2.2);
  sweepGain.gain.setValueAtTime(0.0001, start);
  sweepGain.gain.exponentialRampToValueAtTime(0.55, start + 1.5);
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, start + 3.2);
  sweep.connect(sweepBand).connect(sweepGain).connect(sfxGain);
  sweep.start(start);
  sweep.stop(start + 3.3);

  const crack = context.createBufferSource();
  const crackFilter = context.createBiquadFilter();
  const crackGain = context.createGain();
  crack.buffer = getNoiseBuffer(context);
  crackFilter.type = "highpass";
  crackFilter.frequency.value = 900;
  crackGain.gain.setValueAtTime(0.46, start);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
  crack.connect(crackFilter).connect(crackGain).connect(sfxGain);
  crack.start(start);
  crack.stop(start + 0.42);
}

// Touchdown: the impact, the burn hissing away behind it, and a two-note resolve
// held back to 1.1 s so it lands with the pixel avatar rather than with the
// contact. Arriving is the point of the whole flight, so the last thing heard is
// consonant rather than another rumble.
function playTouchdownCue() {
  if (!audio || audio.context.state !== "running") return;
  const { context, sfxGain } = audio;
  const start = context.currentTime;

  const impact = context.createOscillator();
  const impactGain = context.createGain();
  impact.type = "sine";
  impact.frequency.setValueAtTime(82, start);
  impact.frequency.exponentialRampToValueAtTime(26, start + 1.3);
  impactGain.gain.setValueAtTime(0.0001, start);
  impactGain.gain.exponentialRampToValueAtTime(0.8, start + 0.06);
  impactGain.gain.exponentialRampToValueAtTime(0.0001, start + 1.9);
  impact.connect(impactGain).connect(sfxGain);
  impact.start(start);
  impact.stop(start + 2);

  const wash = context.createBufferSource();
  const washFilter = context.createBiquadFilter();
  const washGain = context.createGain();
  wash.buffer = getNoiseBuffer(context);
  washFilter.type = "lowpass";
  washFilter.frequency.setValueAtTime(3200, start);
  washFilter.frequency.exponentialRampToValueAtTime(340, start + 1.8);
  washGain.gain.setValueAtTime(0.34, start);
  washGain.gain.exponentialRampToValueAtTime(0.0001, start + 2.1);
  wash.connect(washFilter).connect(washGain).connect(sfxGain);
  wash.start(start);
  wash.stop(start + 2.2);

  [523.25, 784].forEach((frequency, index) => {
    const tone = context.createOscillator();
    const toneGain = context.createGain();
    const at = start + 1.1 + index * 0.16;
    tone.type = "sine";
    tone.frequency.value = frequency;
    toneGain.gain.setValueAtTime(0.0001, at);
    toneGain.gain.exponentialRampToValueAtTime(0.34, at + 0.3);
    // Long enough that the master fade is what ends it, rather than the tone
    // stopping and leaving a second of dead air before the hand-off.
    toneGain.gain.exponentialRampToValueAtTime(0.0001, at + 2.2);
    tone.connect(toneGain).connect(sfxGain);
    tone.start(at);
    tone.stop(at + 2.3);
  });
}

function setSound(enabled) {
  const engine = createAudioEngine();
  if (!engine) return;

  const ramp = (target) => {
    engine.enabled = target;
    soundToggle.setAttribute("aria-pressed", String(target));
    engine.master.gain.cancelScheduledValues(engine.context.currentTime);
    engine.master.gain.linearRampToValueAtTime(target ? 0.34 : 0, engine.context.currentTime + 0.5);
    if (target) fireArmedLaunchCue();
  };

  if (!enabled) {
    ramp(false);
    engine.music.pause();
    return;
  }

  // Auto-launch happens without a click, so playback may stay blocked by autoplay
  // policy. The drive and the cues only need the context, while the score also
  // needs the media element, which can spend a second or two buffering — waiting
  // on both put the ignition three seconds behind the launch it belongs to. The
  // mix opens as soon as the context is live and the music joins when it can.
  engine.music.play().catch(() => {
    // Blocked or still loading; the drone carries the mix until it starts.
  });
  Promise.allSettled([engine.context.resume()]).then(() => {
    ramp(engine.context.state === "running");
  });
}

// The flight starts on its own, so at ignition the context is almost always still
// suspended and the cue would be scheduled into silence. It is armed instead and
// fires the moment sound actually starts, which in practice is when the visitor
// hits SOUND ON. Past the opening seconds the ignition no longer describes
// anything on screen, so it is dropped rather than played late.
function fireArmedLaunchCue() {
  if (!launchCueArmed) return;
  launchCueArmed = false;
  const launchAge = performance.now() - flightStartedAt;
  if (state !== "flying" || launchAge > 5000) return;
  // A late manual unmute may still reasonably reveal the engine, but replaying
  // panel actuators after the panels are already open would be disconnected.
  if (!reducedMotion && launchAge < 1600) playCockpitBootCue();
  playLaunchCue();
}

function launch() {
  if (state === "flying") return;
  state = "flying";
  flightProgress = benchmarkMode ? benchmarkSeek : 0;
  currentWaypointIndex = -1;
  flightStartedAt = performance.now() - flightProgress * flightDuration * 1000;
  experience.classList.remove("is-arrived");
  experience.classList.add("is-flying", "is-launching", "is-booting");
  launchCueArmed = true;
  // The excerpt is cut so its summit lands on re-entry, which only holds if the
  // score starts where the flight does. Replays would otherwise pick up in the
  // closing fade and loop back to the quiet opening under the descent.
  if (audio?.music) {
    try {
      audio.music.currentTime = 0;
    } catch {
      // Not seekable until it has buffered, and the first launch is at zero anyway.
    }
  }
  setSound(true);

  if (audio) {
    const now = audio.context.currentTime;
    audio.filter.frequency.cancelScheduledValues(now);
    audio.filter.frequency.setValueAtTime(140, now);
    audio.filter.frequency.exponentialRampToValueAtTime(520, now + 4);
    audio.musicGain.gain.cancelScheduledValues(now);
    audio.musicGain.gain.setValueAtTime(0, now);
    audio.musicGain.gain.linearRampToValueAtTime(MUSIC_LEVEL, now + MUSIC_FADE_IN);
  }

  window.setTimeout(() => experience.classList.remove("is-booting"), 1400);
  window.setTimeout(() => experience.classList.remove("is-launching"), 2500);
}

function replay() {
  const animationWasPaused = frameVisuallyBlank;
  camera.position.set(0, 0, journeyStartZ);
  camera.rotation.set(0, 0, 0);
  resetCameraView();
  flightProgress = 0;
  currentWaypointIndex = -1;
  experience.classList.remove("is-arrived", "is-deep-space", "is-earth-approach", "is-returning", "is-alert");
  hullAlarm = false;
  systemBars.forEach((bar) => {
    bar.shown = NaN;
    bar.row.classList.remove("is-warn", "is-critical");
  });
  if (warpLines) warpLines.material.opacity = 0;
  clearLock();
  if (audio) {
    const now = audio.context.currentTime;
    plasmaRoar = 0;
    [
      [audio.musicGain.gain, MUSIC_LEVEL],
      [audio.engineGain.gain, ENGINE_LEVEL],
      [audio.entryGain.gain, 0],
      [audio.buffetDepth.gain, 0],
    ].forEach(([param, level]) => {
      param.cancelScheduledValues(now);
      param.setValueAtTime(level, now);
    });
  }
  lensZoom = 1;
  applyCameraLens();
  if (compositeMaterial) {
    compositeMaterial.uniforms.uPixelate.value = 0;
    compositeMaterial.uniforms.uEntryHeat.value = 0;
    compositeMaterial.uniforms.uFadeOut.value = 1;
  }
  frameVisuallyBlank = false;
  state = "idle";
  if (animationWasPaused && !document.hidden) {
    frameId = requestAnimationFrame(animate);
  }
  window.setTimeout(launch, 500);
}

function beginEarthReturn() {
  if (state === "returning") return;
  state = "returning";
  handoffStartedAt = performance.now();
  statusLabel.textContent = "TOUCHDOWN · SYNCING HOME";
  experience.classList.add("is-returning");
  experience.classList.remove("is-camera-dragging");
  clearLock();
  isCameraDragging = false;
  yawVelocity = 0;
  pitchVelocity = 0;

  try {
    sessionStorage.setItem("spaceJourneyReturning", "true");
  } catch {
    // The visual return still works if storage is unavailable.
  }

  if (audio?.enabled) {
    const now = audio.context.currentTime;
    // The score and the drive clear out of the way so the touchdown has the room
    // to land in, but the master holds until just before navigation so the cue
    // itself is not faded out from under its own tail.
    const duck = (param, seconds) => {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(0, now + seconds);
    };
    duck(audio.musicGain.gain, 1.1);
    duck(audio.engineGain.gain, 0.9);
    duck(audio.entryGain.gain, 0.8);
    duck(audio.buffetDepth.gain, 0.8);
    playTouchdownCue();
    audio.master.gain.cancelScheduledValues(now);
    // Held flat until the two-note resolve has sounded, then out before the
    // hand-off navigates at 3.2 s. Fading from contact instead swallows the one
    // phrase the whole descent is building towards.
    audio.master.gain.setValueAtTime(audio.master.gain.value, now + (reducedMotion ? 0 : 1.5));
    audio.master.gain.linearRampToValueAtTime(0, now + (reducedMotion ? 0.55 : 3));
  }

  window.setTimeout(() => window.location.assign("../"), reducedMotion ? 650 : 3200);
}

function updateJourney(progress, now) {
  const eased = easeInOutCubic(Math.min(progress * 0.93, 0.93));
  const landingBlend = THREE.MathUtils.smoothstep(progress, 0.86, 1);
  const flightPulse = Math.sin(Math.min(progress, 1) * Math.PI);
  const entry = THREE.MathUtils.smoothstep(progress, 0.88, 1);
  // The cruise easing is already decelerating by the time Earth fills the frame,
  // so the descent contributes its own accelerating term. Without it the last
  // three seconds park in orbit and the "atmospheric entry" callout has nothing
  // behind it. This ends 46 units from Earth's centre, which projects the disc
  // half again as wide as the old 21-unit push did and leaves under 7 units of
  // clearance over the atmosphere shell at radius * 1.035 — the shell is
  // front-facing, so crossing it would pop the glow inside out.
  // The run-in decays over the first quarter while the cruise easing is still
  // ramping up, so the two overlap and the flight still opens from a standstill
  // the way the launch portal implies. Smoothstep rather than the cubic used for
  // the cruise: it covers the same ground at half the peak speed, and the cubic
  // made the ship charge the corridor at five times its cruising rate and then
  // stand on the brakes.
  const runIn = approachDistance * (1 - THREE.MathUtils.smoothstep(progress, 0, 0.25));
  camera.position.z = 8 + runIn - eased * 982 - entry * entry * entry * 29.5;
  camera.position.x = Math.sin(progress * Math.PI * 5.2) * (1.3 + progress * 1.4) * (1 - landingBlend);
  camera.position.y = Math.sin(progress * Math.PI * 3.1) * 1.25 * (1 - landingBlend);

  if (entry > 0) {
    // Hull buffeting. Detuned sine pairs read as turbulence and, unlike random
    // jitter, stay frame-rate independent.
    const buffet = entry * (1 - entry * 0.28);
    const seconds = now * 0.001;
    camera.position.x += Math.sin(seconds * 21.3) * Math.sin(seconds * 7.1) * buffet * 0.62;
    camera.position.y += Math.sin(seconds * 17.9 + 1.7) * Math.sin(seconds * 9.3) * buffet * 0.48;
    camera.rotation.z += Math.sin(seconds * 13.1) * buffet * 0.014;
  }

  if (progress > 0.9) {
    viewYaw *= 0.9;
    viewPitch *= 0.9;
    pointerX *= 0.88;
    pointerY *= 0.88;
  }

  const waypointIndex = waypoints.findLastIndex((point) => progress >= point.at);
  if (waypointIndex !== currentWaypointIndex) {
    currentWaypointIndex = waypointIndex;
    waypointLabel.textContent = waypoints[waypointIndex].name;
    statusLabel.textContent = waypoints[waypointIndex].status;
    navTarget.classList.remove("is-updating");
    void navTarget.offsetWidth;
    navTarget.classList.add("is-updating");
    tapeMarks.childNodes.forEach((mark, index) => {
      mark.classList.toggle("is-passed", index < waypointIndex);
      mark.classList.toggle("is-active", index === waypointIndex);
    });
  }

  if (now - lastHudUpdate > 100) {
    const velocity = 0.18 + flightPulse * 0.79;
    velocityLabel.textContent = velocity.toFixed(2);
    gauge.style.setProperty("--gauge", velocity.toFixed(3));
    gunsight.style.setProperty("--speed", velocity.toFixed(3));

    if (progress < 0.68) {
      const remainingLightYears = Math.max(4.3, 26000 * Math.pow(1 - progress / 0.72, 2));
      distanceLabel.textContent = `${Math.round(remainingLightYears).toLocaleString()} LY`;
    } else if (progress < 0.965) {
      const remainingAu = 45 * Math.pow((1 - progress) / 0.32, 3);
      distanceLabel.textContent = `${Math.max(remainingAu, 0.01).toFixed(progress > 0.9 ? 2 : 1)} AU`;
    } else {
      const remainingKilometers = 384400 * ((1 - progress) / 0.035);
      distanceLabel.textContent = `${Math.max(0, Math.round(remainingKilometers)).toLocaleString()} KM`;
    }

    const remainingSeconds = Math.max(0, Math.round((1 - progress) * flightDuration));
    etaLabel.textContent = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;

    // Hull integrity is the only readout that fails, and it fails exactly when
    // the plasma layer builds, so the caution light has a cause on screen.
    updateSystemBars({
      thrust: 22 + flightPulse * 76,
      reactor: 54 + Math.sin(progress * Math.PI * 3.4) * 7 + flightPulse * 36,
      hull: 100 - entry * 41,
    });

    const percent = Math.min(progress * 100, 100);
    progressBar.style.width = `${percent}%`;
    tapeShip.style.left = `${percent}%`;

    const alerting = entry > 0.55;
    if (alerting !== hullAlarm) {
      hullAlarm = alerting;
      experience.classList.toggle("is-alert", alerting);
    }

    lastHudUpdate = now;
  }

  if (warpLines) {
    const cruisePhase = Math.min(progress * 1.15, 1);
    const cruiseIntensity = cruisePhase >= 1 ? 0 : Math.sin(cruisePhase * Math.PI);
    warpLines.visible = cruiseIntensity > 0;
    warpLines.material.opacity = Math.max(0, cruiseIntensity * 0.14);
    warpLines.scale.z = 1 + cruiseIntensity * 2.4;
    warpLines.rotation.z = progress * 0.08;
  }
  if (compositeMaterial) {
    compositeMaterial.uniforms.uFlight.value = Math.max(flightPulse, landingBlend * 0.72, entry * 0.95);
    // Heat only builds once the ship is well inside the descent, then holds so
    // the hand-off starts at peak burn.
    compositeMaterial.uniforms.uEntryHeat.value = THREE.MathUtils.smoothstep(progress, 0.93, 0.995);
  }
  if (dustField) dustField.material.uniforms.uSpeed.value = flightPulse;

  // The corridor layers are behind the camera by the time Earth fills the frame;
  // fading them out avoids any straggler drawing over the planet.
  const starFade = 1 - THREE.MathUtils.smoothstep(progress, 0.72, 0.92);
  starLayers.forEach((layer) => {
    const { material } = layer;
    if (!material.userData.fadesNearEarth) return;
    material.uniforms.uFade.value = starFade;
    layer.visible =
      starFade > 0 &&
      (qualityLevel !== "eco" || !layer.userData.optional);
  });
  if (galaxyMaterial) {
    galaxyMaterial.uniforms.uFade.value = starFade;
    galaxy.visible = starFade > 0;
  }

  nebulaSprites.forEach((sprite) => {
    const { fadeRadius, baseOpacity } = sprite.userData;
    if (!fadeRadius) return;
    const proximity = THREE.MathUtils.smoothstep(
      camera.position.distanceTo(sprite.position),
      fadeRadius * 0.3,
      fadeRadius,
    );
    sprite.visible = proximity > 0;
    sprite.material.opacity = baseOpacity * nebulaDim * proximity;
  });

  const nextVisualState = progress > 0.88 ? "earth" : progress > 0.55 ? "deep" : "cruise";
  if (nextVisualState !== journeyVisualState) {
    journeyVisualState = nextVisualState;
    experience.classList.toggle("is-deep-space", nextVisualState !== "cruise");
    experience.classList.toggle("is-earth-approach", nextVisualState === "earth");
  }

  if (audio?.enabled) {
    audio.oscillatorA.frequency.value = 42 + flightPulse * 17;
    audio.oscillatorB.frequency.value = 57 + progress * 18;
    // Squared, so the plasma layer stays out of the mix until the shield is
    // actually glowing rather than creeping in over the last ten seconds.
    const roar = entry * entry * 0.52;
    if (Math.abs(roar - plasmaRoar) > 0.004) {
      plasmaRoar = roar;
      const now = audio.context.currentTime;
      audio.entryGain.gain.setTargetAtTime(roar, now, 0.09);
      audio.buffetDepth.gain.setTargetAtTime(roar * 0.55, now, 0.09);
    }
  }

  if (progress >= 1 && state === "flying") {
    beginEarthReturn();
  }
}

// Touchdown hand-off: the rendered Earth quantises into the avatar's grid while
// the burn cools, so the pixel portrait resolves out of the frame it replaces
// instead of fading in on top of it.
function updateHandoff(now) {
  if (!compositeMaterial) return;
  const seconds = (now - handoffStartedAt) / 1000;
  const handoff = THREE.MathUtils.smoothstep(seconds, 0, 1.25);
  compositeMaterial.uniforms.uPixelate.value = handoff;
  // The burn clears well before the quantisation finishes, so the blocks Earth
  // breaks into are legible rather than buried under the glare.
  compositeMaterial.uniforms.uEntryHeat.value = Math.max(0, 1 - handoff * 1.7);
  // Earth is inside the frame edges by now, so what is left of it is a patch of
  // cloud rather than a planet, and holding on it reads as a stall. Darkening
  // early gives the pixel globe something to resolve out of instead.
  compositeMaterial.uniforms.uFadeOut.value = 1 - THREE.MathUtils.smoothstep(seconds, 0.5, 1.45);

  // Earth cannot be dollied into any further without crossing the atmosphere
  // shell, so the last of the approach comes from the lens instead. The point is
  // that the planet is still growing at the moment the avatar takes over: a
  // frozen frame underneath makes the swap read as a cut to a different image.
  lensZoom = 1 - 0.28 * THREE.MathUtils.smoothstep(seconds, 0, 1.4);
  applyCameraLens();

  // Buffeting bleeds off rather than cutting, so the ship settles as it lands.
  const buffet = Math.max(0, 1 - seconds / 1.6) * 0.5;
  camera.position.x = Math.sin(now * 0.0213) * Math.sin(now * 0.0071) * buffet;
  camera.position.y = Math.sin(now * 0.0179 + 1.7) * Math.sin(now * 0.0093) * buffet * 0.8;
}

function animate(now) {
  const elapsed = clock.getElapsedTime();
  const visualElapsed = benchmarkFreeze ? benchmarkSeek * flightDuration : elapsed;
  const parallaxStrength = state === "flying" ? 0.012 : 0.026;
  frameUniforms.time.value = visualElapsed;

  if (!isCameraDragging) {
    viewYaw = THREE.MathUtils.clamp(viewYaw + yawVelocity, -cameraLimits.yaw, cameraLimits.yaw);
    viewPitch = THREE.MathUtils.clamp(viewPitch + pitchVelocity, -cameraLimits.pitch, cameraLimits.pitch);
    yawVelocity *= 0.89;
    pitchVelocity *= 0.89;
    if (Math.abs(yawVelocity) < 0.00001) yawVelocity = 0;
    if (Math.abs(pitchVelocity) < 0.00001) pitchVelocity = 0;
  }

  const hoverYaw = isCameraDragging || cameraPointerType !== "mouse" ? 0 : pointerX * parallaxStrength;
  const hoverPitch = isCameraDragging || cameraPointerType !== "mouse" ? 0 : -pointerY * parallaxStrength * 0.65;
  camera.rotation.y += (viewYaw + hoverYaw - camera.rotation.y) * 0.09;
  camera.rotation.x += (viewPitch + hoverPitch - camera.rotation.x) * 0.09;
  camera.rotation.z = Math.sin(visualElapsed * 0.45) * 0.0025;
  updateAttitude();

  // Driven from elapsed time rather than accumulated per frame. A fixed step
  // added each frame ties the drift rate to the refresh rate: the same field
  // crawls on a 60 Hz panel and runs at nearly two and a half times that on a
  // 144 Hz one. Drift rate is also what sets how often a star crosses a pixel
  // boundary, so on a high-refresh display it was driving the field's shimmer
  // that much faster as well. The 60 preserves the old per-frame step's meaning
  // at the rate it was tuned for.
  starLayers.forEach((layer) => {
    layer.rotation.z = visualElapsed * 60 * layer.userData.rotationRate;
  });
  if (galaxy) galaxy.rotation.z = 0.18 + visualElapsed * 60 * 0.000025;
  if (asteroidField) asteroidField.rotation.y = visualElapsed * 0.004;

  celestialBodies.forEach(({ group, mesh, cloudMesh, rotationSpeed }, index) => {
    mesh.rotation.y = visualElapsed * 60 * rotationSpeed;
    if (cloudMesh) cloudMesh.rotation.y = visualElapsed * 60 * rotationSpeed * 1.35;
    group.rotation.z = Math.sin(visualElapsed * 0.08 + index) * 0.02;
  });

  if (state === "idle") {
    camera.position.y = Math.sin(visualElapsed * 0.3) * 0.18;
  } else if (state === "flying") {
    flightProgress = benchmarkFreeze
      ? benchmarkSeek
      : Math.min((now - flightStartedAt) / (flightDuration * 1000), 1);
    updateJourney(flightProgress, now);
  } else if (state === "returning") {
    updateHandoff(now);
  }

  // The loader is fully opaque until its exit transition starts. Keep animation
  // state advancing underneath it, but avoid rendering frames nobody can see.
  if (loader.classList.contains("is-hidden")) {
    // After the render, so the crosshair is tested against the same camera
    // matrix the frame was actually drawn with.
    renderCinematicFrame();
    if (frameVisuallyBlank) {
      // Web Audio automation, CSS transitions, and the navigation timeout are
      // independent of RAF. Once the final black frame is present, the remaining
      // hand-off needs no JavaScript frame loop.
      frameId = 0;
      return;
    }
    updateTargeting();
    monitorPerformance(now);
  }
  frameId = requestAnimationFrame(animate);
}

// Narrow viewports need the wider lens to keep Earth and the cockpit frame in
// the same shot. lensZoom rides on top of it so the hand-off punch survives a
// resize instead of being reset to the base focal length mid-move.
function applyCameraLens() {
  camera.fov = (compactDevice ? 66 : 58) * lensZoom;
  camera.updateProjectionMatrix();
}

function onResize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    updateMobileUiFrame();
    const { width, height } = getViewportSize();
    camera.aspect = width / height;
    applyCameraLens();
    applyViewportResolution({ force: true });
  });
}

function refreshViewportAfterModeChange() {
  // Fullscreen and orientation APIs can report their final layout one or two
  // frames after the mode-change event. Refresh immediately, then once more
  // after browser chrome and the orientation transition have settled.
  onResize();
  window.clearTimeout(viewportSettleTimer);
  viewportSettleTimer = window.setTimeout(onResize, 320);
}

function resetCameraView() {
  viewYaw = 0;
  viewPitch = 0;
  yawVelocity = 0;
  pitchVelocity = 0;
  pointerX = 0;
  pointerY = 0;
}

function getCockpitPointer(event) {
  if (document.documentElement.classList.contains("is-landscape-emulated")) {
    // The visual viewport is rotated clockwise. Convert physical portrait input
    // back into the landscape coordinate system the camera controls expect.
    return {
      x: event.clientY,
      y: window.innerWidth - event.clientX,
      width: window.innerHeight,
      height: window.innerWidth,
    };
  }
  return {
    x: event.clientX,
    y: event.clientY,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function onCameraPointerDown(event) {
  if (state === "returning" || (event.pointerType === "mouse" && event.button !== 0) || isCameraDragging) return;
  event.preventDefault();
  const point = getCockpitPointer(event);
  isCameraDragging = true;
  cameraPointerId = event.pointerId;
  cameraPointerType = event.pointerType;
  dragLastX = point.x;
  dragLastY = point.y;
  dragDistance = 0;
  yawVelocity = 0;
  pitchVelocity = 0;
  canvas.setPointerCapture?.(event.pointerId);
  experience.classList.add("is-camera-dragging");
}

function onCameraPointerMove(event) {
  if (!isCameraDragging || event.pointerId !== cameraPointerId) {
    if (event.pointerType === "mouse") {
      const point = getCockpitPointer(event);
      cameraPointerType = "mouse";
      pointerX = (point.x / point.width) * 2 - 1;
      pointerY = (point.y / point.height) * 2 - 1;
    }
    return;
  }

  event.preventDefault();
  const point = getCockpitPointer(event);
  const deltaX = point.x - dragLastX;
  const deltaY = point.y - dragLastY;
  // Raised alongside the yaw and pitch limits, so reaching the edge of the look
  // range still takes about a screen-width of drag rather than two.
  const sensitivity = event.pointerType === "touch" ? 0.005 : 0.0038;
  dragLastX = point.x;
  dragLastY = point.y;
  dragDistance += Math.abs(deltaX) + Math.abs(deltaY);

  const yawDelta = -deltaX * sensitivity;
  const pitchDelta = -deltaY * sensitivity;
  viewYaw = THREE.MathUtils.clamp(viewYaw + yawDelta, -cameraLimits.yaw, cameraLimits.yaw);
  viewPitch = THREE.MathUtils.clamp(viewPitch + pitchDelta, -cameraLimits.pitch, cameraLimits.pitch);
  yawVelocity = yawDelta * 0.42;
  pitchVelocity = pitchDelta * 0.42;

  if (dragDistance > 3) experience.classList.add("has-camera-input");
}

function finishCameraDrag(event) {
  if (!isCameraDragging || event.pointerId !== cameraPointerId) return;
  const wasTouchTap = event.pointerType === "touch" && dragDistance < 8;
  if (canvas.hasPointerCapture?.(cameraPointerId)) canvas.releasePointerCapture(cameraPointerId);
  isCameraDragging = false;
  cameraPointerId = null;
  experience.classList.remove("is-camera-dragging");

  if (wasTouchTap) {
    const now = performance.now();
    if (now - lastTouchTapAt < 320) resetCameraView();
    lastTouchTapAt = now;
  }
}

async function init() {
  try {
    buildInstruments();
    initRenderer();
    initFullscreenControls();
    // Built here rather than at launch. The context stays suspended until the
    // visitor allows sound, but constructing it costs the best part of a second
    // on a loaded machine, and paying that at ignition put the cue behind the
    // launch it belongs to. It also gives the score the whole loading window to
    // buffer, so it opens with the flight instead of a few seconds into it.
    const scenePromise = buildScene();
    createAudioEngine();
    await scenePromise;
    syncPixelRatioUniforms(renderer.getPixelRatio());
    freezeStaticSceneTransforms();
    initPostProcessing();
    setLoading(100, "FLIGHT PATH READY");

    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointerdown", onCameraPointerDown);
    canvas.addEventListener("pointermove", onCameraPointerMove);
    canvas.addEventListener("pointerup", finishCameraDrag);
    canvas.addEventListener("pointercancel", finishCameraDrag);
    canvas.addEventListener("dblclick", (event) => {
      event.preventDefault();
      resetCameraView();
    });
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      cancelAnimationFrame(frameId);
      loader.classList.remove("is-hidden");
      loaderLabel.textContent = "RECOVERING GRAPHICS SYSTEMS…";
    });
    canvas.addEventListener("webglcontextrestored", () => window.location.reload());
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (getFullscreenElement()) {
        event.preventDefault();
        exitImmersiveMode();
      } else {
        window.location.href = "../";
      }
    });
    replayButton.addEventListener("click", replay);
    qualityToggle.addEventListener("click", cycleQuality);
    soundToggle.addEventListener("click", () => setSound(!(audio?.enabled ?? false)));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
        audio?.context.suspend();
      } else {
        clock.getDelta();
        if (audio?.enabled) audio.context.resume();
        performanceWindowStart = performance.now();
        performanceFrames = 0;
        if (!frameVisuallyBlank) frameId = requestAnimationFrame(animate);
      }
    });

    renderer.compile(scene, camera);
    compilePostMaterials();
    frameId = requestAnimationFrame(animate);
    window.setTimeout(() => {
      loader.classList.add("is-hidden");
      // Loading and shader warm-up are not rendering performance samples.
      performanceWindowStart = performance.now();
      performanceFrames = 0;
      launch();
    }, 500);
  } catch (error) {
    console.error("Unable to initialize the space journey:", error);
    loaderLabel.innerHTML = 'SHIP SYSTEMS FAILED TO START. <a href="../">RETURN HOME</a>';
  }
}

init();
