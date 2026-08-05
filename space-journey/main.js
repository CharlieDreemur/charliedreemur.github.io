import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js";

const canvas = document.querySelector("#space-canvas");
const experience = document.querySelector("#experience");
const loader = document.querySelector("#loader");
const loaderBar = document.querySelector("#loader-bar");
const loaderLabel = document.querySelector("#loader-label");
const replayButton = document.querySelector("#replay-button");
const soundToggle = document.querySelector("#sound-toggle");
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
const systemBars = ["thrust", "reactor", "hull"].map((key) => ({
  key,
  alarms: key === "hull",
  shown: NaN,
  row: document.querySelector(`.bars li[data-key="${key}"]`),
  fill: document.querySelector(`#bar-${key}`),
  value: document.querySelector(`#val-${key}`),
}));

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const compactDevice = window.matchMedia("(max-width: 700px)").matches;
const flightDuration = reducedMotion ? 18 : 52;
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
    postScale: 1,
    bloomScale: 0.25,
    bloom: 0.9,
    streak: 0.42,
    aberration: 0.0016,
    grain: 0.022,
    dust: 900,
    asteroids: 260,
    clouds: true,
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
  },
};

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
let brightMaterial;
let blurMaterial;
let streakMaterial;
let compositeMaterial;
let starLayers = [];
let starMaterials = [];
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
let qualityMode = "auto";
let qualityLevel = connection?.saveData ? "eco" : constrainedDevice ? "balanced" : "high";

// ?quality=high|balanced|eco pins the tier, which is handy for capturing reference frames.
const requestedQuality = new URLSearchParams(window.location.search).get("quality");
if (requestedQuality && qualityProfiles[requestedQuality]) {
  qualityMode = requestedQuality;
  qualityLevel = requestedQuality;
}
let currentWaypointIndex = -1;
let lastHudUpdate = 0;
let performanceWindowStart = performance.now();
let performanceFrames = 0;
let slowWindows = 0;
let fastWindows = 0;
let adaptivePixelScale = 1;
let resizeFrame = 0;
let journeyVisualState = "";
let hullAlarm = false;
const drawingBufferSize = new THREE.Vector2();
const sphereGeometryCache = new Map();
const stellarTextureCache = new Map();
const stellarMaterialCache = new Map();

const waypoints = [
  { at: 0, name: "MILKY WAY HALO", status: "从银河系外缘开始返航" },
  { at: 0.14, name: "PERSEUS ARM", status: "正在穿越银河旋臂" },
  { at: 0.32, name: "CELESTIAL GARDEN", status: "检测到高能行星系统" },
  { at: 0.52, name: "STELLAR NURSERY", status: "经过恒星诞生区" },
  { at: 0.7, name: "SOL SYSTEM", status: "太阳信号已锁定" },
  { at: 0.86, name: "LUNAR ORBIT", status: "进入地月空间" },
  { at: 0.95, name: "EARTH APPROACH", status: "大气层进入程序启动" },
  { at: 0.975, name: "RE-ENTRY", status: "隔热层过载 · 保持姿态" },
];

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

function updateQualityUi() {
  const label = qualityMode === "auto" ? `AUTO · ${qualityLevel.toUpperCase()}` : qualityLevel.toUpperCase();
  qualityLabel.textContent = label;
  qualityToggle.dataset.mode = qualityLevel;
  qualityToggle.setAttribute("aria-label", `当前画质：${label}，点击切换`);
  experience.classList.toggle("quality-eco", qualityLevel === "eco");
}

function getTargetPixelRatio(profile) {
  const pixelBudgets = { high: 4600000, balanced: 2600000, eco: 1500000 };
  const budgetRatio = Math.sqrt(pixelBudgets[qualityLevel] / (window.innerWidth * window.innerHeight));
  return Math.min(
    window.devicePixelRatio,
    profile.dpr * adaptivePixelScale,
    Math.max(0.72, budgetRatio * adaptivePixelScale),
  );
}

function syncPixelRatioUniforms(pixelRatio) {
  viewportUniforms.pixelRatio.value = pixelRatio;
  starMaterials.forEach((material) => {
    material.uniforms.uSize.value = material.userData.baseSize * pixelRatio;
  });
}

function applyViewportResolution({ force = false } = {}) {
  if (!renderer) return;
  const pixelRatio = getTargetPixelRatio(qualityProfiles[qualityLevel]);
  if (!force && Math.abs(renderer.getPixelRatio() - pixelRatio) < 0.01) return;

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
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
    layer.visible = level !== "eco" || !layer.userData.optional;
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
    if (profile.bloomScale > 0) compositeMaterial.defines.USE_BLOOM = "";
    else delete compositeMaterial.defines.USE_BLOOM;
    compositeMaterial.needsUpdate = true;
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

  const sceneWidth = Math.max(1, Math.floor(drawingBufferSize.x * profile.postScale));
  const sceneHeight = Math.max(1, Math.floor(drawingBufferSize.y * profile.postScale));
  sceneTarget.setSize(sceneWidth, sceneHeight);
  compositeMaterial.uniforms.uResolution.value.set(sceneWidth, sceneHeight);

  // Bloom and streaks run at a fraction of the frame, which is where the savings come from.
  const bloomScale = profile.bloomScale;
  const bloomWidth = bloomScale > 0 ? Math.max(1, Math.floor(sceneWidth * bloomScale)) : 1;
  const bloomHeight = bloomScale > 0 ? Math.max(1, Math.floor(sceneHeight * bloomScale)) : 1;
  bloomTargetA.setSize(bloomWidth, bloomHeight);
  bloomTargetB.setSize(bloomWidth, bloomHeight);
  streakTargetA.setSize(bloomWidth, Math.max(1, Math.floor(bloomHeight * 0.5)));
  streakTargetB.setSize(bloomWidth, Math.max(1, Math.floor(bloomHeight * 0.5)));
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

  compositeMaterial = new THREE.ShaderMaterial({
    defines: profile.bloomScale > 0 ? { USE_BLOOM: "" } : {},
    uniforms: {
      tDiffuse: { value: sceneTarget.texture },
      tBloom: { value: bloomTargetA.texture },
      tStreak: { value: streakTargetB.texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: frameUniforms.time,
      tNoise: { value: createFilmGrainTexture() },
      uBloomStrength: { value: profile.bloom },
      uStreakStrength: { value: profile.streak },
      uAberration: { value: profile.aberration },
      uGrain: { value: profile.grain },
      uExposure: { value: 1.05 },
      uFlight: { value: 0 },
      uEntryHeat: { value: 0 },
      uPixelate: { value: 0 },
    },
    vertexShader: fullscreenVertexShader,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D tBloom;
      uniform sampler2D tStreak;
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
        // Keep the frame centre clean; fringing only builds up toward the corners.
        float aberrationFalloff = smoothstep(0.22, 0.72, edgeDistance);
        vec2 chromaOffset =
          centered * uAberration * (1.0 + uFlight * 1.4) * aberrationFalloff * (1.0 - uPixelate);

        vec3 color;
        color.r = texture2D(tDiffuse, distorted + chromaOffset).r;
        color.g = texture2D(tDiffuse, distorted).g;
        color.b = texture2D(tDiffuse, distorted - chromaOffset).b;

        #ifdef USE_BLOOM
          vec3 bloom = texture2D(tBloom, distorted).rgb;
          vec3 streak = texture2D(tStreak, distorted).rgb;
          color += bloom * uBloomStrength * (1.0 + uFlight * 0.5);
          color += streak * vec3(0.55, 0.78, 1.0) * uStreakStrength * (1.0 + uFlight);
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

        if (uGrain > 0.0001) {
          float grain = (randomNoise(gl_FragCoord.xy) - 0.5) * uGrain;
          color += grain * (1.2 - level * 0.7) * (1.0 - uPixelate);
        }

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

function renderCinematicFrame() {
  const profile = qualityProfiles[qualityLevel];

  renderer.setRenderTarget(sceneTarget);
  // Only the 3D pass needs a clear. Every post-process pass is an opaque
  // fullscreen draw, so clearing those targets first is pure bandwidth waste.
  renderer.clear(true, true, false);
  renderer.render(scene, camera);

  if (profile.bloomScale > 0) {
    brightMaterial.uniforms.tDiffuse.value = sceneTarget.texture;
    renderPass(brightMaterial, bloomTargetA);

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
  }

  renderPass(compositeMaterial, null);
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

function getStellarMaterial(texture, color, opacity) {
  const key = `${texture.uuid}|${color}|${opacity}`;
  return getOrCreate(
    stellarMaterialCache,
    key,
    () =>
      new THREE.SpriteMaterial({
        map: texture,
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
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
  ]).then(([day, night, orm, clouds, moon, sun, jupiter, mars]) => ({
    sun,
    jupiter: jupiter ? { map: jupiter } : null,
    // Martian albedo tracks its terrain closely enough to double as a height field.
    mars: mars ? { map: mars, bumpMap: mars } : null,
    earth: day && orm ? { map: day, bumpMap: orm, roughnessMap: orm, nightMap: night, cloudMap: clouds } : null,
    // The lunar albedo doubles as its own height field, which avoids a second download.
    moon: moon ? { map: moon, bumpMap: moon } : null,
  }));
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

  for (let row = 0; row < height; row += 1) {
    const latitude = (row / (height - 1)) * Math.PI;
    const sinLatitude = Math.sin(latitude);
    const cosLatitude = Math.cos(latitude);

    for (let column = 0; column < width; column += 1) {
      const longitude = (column / width) * Math.PI * 2;
      const dirX = sinLatitude * Math.cos(longitude);
      const dirY = cosLatitude;
      const dirZ = sinLatitude * Math.sin(longitude);
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
        const zonal = dirY * 34 + Math.sin(dirY * 5.2) * 3.8;
        const band = Math.sin(zonal + warp * 2 + swirl * 0.8 + shear * 0.35) * 0.5 + 0.5;
        // A weaker second harmonic splits the major belts into the finer ribbons
        // a real giant shows between its zones.
        const ribbon = Math.sin(zonal * 2.7 + swirl * 1.4) * 0.5 + 0.5;
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

  for (let row = 0; row < height; row += 1) {
    const latitude = (row / (height - 1)) * Math.PI;
    const sinLatitude = Math.sin(latitude);
    const cosLatitude = Math.cos(latitude);

    for (let column = 0; column < width; column += 1) {
      const longitude = (column / width) * Math.PI * 2;
      const dirX = sinLatitude * Math.cos(longitude);
      const dirY = cosLatitude;
      const dirZ = sinLatitude * Math.sin(longitude);
      const swirl = sphereFbm(dirX, dirY, dirZ, 2.4, octaves, seed);
      const wisps = sphereFbm(dirX + swirl * 0.4, dirY, dirZ + swirl * 0.4, 6.4, 3, seed + 271);
      // Thin the cover near the equator so the ocean and city lights stay visible.
      const belt = 0.62 + Math.abs(Math.sin(latitude * 3.1)) * 0.24;
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

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const x = (column / size - 0.5) * 2;
      const y = (row / size - 0.5) * 2;
      const distance = Math.hypot(x, y);
      const index = (row * size + column) * 4;

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
const cameraSample = new THREE.Vector3();
const toStar = new THREE.Vector3();
const toBody = new THREE.Vector3();

function overlapsOccluder(star) {
  for (let step = 0; step <= 12; step += 1) {
    cameraSample.set(0, 0, 8 - (step / 12) * 982);
    toStar.subVectors(star, cameraSample);
    const starDistance = toStar.length();

    for (const occluder of occluders) {
      toBody.subVectors(occluder.center, cameraSample);
      const bodyDistance = toBody.length();
      if (starDistance >= bodyDistance || bodyDistance <= occluder.radius) continue;

      const cosSeparation = toStar.dot(toBody) / (starDistance * bodyDistance);
      // A small margin keeps stars from clinging to the limb.
      const cosBodyRadius = Math.cos(Math.asin(occluder.radius / bodyDistance) * 1.2);
      if (cosSeparation > cosBodyRadius) return true;
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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions.subarray(0, written * 3), 3));
  geometry.setAttribute("aTwinkle", new THREE.BufferAttribute(twinkle.subarray(0, written), 1));
  geometry.setAttribute("aMagnitude", new THREE.BufferAttribute(magnitudes.subarray(0, written), 1));
  geometry.setAttribute("aTemperature", new THREE.BufferAttribute(temperatures.subarray(0, written), 1));
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
        float twinkleMask = step(0.8, aTwinkle);
        float animatedPulse = 0.86 + 0.14 * sin(uTime * (0.7 + aTwinkle) + aTwinkle * 31.4);
        float pulse = mix(0.86, animatedPulse, twinkleMask);
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

        gl_PointSize = uSize * aMagnitude * pulse * clamp(260.0 / -viewPosition.z, 0.55, 3.2);
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
  material.userData.baseSize = size;
  material.userData.fadesNearEarth = depth.far > -1000;
  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
  starLayers.push(stars);
  starMaterials.push(material);
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
        float daylight = smoothstep(-0.42, 0.42, sunAlignment);
        float terminator = 1.0 - smoothstep(0.0, 0.34, abs(sunAlignment));
        float forwardScatter = pow(max(dot(viewDirection, -uSunDirection), 0.0), 7.0);

        vec3 sunsetColor = vec3(1.0, 0.52, 0.26);
        vec3 tint = mix(uGlowColor, sunsetColor, terminator * 0.65);
        float alpha = fresnel * uIntensity * (0.18 + daylight * 0.95);
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
  return new THREE.ShaderMaterial({
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
         totalEmissiveRadiance += texture2D(uNightMap, vMapUv).rgb * nightMask * 2.6;`,
      );
  };
  material.customProgramCacheKey = () => "space-journey-night-lights";
}

function addCelestialBody({
  radius,
  position,
  surface,
  glowColor,
  ring = false,
  emissive = 0.03,
  clouds = false,
  atmosphereIntensity = 0.72,
  atmosphereThickness = 3.2,
  rotationSpeed = 0.0007,
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
    cloudMesh = new THREE.Mesh(
      sharedShellGeometry,
      new THREE.MeshStandardMaterial({
        color: "#eef7ff",
        alphaMap: cloudMap,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
      }),
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
    color: "#6f6553",
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
    tone.setHSL(0.07 + random() * 0.04, 0.12 + random() * 0.14, 0.55 + Math.pow(random(), 1.5) * 0.4);
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
        vFade = smoothstep(-4.0, -30.0, viewPosition.z) * (0.35 + aDrift * 0.65);
        gl_PointSize = (0.9 + aDrift * 1.7) * uPixelRatio * clamp(60.0 / -viewPosition.z, 0.4, 2.4);
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
  const armCount = 5;
  const candidate = new THREE.Vector3();
  let written = 0;

  for (let index = 0; index < count; index += 1) {
    const arm = index % armCount;
    const radius = 3 + Math.pow(random(), 0.58) * 180;
    const angle =
      (arm / armCount) * Math.PI * 2 +
      radius * 0.052 +
      (random() - 0.5) * (0.24 + radius * 0.0028);
    const thickness = (random() - 0.5) * (2.5 + radius * 0.055);
    const normalizedRadius = radius / 180;
    if (normalizedRadius < 0.28) color.copy(warm).lerp(blue, normalizedRadius / 0.28);
    else color.copy(blue).lerp(violet, (normalizedRadius - 0.28) / 0.72);
    color.multiplyScalar(0.74 + random() * 0.5);
    const size = 0.55 + Math.pow(random(), 5) * 2.5;

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
        gl_PointSize = aSize * uPixelRatio * clamp(290.0 / -viewPosition.z, 0.55, 4.5);
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

  addNebula([0, 0, centerZ + 2], 185, "rgba(93,126,255,0.55)", 0.22, 31);
  addStellarBeacon([0, 0, centerZ + 3], 15, { fadeRadius: 260 });
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
    // Set for stars the flight path passes through rather than approaches.
    fadeRadius = 0,
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

  // Distance fog tints toward near-black, which on an additive sprite erases the
  // star entirely. Stars are light sources, so they opt out of fog.
  const glow = new THREE.Sprite(getStellarMaterial(glowTexture, coreColor, 1));
  glow.position.set(...position);
  glow.scale.set(size, size, 1);
  registerFadingSprite(glow, { fadeRadius });

  const rays = new THREE.Sprite(getStellarMaterial(glowTexture, haloColor, 0.16));
  rays.position.set(...position);
  rays.scale.set(size * 3.4, size * 0.09, 1);
  registerFadingSprite(rays, { baseOpacity: 0.16, fadeRadius });

  if (photosphere) {
    // Normal blending, drawn after the halo, so the sunspots read as dark
    // against the surface instead of being added into the glow.
    const disc = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: photosphere,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    disc.position.set(...position);
    disc.scale.set(size * photosphereScale, size * photosphereScale, 1);
    disc.renderOrder = 1;
    // A star with a resolvable disc occludes the star field like a planet does.
    occluders.push({
      center: new THREE.Vector3(...position),
      radius: size * photosphereScale * 0.5,
    });
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
  camera.add(warpLines);
}

async function buildScene() {
  const profile = qualityProfiles[qualityLevel];
  sharedSurfaceGeometry = getSphereGeometry(profile.sphere[0], profile.sphere[1]);
  sharedShellGeometry = getSphereGeometry(profile.atmosphere[0], profile.atmosphere[1]);
  const photographicSurfaces = loadPhotographicSurfaces();
  setLoading(12, "正在铺设航道…");
  addWarpTunnel();
  addSpaceDust();
  await nextFrame();

  // The ringed giant is the only fully procedural planet left, so it is baked
  // while the photographic maps are still in flight.
  setLoading(30, "正在铺展行星环…");
  addCelestialBody({
    radius: 78,
    // Below the flight axis on purpose: the sun sits up and to the left, and at
    // this size the planet and its rings eclipse it for the whole first half.
    position: [-302, -148, -648],
    // Saturn's belts are far lower contrast than Jupiter's; a dark end near
    // black turns the zonal banding into humbug stripes.
    surface: createPlanetSurface("gas", 8, [
      [138, 106, 70],
      [186, 152, 104],
      [216, 192, 148],
      [238, 226, 200],
    ]),
    glowColor: "#ffc77c",
    ring: true,
    emissive: 0.03,
    atmosphereIntensity: 0.62,
    rotationSpeed: 0.0011,
    detail: 1.3,
    seed: 8,
  });
  await nextFrame();

  setLoading(52, "正在接收行星影像…");
  const surfaces = await photographicSurfaces;

  // The hero flyby: the path skims roughly 90 units above Jupiter's cloud tops,
  // so it swells to fill most of the frame before falling behind.
  addCelestialBody({
    radius: 118,
    position: [204, -54, -430],
    surface:
      surfaces.jupiter ??
      createPlanetSurface("gas", 17, [
        [64, 46, 36],
        [156, 116, 72],
        [204, 174, 124],
        [228, 212, 182],
      ]),
    glowColor: "#ffd6a4",
    emissive: 0.02,
    atmosphereIntensity: 0.5,
    atmosphereThickness: 3.6,
    rotationSpeed: 0.0009,
    detail: 3,
    seed: 17,
  });
  await nextFrame();

  setLoading(64, "正在渲染红色行星…");
  addCelestialBody({
    radius: 30,
    position: [-149, -66, -742],
    surface:
      surfaces.mars ??
      createPlanetSurface("rock", 29, [
        [46, 24, 16],
        [124, 62, 38],
        [186, 108, 72],
        [226, 176, 148],
      ]),
    glowColor: "#ff9f6b",
    emissive: 0.02,
    atmosphereIntensity: 0.3,
    atmosphereThickness: 4.2,
    rotationSpeed: 0.0006,
    seed: 29,
  });

  addAsteroidBelt([31, 4, -812], 34, 96, 613);
  await nextFrame();

  setLoading(74, "正在接收地球影像…");

  addCelestialBody({
    radius: 16,
    position: [168, -48, -930],
    surface:
      surfaces.moon ??
      createPlanetSurface("rock", 2, [
        [46, 44, 42],
        [118, 114, 108],
        [186, 182, 172],
        [232, 230, 224],
      ]),
    glowColor: "#dce7ef",
    atmosphereIntensity: 0.16,
    atmosphereThickness: 4.6,
    rotationSpeed: 0.0004,
    seed: 2,
  });

  setLoading(80, "正在还原地球…");
  addCelestialBody({
    radius: 38,
    position: [0, 0, -1048],
    surface: surfaces.earth ?? createPlanetSurface("earth", 1984),
    glowColor: "#4fc7ff",
    emissive: 0.015,
    clouds: true,
    atmosphereIntensity: 0.8,
    atmosphereThickness: 3.2,
    rotationSpeed: 0.0005,
    seed: 1984,
  });
  await nextFrame();

  setLoading(84, "正在点亮恒星与星云…");
  addNebula([-95, 35, -610], 330, "rgba(91,76,255,0.55)", 0.34, 3);
  addNebula([115, -25, -745], 370, "rgba(224,67,255,0.55)", 0.26, 11);
  addNebula([-30, 38, -875], 320, "rgba(49,224,255,0.55)", 0.2, 19);
  addStellarBeacon([-78, 34, -782], 34);

  // Anchor the key light to a visible star so shading and art direction agree.
  // 420 keeps the sun ~20 degrees off the flight axis and framed for the first
  // half of the trip; at 900 it sat on the frame edge and left within ten seconds.
  const sunDistance = 420;
  addStellarBeacon(
    [sunDirection.x * sunDistance, sunDirection.y * sunDistance, -1048 + sunDirection.z * sunDistance],
    260,
    {
      // Seen from space the photosphere is a hard white disc at roughly 5800K;
      // the warm tones belong to the corona around it, not to the star itself.
      coreColor: "#ffffff",
      haloColor: "#ffd9a6",
      // The photosphere texture supplies the disc, so these stops only have to
      // describe the corona around it. Everything inside 0.33 is hidden behind
      // that disc, so the gradient holds full strength to just past the limb and
      // decays from there. Front-loading it wastes the corona behind the disc and
      // leaves the limb ending on a hard edge against empty space.
      stops: [
        [0, "rgba(255,252,244,0.9)"],
        [0.32, "rgba(255,248,233,0.82)"],
        [0.4, "rgba(255,232,190,0.34)"],
        [0.55, "rgba(255,216,168,0.13)"],
        [0.75, "rgba(255,206,158,0.04)"],
        [1, "rgba(255,204,155,0)"],
      ],
      photosphere: surfaces.sun,
      // Sized so the disc ends exactly where the corona stops above starts to
      // fall away. At a third of this it was 40 px of screen and bloom turned
      // the granulation and sunspots into a featureless white ball.
      photosphereScale: 0.66,
    },
  );
  await nextFrame();

  // Built last so every planet and the sun are registered as occluders. The
  // flythrough layers also stop short of Earth; a separate backdrop sits behind it.
  setLoading(92, "正在点亮星海…");
  addSpiralGalaxy(-190);
  // Near-white layer tints: each star now carries its own colour temperature,
  // and a saturated layer colour would multiply the warm ones into mud.
  addStarLayer(profile.stars[0], 920, 0.72, "#f2f7ff", 12);
  addStarLayer(profile.stars[1], 680, 1.35, "#ffffff", 47);
  if (profile.stars[2] > 0) {
    addStarLayer(profile.stars[2], 520, 1.8, "#e8f0ff", 91);
    starLayers[starLayers.length - 1].userData.optional = true;
  }
  addStarLayer(profile.stars[1], 1500, 1.05, "#f0f6ff", 173, { near: -1180, far: -1750 });

  const keyLight = new THREE.DirectionalLight("#fff2dc", 4.2);
  keyLight.position.copy(sunDirection).multiplyScalar(100);
  scene.add(keyLight);

  // A dim opposing fill keeps night sides readable without flattening the terminator.
  const rimLight = new THREE.DirectionalLight("#4d7bff", 0.34);
  rimLight.position.copy(sunDirection).multiplyScalar(-100);
  scene.add(rimLight);
  scene.add(new THREE.AmbientLight("#2b466d", 0.12));
  scene.add(new THREE.HemisphereLight("#4f9bf5", "#0d0722", 0.16));

  setLoading(95, "正在启动飞船系统…");
  await nextFrame();
}

function initRenderer() {
  const profile = qualityProfiles[qualityLevel];
  renderer = new THREE.WebGLRenderer({
    canvas,
    // The scene is rendered into a non-MSAA post target. Enabling MSAA on the
    // final canvas therefore allocates extra buffers without smoothing geometry.
    antialias: false,
    alpha: false,
    depth: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(getTargetPixelRatio(profile));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Scene renders linear into the HDR buffer; tone mapping happens in the composite pass.
  renderer.toneMapping = THREE.NoToneMapping;

  scene = new THREE.Scene();
  scene.background = new THREE.Color("#01030a");
  scene.fog = new THREE.FogExp2("#030712", 0.00115);
  renderer.autoClear = false;
  renderer.setClearColor(scene.background, 1);

  camera = new THREE.PerspectiveCamera(
    compactDevice ? 66 : 58,
    window.innerWidth / window.innerHeight,
    0.1,
    1800,
  );
  camera.position.set(0, 0, 8);
  scene.add(camera);
  clock = new THREE.Clock();
  updateQualityUi();
}

function createAudioEngine() {
  if (audio) return audio;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  const context = new AudioContext();
  const master = context.createGain();
  const musicGain = context.createGain();
  const engineGain = context.createGain();
  const filter = context.createBiquadFilter();
  const oscillatorA = context.createOscillator();
  const oscillatorB = context.createOscillator();
  const music = new Audio("./cosmic-navigation.mp3");
  const musicSource = context.createMediaElementSource(music);

  master.gain.value = 0;
  musicGain.gain.value = 0.72;
  engineGain.gain.value = 0.045;
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
  master.connect(context.destination);
  oscillatorA.start();
  oscillatorB.start();

  audio = { context, master, filter, oscillatorA, oscillatorB, music, enabled: false };
  return audio;
}

function setSound(enabled) {
  const engine = createAudioEngine();
  if (!engine) return;

  const ramp = (target) => {
    engine.enabled = target;
    soundToggle.setAttribute("aria-pressed", String(target));
    engine.master.gain.cancelScheduledValues(engine.context.currentTime);
    engine.master.gain.linearRampToValueAtTime(target ? 0.34 : 0, engine.context.currentTime + 0.5);
  };

  if (!enabled) {
    ramp(false);
    engine.music.pause();
    return;
  }

  // Auto-launch happens without a click, so playback may stay blocked by autoplay policy.
  Promise.allSettled([engine.context.resume(), engine.music.play()]).then(() => {
    ramp(engine.context.state === "running" && !engine.music.paused);
  });
}

function launch() {
  if (state === "flying") return;
  state = "flying";
  flightProgress = 0;
  currentWaypointIndex = -1;
  flightStartedAt = performance.now();
  experience.classList.remove("is-arrived");
  experience.classList.add("is-flying", "is-launching", "is-booting");
  setSound(true);

  if (audio) {
    const now = audio.context.currentTime;
    audio.filter.frequency.cancelScheduledValues(now);
    audio.filter.frequency.setValueAtTime(140, now);
    audio.filter.frequency.exponentialRampToValueAtTime(520, now + 4);
  }

  window.setTimeout(() => experience.classList.remove("is-booting"), 1400);
  window.setTimeout(() => experience.classList.remove("is-launching"), 2500);
}

function replay() {
  camera.position.set(0, 0, 8);
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
  if (compositeMaterial) {
    compositeMaterial.uniforms.uPixelate.value = 0;
    compositeMaterial.uniforms.uEntryHeat.value = 0;
  }
  state = "idle";
  window.setTimeout(launch, 500);
}

function beginEarthReturn() {
  if (state === "returning") return;
  state = "returning";
  handoffStartedAt = performance.now();
  statusLabel.textContent = "已抵达地球 · 正在同步主页";
  experience.classList.add("is-returning");
  experience.classList.remove("is-camera-dragging");
  isCameraDragging = false;
  yawVelocity = 0;
  pitchVelocity = 0;

  try {
    sessionStorage.setItem("spaceJourneyReturning", "true");
  } catch {
    // The visual return still works if storage is unavailable.
  }

  if (audio?.enabled) {
    audio.master.gain.cancelScheduledValues(audio.context.currentTime);
    audio.master.gain.linearRampToValueAtTime(0, audio.context.currentTime + 2.2);
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
  // behind it. It ends 15 units clear of the atmosphere shell at radius * 1.035.
  camera.position.z = 8 - eased * 982 - entry * entry * entry * 21;
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
    const cruiseIntensity = Math.sin(Math.min(progress * 1.15, 1) * Math.PI);
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
  starMaterials.forEach((material) => {
    if (material.userData.fadesNearEarth) material.uniforms.uFade.value = starFade;
  });
  if (galaxyMaterial) galaxyMaterial.uniforms.uFade.value = starFade;

  nebulaSprites.forEach((sprite) => {
    const { fadeRadius, baseOpacity } = sprite.userData;
    if (!fadeRadius) return;
    const proximity = THREE.MathUtils.smoothstep(
      camera.position.distanceTo(sprite.position),
      fadeRadius * 0.3,
      fadeRadius,
    );
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
  compositeMaterial.uniforms.uEntryHeat.value = Math.max(0, 1 - handoff * 0.9);

  // Buffeting bleeds off rather than cutting, so the ship settles as it lands.
  const buffet = Math.max(0, 1 - seconds / 1.6) * 0.5;
  camera.position.x = Math.sin(now * 0.0213) * Math.sin(now * 0.0071) * buffet;
  camera.position.y = Math.sin(now * 0.0179 + 1.7) * Math.sin(now * 0.0093) * buffet * 0.8;
}

function animate(now) {
  const elapsed = clock.getElapsedTime();
  const parallaxStrength = state === "flying" ? 0.012 : 0.026;
  frameUniforms.time.value = elapsed;

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
  camera.rotation.z = Math.sin(elapsed * 0.45) * 0.0025;
  updateAttitude();

  starLayers.forEach((layer, index) => {
    layer.rotation.z += (index + 1) * 0.000012;
  });
  if (galaxy) galaxy.rotation.z += 0.000025;
  if (asteroidField) asteroidField.rotation.y = elapsed * 0.004;

  celestialBodies.forEach(({ group, mesh, cloudMesh, rotationSpeed }, index) => {
    mesh.rotation.y += rotationSpeed;
    if (cloudMesh) cloudMesh.rotation.y += rotationSpeed * 1.35;
    group.rotation.z = Math.sin(elapsed * 0.08 + index) * 0.02;
  });

  if (state === "idle") {
    camera.position.y = Math.sin(elapsed * 0.3) * 0.18;
  } else if (state === "flying") {
    flightProgress = Math.min((now - flightStartedAt) / (flightDuration * 1000), 1);
    updateJourney(flightProgress, now);
  } else if (state === "returning") {
    updateHandoff(now);
  }

  renderCinematicFrame();
  monitorPerformance(now);
  frameId = requestAnimationFrame(animate);
}

function onResize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = window.innerWidth <= 700 ? 66 : 58;
    camera.updateProjectionMatrix();
    applyViewportResolution({ force: true });
  });
}

function resetCameraView() {
  viewYaw = 0;
  viewPitch = 0;
  yawVelocity = 0;
  pitchVelocity = 0;
  pointerX = 0;
  pointerY = 0;
}

function onCameraPointerDown(event) {
  if (state === "returning" || (event.pointerType === "mouse" && event.button !== 0) || isCameraDragging) return;
  event.preventDefault();
  isCameraDragging = true;
  cameraPointerId = event.pointerId;
  cameraPointerType = event.pointerType;
  dragLastX = event.clientX;
  dragLastY = event.clientY;
  dragDistance = 0;
  yawVelocity = 0;
  pitchVelocity = 0;
  canvas.setPointerCapture?.(event.pointerId);
  experience.classList.add("is-camera-dragging");
}

function onCameraPointerMove(event) {
  if (!isCameraDragging || event.pointerId !== cameraPointerId) {
    if (event.pointerType === "mouse") {
      cameraPointerType = "mouse";
      pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      pointerY = (event.clientY / window.innerHeight) * 2 - 1;
    }
    return;
  }

  event.preventDefault();
  const deltaX = event.clientX - dragLastX;
  const deltaY = event.clientY - dragLastY;
  // Raised alongside the yaw and pitch limits, so reaching the edge of the look
  // range still takes about a screen-width of drag rather than two.
  const sensitivity = event.pointerType === "touch" ? 0.005 : 0.0038;
  dragLastX = event.clientX;
  dragLastY = event.clientY;
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
    await buildScene();
    initPostProcessing();
    setLoading(100, "航线已就绪");

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
      loaderLabel.textContent = "图形系统正在恢复…";
    });
    canvas.addEventListener("webglcontextrestored", () => window.location.reload());
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") window.location.href = "../";
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
        frameId = requestAnimationFrame(animate);
      }
    });

    renderer.compile(scene, camera);
    renderer.compile(postScene, postCamera);
    frameId = requestAnimationFrame(animate);
    window.setTimeout(() => {
      loader.classList.add("is-hidden");
      launch();
    }, 500);
  } catch (error) {
    console.error("Unable to initialize the space journey:", error);
    loaderLabel.innerHTML = '飞船系统初始化失败。<a href="../">返回个人网站</a>';
  }
}

init();
