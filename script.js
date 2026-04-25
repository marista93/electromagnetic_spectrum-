const frequencySlider = document.getElementById("frequencySlider");
const frequencyInfoButton = document.getElementById("frequencyInfoButton");
const frequencyInfoModal = document.getElementById("frequencyInfoModal");
const frequencyInfoCloseButton = document.getElementById("frequencyInfoCloseButton");
const frequencyNumberInput = document.getElementById("frequencyNumberInput");
const frequencyUnitButton = document.getElementById("frequencyUnitButton");
const frequencyUnitMenu = document.getElementById("frequencyUnitMenu");
const frequencyBand = document.getElementById("frequencyBand");
const frequencyUnitOptions = Array.from(
  document.querySelectorAll(".frequencyUnitOption"),
);
const spectrumTicks = document.getElementById("spectrumTicks");
const powerInfoButton = document.getElementById("powerInfoButton");
const powerInfoModal = document.getElementById("powerInfoModal");
const powerInfoCloseButton = document.getElementById("powerInfoCloseButton");
const intensitySlider = document.getElementById("intensitySlider");
const intensityValue = document.getElementById("intensityValue");
const photonFluxInfoButton = document.getElementById("photonFluxInfoButton");
const photonFluxInfoModal = document.getElementById("photonFluxInfoModal");
const photonFluxInfoCloseButton = document.getElementById("photonFluxInfoCloseButton");
const photonFluxValue = document.getElementById("photonFluxValue");
const waveModelInput = document.getElementById("waveModelInput");
const particleModelInput = document.getElementById("particleModelInput");
const wavePrevButton = document.getElementById("wavePrevButton");
const wavePlayButton = document.getElementById("wavePlayButton");
const wavePauseButton = document.getElementById("wavePauseButton");
const waveNextButton = document.getElementById("waveNextButton");
const sourcePowerSwitch = document.querySelector(".powerSwitchInput");
const waveCanvas = document.getElementById("waveCanvas");
const sourceImage = document.querySelector(".sceneEdgeSource .sceneImage");
const sensorImage = document.querySelector(".sceneEdgeSensor .sceneImage");
const waveContext = waveCanvas.getContext("2d", {
  alpha: true,
  desynchronized: true,
});
const particleLayerCanvas = document.createElement("canvas");
const particleLayerContext = particleLayerCanvas.getContext("2d", {
  alpha: true,
  desynchronized: true,
});

const MIN_EXPONENT = 3;
const MAX_EXPONENT = 20;
const MIN_SENSOR_INTENSITY = 1000;
const MAX_SENSOR_INTENSITY = 5000;
const SENSOR_INTENSITY_TO_POWER_UW = 1 / 1000;
const MICRO_WATT_TO_WATT = 1e-6;
const PLANCK_CONSTANT_J_S = 6.63e-34;
const WAVE_SPEED_PX_PER_MS = 0.24;
const WAVE_STEP_MS = 40;
const MAX_WAVE_SAMPLE_SPACING_PX = 5;
const DISPLAYED_PARTICLE_LIMIT = 10000;
const PARTICLE_REFERENCE_MAX_FREQUENCY_HZ = 1e20;
const PARTICLE_REFERENCE_MIN_FREQUENCY_HZ = 3e8;
const PARTICLE_REFERENCE_MIN_DISPLAY_COUNT = 20;
const PARTICLE_MAX_OPACITY = 1;
const PARTICLE_RADIUS = 3;
const PARTICLE_BLUR = 0;
const PARTICLE_BLUR_START_DISPLAY_COUNT = 8000;
const PARTICLE_MAX_BEAM_BLUR_PX = 6;
const PARTICLE_LOG_INTERVAL_MS = 2500;
let waveAnimationFrame = null;
let waveSamples = [];
let lastWaveSampleAt = 0;
let sourceWavePhase = 0;
let waveEmitterParams = null;
let particleSamples = [];
let lastParticleSampleAt = 0;
let particleEmitterParams = null;
let particleEmissionIndex = 0;
let lastParticleConsoleLogAt = 0;
const particleSpriteCache = new Map();
let waveCanvasWidth = 1;
let waveCanvasHeight = 1;
let cachedRadiationCenterY = null;
let waveSimulationTime = 0;
let lastWaveFrameTimestamp = 0;
let isWavePlaying = true;
let selectedFrequencyUnit = "MHz";
let currentFrequencyHz = sliderValueToFrequency(frequencySlider.value);
let currentRadiationModel = "wave";
const FREQUENCY_UNITS = [
  { factor: 1, suffix: "Hz" },
  { factor: 1e3, suffix: "kHz" },
  { factor: 1e6, suffix: "MHz" },
  { factor: 1e9, suffix: "GHz" },
  { factor: 1e12, suffix: "THz" },
  { factor: 1e15, suffix: "PHz" },
  { factor: 1e18, suffix: "EHz" },
];
const spectrumBands = [
  {
    name: "Ραδιοκύματα",
    min: 1e3,
    max: 3e8,
  },
  {
    name: "Μικροκύματα",
    min: 3e8,
    max: 3e11,
  },
  {
    name: "Υπέρυθρη ακτινοβολία",
    min: 3e11,
    max: 4e14,
  },
  {
    name: "Ορατό φως",
    min: 4e14,
    max: 7.5e14,
  },
  {
    name: "Υπεριώδης ακτινοβολία",
    min: 7.5e14,
    max: 3e16,
  },
  {
    name: "Ακτίνες Χ",
    min: 3e16,
    max: 3e19,
  },
  {
    name: "Ακτίνες γ",
    min: 3e19,
    max: Infinity,
  },
];

function toSuperscript(text) {
  return text.replace(/\d/g, (digit) => `<sup>${digit}</sup>`);
}

function formatScientific(value, unit = "") {
  if (value === 0) {
    return unit ? `0 ${unit}` : "0";
  }

  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const coefficient = value / 10 ** exponent;
  const roundedCoefficient = Math.round(coefficient * 10) / 10;
  const coefficientText = Number.isInteger(roundedCoefficient)
    ? String(roundedCoefficient)
    : String(roundedCoefficient);
  const scientificText =
    coefficientText === "1"
      ? `10${toSuperscript(String(exponent))}`
      : `${coefficientText}&times;10${toSuperscript(String(exponent))}`;

  return unit ? `${scientificText} ${unit}` : scientificText;
}

function getFrequencyUnitFactor(unit) {
  const match = FREQUENCY_UNITS.find(({ suffix }) => suffix === unit);
  return match ? match.factor : 1;
}

function getBestFrequencyUnit(frequency) {
  for (let index = FREQUENCY_UNITS.length - 1; index >= 0; index -= 1) {
    if (frequency >= FREQUENCY_UNITS[index].factor) {
      return FREQUENCY_UNITS[index].suffix;
    }
  }

  return "Hz";
}

function formatFrequencyInputValue(frequency, unit) {
  const scaled = frequency / getFrequencyUnitFactor(unit);
  const rounded = scaled >= 100 ? Math.round(scaled) : Math.round(scaled * 10) / 10;
  return String(rounded).replace(/\.0$/, "");
}

function formatFrequencyWithUnit(frequency) {
  const unit = getBestFrequencyUnit(frequency);
  return `${formatFrequencyInputValue(frequency, unit)} ${unit}`;
}

function formatIntegerWithSpaces(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function roundPhotonFluxForDisplay(value) {
  if (value < 100) {
    return Math.round(value);
  }

  if (value < 1e3) {
    return Math.round(value / 10) * 10;
  }

  if (value < 1e4) {
    return Math.round(value / 100) * 100;
  }

  if (value < 1e5) {
    return Math.round(value / 1000) * 1000;
  }

  if (value < 1e6) {
    return Math.round(value / 10000) * 10000;
  }

  if (value < 1e7) {
    return Math.round(value / 100000) * 100000;
  }

  if (value < 1e8) {
    return Math.round(value / 1000000) * 1000000;
  }

  return Math.round(value / 10000000) * 10000000;
}

function formatPhotonFlux(photonFluxPerMicrosecond) {
  const roundedValue = Math.max(
    0,
    roundPhotonFluxForDisplay(photonFluxPerMicrosecond),
  );
  return {
    html: `<span class="photonFluxNumber">N = ${formatIntegerWithSpaces(roundedValue)}</span><span class="photonFluxUnit">φωτόνια/(μs·cm²)</span>`,
    text: `N = ${roundedValue} φωτόνια/(μs·cm²)`,
  };
}

function formatIntensity(intensity) {
  return `${Math.round(intensity)} mJ/(s·cm²)`;
}

function sliderValueToFrequency(value) {
  const ratio = Number(value) / Number(frequencySlider.max);
  const exponent = MIN_EXPONENT + ratio * (MAX_EXPONENT - MIN_EXPONENT);
  return 10 ** exponent;
}

function sliderValueFromFrequency(frequency) {
  const exponent = Math.log10(frequency);
  return ((exponent - MIN_EXPONENT) / (MAX_EXPONENT - MIN_EXPONENT)) * Number(frequencySlider.max);
}

function clampFrequency(frequency) {
  return Math.min(10 ** MAX_EXPONENT, Math.max(10 ** MIN_EXPONENT, frequency));
}

function sliderValueToSensorIntensity(value) {
  return Number(value);
}

function sensorIntensityToPowerUw(intensity) {
  return intensity * SENSOR_INTENSITY_TO_POWER_UW;
}

function sensorPowerUwToWatt(powerUw) {
  return powerUw * MICRO_WATT_TO_WATT;
}

function getPhotonFluxPerSecond(powerWatt, frequency) {
  if (powerWatt <= 0 || frequency <= 0) {
    return 0;
  }

  return powerWatt / (PLANCK_CONSTANT_J_S * frequency);
}

function getRadiationStateFromControls() {
  const intensity = sliderValueToSensorIntensity(intensitySlider.value);
  const powerUw = sensorIntensityToPowerUw(intensity);
  const powerWatt = sensorPowerUwToWatt(powerUw);
  const frequency = currentFrequencyHz;
  const sourceIsOn = sourcePowerSwitch.checked;
  const photonFluxPerSecond = sourceIsOn
    ? getPhotonFluxPerSecond(powerWatt, frequency)
    : 0;
  const photonFluxPerMicrosecond = photonFluxPerSecond / 1e6;
  const powerRatio =
    (intensity - MIN_SENSOR_INTENSITY) /
    (MAX_SENSOR_INTENSITY - MIN_SENSOR_INTENSITY);

  return {
    intensity,
    powerUw,
    powerWatt,
    frequency,
    photonFluxPerSecond,
    photonFluxPerMicrosecond,
    powerRatio,
    sourceIsOn,
  };
}

function frequencyToPercent(frequency) {
  const exponent = Math.log10(frequency);
  return ((exponent - MIN_EXPONENT) / (MAX_EXPONENT - MIN_EXPONENT)) * 100;
}

function renderSpectrumTicks() {
  const boundaries = spectrumBands.slice(1).map((band) => band.min);
  const visibleBand = spectrumBands.find(({ name }) => name === "Ορατό φως");
  const visibleStart = visibleBand ? frequencyToPercent(visibleBand.min) : 0;
  const visibleEnd = visibleBand ? frequencyToPercent(visibleBand.max) : 0;
  const visibleSpectrumImage = visibleBand
    ? `<img class="visibleSpectrumImage" src="images/spectrum.png" alt="" style="left: ${visibleStart}%; width: ${visibleEnd - visibleStart}%;" />`
    : "";

  spectrumTicks.innerHTML =
    visibleSpectrumImage +
    boundaries
      .map((frequency) => {
        const position = frequencyToPercent(frequency);
        return `<span class="spectrumTick" style="left: ${position}%;"></span>`;
      })
      .join("");
}

function getBandName(frequency) {
  const band = spectrumBands.find(
    ({ min, max }) => frequency >= min && frequency < max,
  );

  return band ? band.name : "Άγνωστη περιοχή";
}

function closeFrequencyUnitMenu() {
  frequencyUnitMenu.hidden = true;
  frequencyUnitButton.setAttribute("aria-expanded", "false");
}

function openFrequencyInfoModal() {
  frequencyInfoModal.hidden = false;
}

function closeFrequencyInfoModal() {
  frequencyInfoModal.hidden = true;
}

function openPowerInfoModal() {
  powerInfoModal.hidden = false;
}

function closePowerInfoModal() {
  powerInfoModal.hidden = true;
}

function openPhotonFluxInfoModal() {
  photonFluxInfoModal.hidden = false;
}

function closePhotonFluxInfoModal() {
  photonFluxInfoModal.hidden = true;
}

function openFrequencyUnitMenu() {
  frequencyUnitMenu.hidden = false;
  frequencyUnitButton.setAttribute("aria-expanded", "true");
}

function syncFrequencyUnitOptions() {
  frequencyUnitOptions.forEach((option) => {
    option.classList.toggle("is-selected", option.dataset.unit === selectedFrequencyUnit);
  });
}

function applyFrequencyValue(frequency, preferredUnit = null) {
  const clampedFrequency = clampFrequency(frequency);
  currentFrequencyHz = clampedFrequency;
  frequencySlider.value = String(Math.round(sliderValueFromFrequency(clampedFrequency)));
  selectedFrequencyUnit = preferredUnit || getBestFrequencyUnit(clampedFrequency);
  updateFrequencyLabel();
  commitWaveEmissionChange();
}

function applyFrequencyEditorValue(unitOverride = selectedFrequencyUnit) {
  const numericValue = Number(frequencyNumberInput.value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    updateFrequencyLabel();
    return;
  }

  applyFrequencyValue(numericValue * getFrequencyUnitFactor(unitOverride), unitOverride);
}

function updateFrequencyLabel() {
  const frequency = currentFrequencyHz;
  const bandName = getBandName(frequency);

  frequencyNumberInput.value = formatFrequencyInputValue(frequency, selectedFrequencyUnit);
  frequencyUnitButton.textContent = selectedFrequencyUnit;
  frequencyBand.textContent = `(${bandName})`;
  frequencyBand.setAttribute("aria-label", `${formatFrequencyWithUnit(frequency)} (${bandName})`);
  syncFrequencyUnitOptions();
}

function updateIntensityLabel() {
  const { intensity, powerUw, photonFluxPerMicrosecond } = getRadiationStateFromControls();
  const intensityText = formatIntensity(intensity);

  intensityValue.textContent = intensityText;
  intensityValue.setAttribute(
    "aria-label",
    `${Math.round(intensity)} millijoule per second per square meter`,
  );
  intensitySlider.setAttribute("aria-valuetext", intensityText);
  waveCanvas.dataset.sensorPowerUw = powerUw.toPrecision(4);
  waveCanvas.dataset.photonFlux = photonFluxPerMicrosecond.toExponential(4);
}

function updatePhotonFluxLabel() {
  const { photonFluxPerMicrosecond } = getRadiationStateFromControls();
  const fluxText = formatPhotonFlux(photonFluxPerMicrosecond);

  photonFluxValue.innerHTML = fluxText.html;
  photonFluxValue.setAttribute("aria-label", fluxText.text);
}

function isWaveModelEnabled() {
  return currentRadiationModel === waveCanvas.dataset.radiationModel;
}

function updateRadiationModelControls() {
  const waveEnabled = currentRadiationModel === "wave";

  waveModelInput.checked = waveEnabled;
  particleModelInput.checked = !waveEnabled;
}

function updateRadiationModel() {
  currentRadiationModel = particleModelInput.checked ? "particle" : "wave";
  updateRadiationModelControls();

  if (currentRadiationModel === "wave") {
    if (sourcePowerSwitch.checked) {
      rebuildWaveAtCurrentTime();
      pauseWaveAnimation();
    } else {
      clearWaveCanvas();
    }
    return;
  }

  if (sourcePowerSwitch.checked) {
    rebuildParticlesAtCurrentTime();
    pauseWaveAnimation();
  } else {
    stopWaveAnimation();
  }
}

function resizeWaveCanvas() {
  const { width, height } = waveCanvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const canvasWidth = Math.max(1, Math.floor(width * pixelRatio));
  const canvasHeight = Math.max(1, Math.floor(height * pixelRatio));

  waveCanvasWidth = width;
  waveCanvasHeight = height;
  cachedRadiationCenterY = null;

  if (waveCanvas.width === canvasWidth && waveCanvas.height === canvasHeight) {
    return;
  }

  waveCanvas.width = canvasWidth;
  waveCanvas.height = canvasHeight;
  particleLayerCanvas.width = canvasWidth;
  particleLayerCanvas.height = canvasHeight;
  waveContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  particleLayerContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function clearWaveCanvas() {
  waveContext.clearRect(0, 0, waveCanvasWidth, waveCanvasHeight);
}

function clearParticleLayer() {
  particleLayerContext.clearRect(0, 0, waveCanvasWidth, waveCanvasHeight);
}

function getElementCenterYWithinCanvas(element) {
  if (!element) {
    return null;
  }

  const elementRect = element.getBoundingClientRect();
  const canvasRect = waveCanvas.getBoundingClientRect();

  return elementRect.top + elementRect.height / 2 - canvasRect.top;
}

function getRadiationCenterY() {
  if (cachedRadiationCenterY !== null) {
    return cachedRadiationCenterY;
  }

  const centers = [sourceImage, sensorImage]
    .map(getElementCenterYWithinCanvas)
    .filter((center) => Number.isFinite(center));

  if (centers.length === 0) {
    cachedRadiationCenterY = waveCanvasHeight / 2;
    return cachedRadiationCenterY;
  }

  cachedRadiationCenterY =
    centers.reduce((sum, center) => sum + center, 0) / centers.length;
  return cachedRadiationCenterY;
}

function pseudoRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453123;
  return value - Math.floor(value);
}

function getFullWavePreviewTime() {
  return Math.max(waveSimulationTime, waveCanvasWidth / WAVE_SPEED_PX_PER_MS);
}

function updateTransportButtons() {
  wavePlayButton.classList.toggle("is-active", isWavePlaying);
  wavePauseButton.classList.toggle("is-active", !isWavePlaying);
}

function getFrequencyRatio() {
  return (Math.log10(currentFrequencyHz) - MIN_EXPONENT) / (MAX_EXPONENT - MIN_EXPONENT);
}

function getParticleOpacityForDisplayCount(displayCount) {
  return PARTICLE_MAX_OPACITY;
}

function getParticleBeamBlurForDisplayCount(displayCount) {
  if (displayCount <= PARTICLE_BLUR_START_DISPLAY_COUNT) {
    return 0;
  }

  const blurRatio = Math.min(
    1,
    Math.max(
      0,
      (displayCount - PARTICLE_BLUR_START_DISPLAY_COUNT) /
        (DISPLAYED_PARTICLE_LIMIT - PARTICLE_BLUR_START_DISPLAY_COUNT),
    ),
  );

  return PARTICLE_MAX_BEAM_BLUR_PX * blurRatio;
}

function getDisplayPhotonCount(frequency, intensity) {
  const intensityRatio = intensity / MIN_SENSOR_INTENSITY;
  const frequencySpan =
    Math.log10(PARTICLE_REFERENCE_MAX_FREQUENCY_HZ) -
    Math.log10(PARTICLE_REFERENCE_MIN_FREQUENCY_HZ);
  const frequencyPosition = Math.max(
    0,
    (Math.log10(PARTICLE_REFERENCE_MAX_FREQUENCY_HZ) -
      Math.log10(clampFrequency(frequency))) /
      frequencySpan,
  );
  const countScale =
    DISPLAYED_PARTICLE_LIMIT / PARTICLE_REFERENCE_MIN_DISPLAY_COUNT;
  const displayCount = Math.round(
    PARTICLE_REFERENCE_MIN_DISPLAY_COUNT *
      intensityRatio *
      countScale ** frequencyPosition,
  );

  if (displayCount > DISPLAYED_PARTICLE_LIMIT) {
    return 0;
  }

  return Math.max(0, displayCount);
}

function getRadiationWavelength() {
  const sliderRatio = getFrequencyRatio();
  const minWavelength = 8;
  const maxWavelength = Math.max(waveCanvasWidth, 320);

  return maxWavelength * (minWavelength / maxWavelength) ** sliderRatio;
}

function getWaveParamsFromControls() {
  const radiationState = getRadiationStateFromControls();
  const wavelength = getRadiationWavelength();

  return {
    amplitude: 8 + radiationState.powerRatio * 34,
    wavelength,
    angularFrequency: (WAVE_SPEED_PX_PER_MS * Math.PI * 2) / wavelength,
    photonFluxPerMicrosecond: radiationState.photonFluxPerMicrosecond,
    powerUw: radiationState.powerUw,
  };
}

function getParticleParamsFromControls() {
  const radiationState = getRadiationStateFromControls();
  const displayCount = getDisplayPhotonCount(
    radiationState.frequency,
    radiationState.intensity,
  );
  const opacity = getParticleOpacityForDisplayCount(displayCount);
  const beamBlur = getParticleBeamBlurForDisplayCount(displayCount);
  const wavelength = getRadiationWavelength();

  return {
    displayCount,
    amplitude: 34,
    wavelength,
    angularFrequency: (WAVE_SPEED_PX_PER_MS * Math.PI * 2) / wavelength,
    photonFluxPerMicrosecond: radiationState.photonFluxPerMicrosecond,
    radius: PARTICLE_RADIUS,
    opacity,
    blur: PARTICLE_BLUR,
    beamBlur,
  };
}

function getParticleSprite(params) {
  const key = [
    Math.round(params.radius * 10),
    Math.round(params.blur * 10),
  ].join(":");

  if (particleSpriteCache.has(key)) {
    return particleSpriteCache.get(key);
  }

  const blurPadding = Math.ceil(params.blur * 2);
  const radius = Math.max(0.5, params.radius);
  const size = Math.max(1, Math.ceil((radius + blurPadding) * 2));
  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = size;
  spriteCanvas.height = size;
  const spriteContext = spriteCanvas.getContext("2d");
  const center = size / 2;

  spriteContext.fillStyle = `rgba(255, 255, 255, ${params.opacity})`;
  spriteContext.beginPath();
  spriteContext.arc(center, center, radius, 0, Math.PI * 2);
  spriteContext.fill();

  const sprite = {
    canvas: spriteCanvas,
    size,
    halfSize: size / 2,
  };
  particleSpriteCache.set(key, sprite);
  return sprite;
}

function resetWaveEmission(timestamp) {
  waveEmitterParams = getWaveParamsFromControls();
  waveSamples = [];
  lastWaveSampleAt = timestamp;
  sourceWavePhase = 0;
}

function resetParticleEmission(timestamp) {
  particleEmitterParams = getParticleParamsFromControls();
  particleSamples = [];
  lastParticleSampleAt = timestamp;
  particleEmissionIndex = 0;
}

function createParticleSampleAtX(timestamp, x) {
  particleEmissionIndex += 1;

  return {
    emittedAt: timestamp - x / WAVE_SPEED_PX_PER_MS,
    normalizedOffset: Math.random() * 2 - 1,
  };
}

function createRandomParticleSample(timestamp) {
  return createParticleSampleAtX(timestamp, Math.random() * waveCanvasWidth);
}

function reconcileParticleSamplesAtCurrentTime(timestamp, params) {
  const maxSampleAge = waveCanvasWidth / WAVE_SPEED_PX_PER_MS;
  const targetCount = params.displayCount;

  particleSamples = [];

  if (targetCount <= 0) {
    lastParticleSampleAt = timestamp;
    return;
  }

  while (particleSamples.length < targetCount) {
    particleSamples.push(createRandomParticleSample(timestamp));
  }

  lastParticleSampleAt =
    targetCount > 0
      ? timestamp + Math.max(1, maxSampleAge / targetCount)
      : timestamp;
}

function rebuildWaveAtCurrentTime() {
  waveSamples = [];
  lastWaveSampleAt = 0;
  waveEmitterParams = getWaveParamsFromControls();
  sourceWavePhase = isWavePlaying
    ? 0
    : -waveEmitterParams.angularFrequency * waveSimulationTime;

  if (sourcePowerSwitch.checked && isWaveModelEnabled()) {
    emitWaveSamples(waveSimulationTime);
    renderWaveAtTime(waveSimulationTime);
  } else {
    clearWaveCanvas();
  }
}

function rebuildParticlesAtCurrentTime() {
  particleEmitterParams = getParticleParamsFromControls();

  if (sourcePowerSwitch.checked) {
    reconcileParticleSamplesAtCurrentTime(waveSimulationTime, particleEmitterParams);
    renderParticlesAtTime(waveSimulationTime);
  } else {
    clearWaveCanvas();
  }
}

function emitWaveSamples(timestamp) {
  while (lastWaveSampleAt <= timestamp) {
    const params = waveEmitterParams || getWaveParamsFromControls();
    const sampleSpacing = Math.min(MAX_WAVE_SAMPLE_SPACING_PX, params.wavelength / 16);
    const sampleInterval = sampleSpacing / WAVE_SPEED_PX_PER_MS;

    waveSamples.push({
      emittedAt: lastWaveSampleAt,
      phase: sourceWavePhase,
      amplitude: params.amplitude,
    });

    lastWaveSampleAt += sampleInterval;
    sourceWavePhase += params.angularFrequency * sampleInterval;
  }
}

function emitParticleSamples(timestamp) {
  const maxSampleAge = waveCanvasWidth / WAVE_SPEED_PX_PER_MS;
  const params = particleEmitterParams || getParticleParamsFromControls();

  if (params.displayCount <= 0) {
    particleSamples = [];
    lastParticleSampleAt = timestamp;
    return;
  }

  const sampleInterval = maxSampleAge / params.displayCount;

  while (lastParticleSampleAt <= timestamp) {
    particleEmissionIndex += 1;
    particleSamples.push({
      emittedAt: lastParticleSampleAt,
      normalizedOffset: pseudoRandom(particleEmissionIndex) * 2 - 1,
    });
    lastParticleSampleAt += sampleInterval;
  }
}

function commitWaveEmissionChange() {
  pauseWaveAnimation();
  if (currentRadiationModel === "wave") {
    rebuildWaveAtCurrentTime();
  } else {
    rebuildParticlesAtCurrentTime();
    console.log(
      `Displayed particles: ${particleSamples.length}, rgba: rgba(255, 255, 255, ${particleEmitterParams.opacity.toFixed(3)})`,
    );
  }
  updateIntensityLabel();
  updatePhotonFluxLabel();
}

function renderWaveAtTime(timestamp) {
  if (!sourcePowerSwitch.checked || !isWaveModelEnabled()) {
    clearWaveCanvas();
    return;
  }

  const centerY = getRadiationCenterY();
  const maxSampleAge = waveCanvasWidth / WAVE_SPEED_PX_PER_MS;

  emitWaveSamples(timestamp);

  let expiredSamples = 0;
  while (
    expiredSamples < waveSamples.length &&
    timestamp - waveSamples[expiredSamples].emittedAt > maxSampleAge
  ) {
    expiredSamples += 1;
  }

  if (expiredSamples > 0) {
    waveSamples.splice(0, expiredSamples);
  }

  clearWaveCanvas();

  if (waveSamples.length < 2) {
    return;
  }

  waveContext.save();
  waveContext.beginPath();
  waveContext.lineWidth = 4;
  waveContext.lineCap = "round";
  waveContext.lineJoin = "round";

  for (let index = waveSamples.length - 1; index > 0; index -= 1) {
    const sample = waveSamples[index];
    const nextSample = waveSamples[index - 1];

    if (sample.emittedAt > timestamp || nextSample.emittedAt > timestamp) {
      continue;
    }

    const x = (timestamp - sample.emittedAt) * WAVE_SPEED_PX_PER_MS;
    const y = centerY + Math.sin(sample.phase) * sample.amplitude;
    const nextX = (timestamp - nextSample.emittedAt) * WAVE_SPEED_PX_PER_MS;
    const nextY = centerY + Math.sin(nextSample.phase) * nextSample.amplitude;

    if (index === waveSamples.length - 1) {
      waveContext.moveTo(x, y);
    }

    waveContext.lineTo(nextX, nextY);
  }

  waveContext.strokeStyle = "rgba(255, 255, 255, 0.92)";
  waveContext.lineWidth = 2;
  waveContext.stroke();
  waveContext.restore();
}

function renderParticlesAtTime(timestamp) {
  if (!sourcePowerSwitch.checked || currentRadiationModel !== "particle") {
    clearWaveCanvas();
    return;
  }

  const maxSampleAge = waveCanvasWidth / WAVE_SPEED_PX_PER_MS;
  emitParticleSamples(timestamp);

  let expiredSamples = 0;
  while (
    expiredSamples < particleSamples.length &&
    timestamp - particleSamples[expiredSamples].emittedAt > maxSampleAge
  ) {
    expiredSamples += 1;
  }

  if (expiredSamples > 0) {
    particleSamples.splice(0, expiredSamples);
  }

  clearWaveCanvas();

  if (particleSamples.length === 0) {
    return;
  }

  const params = particleEmitterParams || getParticleParamsFromControls();
  const sprite = getParticleSprite(params);
  const centerY = getRadiationCenterY();
  clearParticleLayer();

  for (let index = 0; index < particleSamples.length; index += 1) {
    const particle = particleSamples[index];
    const x = (timestamp - particle.emittedAt) * WAVE_SPEED_PX_PER_MS;
    const y = centerY + particle.normalizedOffset * params.amplitude;
    const size = Math.max(2, sprite.size);

    particleLayerContext.drawImage(
      sprite.canvas,
      x - size / 2,
      y - size / 2,
      size,
      size,
    );
  }

  waveContext.save();
  waveContext.filter = params.beamBlur > 0 ? `blur(${params.beamBlur}px)` : "none";
  waveContext.drawImage(
    particleLayerCanvas,
    0,
    0,
    waveCanvasWidth,
    waveCanvasHeight,
  );
  waveContext.restore();
}

function renderActiveRadiationAtTime(timestamp) {
  if (currentRadiationModel === "wave") {
    renderWaveAtTime(timestamp);
  } else {
    renderParticlesAtTime(timestamp);
  }
}

function logDisplayedParticles(frameTimestamp) {
  if (
    currentRadiationModel !== "particle" ||
    !sourcePowerSwitch.checked ||
    frameTimestamp - lastParticleConsoleLogAt < PARTICLE_LOG_INTERVAL_MS
  ) {
    return;
  }

  lastParticleConsoleLogAt = frameTimestamp;
  console.log(`Displayed photons: ${particleSamples.length}`);
}

function drawWave(frameTimestamp) {
  if (!sourcePowerSwitch.checked) {
    stopWaveAnimation();
    return;
  }

  if (!isWavePlaying) {
    waveAnimationFrame = null;
    lastWaveFrameTimestamp = 0;
    renderActiveRadiationAtTime(waveSimulationTime);
    return;
  }

  if (lastWaveFrameTimestamp === 0) {
    lastWaveFrameTimestamp = frameTimestamp;
  }

  const elapsed = Math.min(48, frameTimestamp - lastWaveFrameTimestamp);
  lastWaveFrameTimestamp = frameTimestamp;
  waveSimulationTime += elapsed;

  renderActiveRadiationAtTime(waveSimulationTime);
  logDisplayedParticles(frameTimestamp);

  waveAnimationFrame = window.requestAnimationFrame(drawWave);
}

function startWaveAnimation() {
  isWavePlaying = true;
  updateTransportButtons();

  if (currentRadiationModel === "wave" && waveSamples.length === 0) {
    resetWaveEmission(waveSimulationTime);
  }

  if (currentRadiationModel === "particle" && particleSamples.length === 0) {
    resetParticleEmission(waveSimulationTime);
  }

  if (waveAnimationFrame !== null) {
    return;
  }

  lastWaveFrameTimestamp = 0;
  waveAnimationFrame = window.requestAnimationFrame(drawWave);
}

function stopWaveAnimation() {
  if (waveAnimationFrame !== null) {
    window.cancelAnimationFrame(waveAnimationFrame);
    waveAnimationFrame = null;
  }

  isWavePlaying = false;
  updateTransportButtons();
  clearWaveCanvas();
  waveSamples = [];
  particleSamples = [];
  lastWaveSampleAt = 0;
  lastParticleSampleAt = 0;
  sourceWavePhase = 0;
  particleEmissionIndex = 0;
  lastWaveFrameTimestamp = 0;
}

function pauseWaveAnimation() {
  isWavePlaying = false;
  updateTransportButtons();

  if (waveAnimationFrame !== null) {
    window.cancelAnimationFrame(waveAnimationFrame);
    waveAnimationFrame = null;
  }

  lastWaveFrameTimestamp = 0;
  renderActiveRadiationAtTime(waveSimulationTime);
}

function stepWave(direction) {
  if (!sourcePowerSwitch.checked) {
    return;
  }

  pauseWaveAnimation();
  waveSimulationTime = Math.max(0, waveSimulationTime + direction * WAVE_STEP_MS);
  renderActiveRadiationAtTime(waveSimulationTime);
}

function updateSourcePower() {
  if (sourcePowerSwitch.checked) {
    isWavePlaying = false;
    updateTransportButtons();
    waveSimulationTime = getFullWavePreviewTime();
    if (currentRadiationModel === "wave") {
      rebuildWaveAtCurrentTime();
    } else {
      rebuildParticlesAtCurrentTime();
    }
    pauseWaveAnimation();
  } else {
    stopWaveAnimation();
  }

  updatePhotonFluxLabel();
}

frequencySlider.addEventListener("input", () => {
  currentFrequencyHz = sliderValueToFrequency(frequencySlider.value);
  selectedFrequencyUnit = getBestFrequencyUnit(currentFrequencyHz);
  commitWaveEmissionChange();
  updateFrequencyLabel();
});

frequencyNumberInput.addEventListener("change", () => {
  applyFrequencyEditorValue();
});

frequencyNumberInput.addEventListener("blur", () => {
  updateFrequencyLabel();
});

frequencyUnitButton.addEventListener("click", () => {
  if (frequencyUnitMenu.hidden) {
    openFrequencyUnitMenu();
  } else {
    closeFrequencyUnitMenu();
  }
});

frequencyUnitOptions.forEach((option) => {
  option.addEventListener("click", () => {
    selectedFrequencyUnit = option.dataset.unit;
    closeFrequencyUnitMenu();
    applyFrequencyEditorValue(selectedFrequencyUnit);
  });
});

intensitySlider.addEventListener("input", () => {
  commitWaveEmissionChange();
});

sourcePowerSwitch.addEventListener("change", updateSourcePower);
frequencyInfoButton.addEventListener("click", openFrequencyInfoModal);
frequencyInfoCloseButton.addEventListener("click", closeFrequencyInfoModal);
powerInfoButton.addEventListener("click", openPowerInfoModal);
powerInfoCloseButton.addEventListener("click", closePowerInfoModal);
photonFluxInfoButton.addEventListener("click", openPhotonFluxInfoModal);
photonFluxInfoCloseButton.addEventListener("click", closePhotonFluxInfoModal);
waveModelInput.addEventListener("change", updateRadiationModel);
particleModelInput.addEventListener("change", updateRadiationModel);
wavePlayButton.addEventListener("click", startWaveAnimation);
wavePauseButton.addEventListener("click", pauseWaveAnimation);
wavePrevButton.addEventListener("click", () => {
  stepWave(-1);
});
waveNextButton.addEventListener("click", () => {
  stepWave(1);
});

window.addEventListener("resize", () => {
  resizeWaveCanvas();

  if (!sourcePowerSwitch.checked) {
    clearWaveCanvas();
  } else {
    if (currentRadiationModel === "wave") {
      rebuildWaveAtCurrentTime();
    } else {
      rebuildParticlesAtCurrentTime();
    }
  }
});

document.addEventListener("click", (event) => {
  if (!frequencyUnitMenu.hidden && !event.target.closest(".frequencyUnitSelect")) {
    closeFrequencyUnitMenu();
  }

  if (
    !frequencyInfoModal.hidden &&
    event.target instanceof HTMLElement &&
    event.target.dataset.closeFrequencyInfo === "true"
  ) {
    closeFrequencyInfoModal();
  }

  if (
    !powerInfoModal.hidden &&
    event.target instanceof HTMLElement &&
    event.target.dataset.closePowerInfo === "true"
  ) {
    closePowerInfoModal();
  }

  if (
    !photonFluxInfoModal.hidden &&
    event.target instanceof HTMLElement &&
    event.target.dataset.closePhotonFluxInfo === "true"
  ) {
    closePhotonFluxInfoModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!frequencyUnitMenu.hidden) {
      closeFrequencyUnitMenu();
    }

    if (!frequencyInfoModal.hidden) {
      closeFrequencyInfoModal();
    }

    if (!powerInfoModal.hidden) {
      closePowerInfoModal();
    }

    if (!photonFluxInfoModal.hidden) {
      closePhotonFluxInfoModal();
    }
  }
});

renderSpectrumTicks();
currentFrequencyHz = sliderValueToFrequency(frequencySlider.value);
selectedFrequencyUnit = getBestFrequencyUnit(currentFrequencyHz);
updateFrequencyLabel();
updateIntensityLabel();
updatePhotonFluxLabel();
updateRadiationModelControls();
updateTransportButtons();
resizeWaveCanvas();
updateSourcePower();
