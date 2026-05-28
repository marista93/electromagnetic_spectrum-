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
const magneticFieldOption = document.getElementById("magneticFieldOption");
const magneticFieldInput = document.getElementById("magneticFieldInput");
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
const particleFieldCanvas = document.createElement("canvas");
const particleFieldContext = particleFieldCanvas.getContext("2d", {
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
const WAVE_MIN_AMPLITUDE = 8;
const WAVE_AMPLITUDE_RANGE = 34;
const MAX_WAVE_SAMPLE_SPACING_PX = 5;
const FIELD_RIB_SPACING_PX = 12;
const MAGNETIC_PROJECTION_SCALE = 0.48;
const MAGNETIC_PROJECTION_SKEW_PX = 18;
const DISPLAYED_PARTICLE_MIN = 10;
const DISPLAYED_PARTICLE_LIMIT = 100000;
const PARTICLE_RADIUS = 1;
const PARTICLE_LOG_INTERVAL_MS = 2500;
let waveAnimationFrame = null;
let waveSamples = [];
let lastWaveSampleAt = 0;
let sourceWavePhase = 0;
let waveEmitterParams = null;
let particleEmitterParams = null;
let lastParticleConsoleLogAt = 0;
let particleFieldSignature = "";
let particleFieldWidth = 1;
let particleFieldHeight = 1;
let particleFieldDisplayCount = 0;
let waveCanvasWidth = 1;
let waveCanvasHeight = 1;
let waveCanvasPixelRatio = 1;
let cachedRadiationCenterY = null;
let waveSimulationTime = 0;
let lastWaveFrameTimestamp = 0;
let isWavePlaying = true;
let selectedFrequencyUnit = "MHz";
let currentFrequencyHz = sliderValueToFrequency(frequencySlider.value);
let frequencyInputMode = "rounded";
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

function formatManualFrequencyInputValue(frequency, unit) {
  return String(Math.round(frequency / getFrequencyUnitFactor(unit)));
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

function formatIntensityInputValue(intensity) {
  return String(Math.round(intensity));
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

function clampIntensity(intensity) {
  return Math.min(
    MAX_SENSOR_INTENSITY,
    Math.max(MIN_SENSOR_INTENSITY, intensity),
  );
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

  frequencyInputMode = "manual";
  applyFrequencyValue(Math.round(numericValue) * getFrequencyUnitFactor(unitOverride), unitOverride);
}

function applyIntensityValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    updateIntensityLabel();
    return;
  }

  const clampedIntensity = clampIntensity(numericValue);
  intensitySlider.value = String(clampedIntensity);
  intensityValue.value = formatIntensityInputValue(clampedIntensity);
  commitWaveEmissionChange();
}

function updateFrequencyLabel() {
  const frequency = currentFrequencyHz;
  const bandName = getBandName(frequency);

  frequencyNumberInput.value =
    frequencyInputMode === "manual"
      ? formatManualFrequencyInputValue(frequency, selectedFrequencyUnit)
      : formatFrequencyInputValue(frequency, selectedFrequencyUnit);
  frequencyUnitButton.textContent = selectedFrequencyUnit;
  frequencyBand.textContent = `(${bandName})`;
  frequencyBand.setAttribute("aria-label", `${formatFrequencyWithUnit(frequency)} (${bandName})`);
  syncFrequencyUnitOptions();
}

function updateIntensityLabel() {
  const { intensity, powerUw, photonFluxPerMicrosecond } = getRadiationStateFromControls();
  const intensityText = formatIntensity(intensity);

  if (document.activeElement !== intensityValue) {
    intensityValue.value = formatIntensityInputValue(intensity);
  }
  intensityValue.setAttribute(
    "aria-label",
    `${Math.round(intensity)} millijoule per second per square centimeter`,
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
  magneticFieldOption.hidden = !waveEnabled;
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
  waveCanvasPixelRatio = pixelRatio;
  cachedRadiationCenterY = null;
  invalidateParticleField();

  if (waveCanvas.width === canvasWidth && waveCanvas.height === canvasHeight) {
    return;
  }

  waveCanvas.width = canvasWidth;
  waveCanvas.height = canvasHeight;
  waveContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function clearWaveCanvas() {
  waveContext.clearRect(0, 0, waveCanvasWidth, waveCanvasHeight);
}

function invalidateParticleField() {
  particleFieldSignature = "";
  particleFieldDisplayCount = 0;
}

function ensureParticleField(params) {
  const centerY = getRadiationCenterY();
  const fieldWidth = Math.max(1, Math.ceil(waveCanvasWidth));
  const fieldHeight = Math.max(
    1,
    Math.ceil(Math.min(waveCanvasHeight, params.amplitude * 2 + params.radius * 6)),
  );
  const signature = [
    fieldWidth,
    fieldHeight,
    waveCanvasPixelRatio,
    params.displayCount,
    params.radius,
    params.color,
    Math.round(centerY),
  ].join(":");

  if (particleFieldSignature === signature) {
    return;
  }

  particleFieldSignature = signature;
  particleFieldWidth = fieldWidth;
  particleFieldHeight = fieldHeight;
  particleFieldDisplayCount = params.displayCount;
  particleFieldCanvas.width = Math.max(
    1,
    Math.ceil(fieldWidth * waveCanvasPixelRatio),
  );
  particleFieldCanvas.height = Math.max(
    1,
    Math.ceil(fieldHeight * waveCanvasPixelRatio),
  );
  particleFieldContext.setTransform(
    waveCanvasPixelRatio,
    0,
    0,
    waveCanvasPixelRatio,
    0,
    0,
  );
  particleFieldContext.clearRect(0, 0, fieldWidth, fieldHeight);
  particleFieldContext.fillStyle = params.color;

  const dotSize = Math.max(0.75, params.radius * 2);
  const fieldCenterY = fieldHeight / 2;

  for (let index = 0; index < params.displayCount; index += 1) {
    const x = pseudoRandom(index * 2 + 1) * fieldWidth;
    const y =
      fieldCenterY + (pseudoRandom(index * 2 + 2) * 2 - 1) * params.amplitude;

    particleFieldContext.fillRect(
      x - dotSize / 2,
      y - dotSize / 2,
      dotSize,
      dotSize,
    );
  }
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

function getParticleBeamBlurForDisplayCount(displayCount) {
  return 0;
}

function getParticleColorForFrequency(frequency) {
  const frequencyRatio =
    (Math.log10(frequency) - MIN_EXPONENT) / (MAX_EXPONENT - MIN_EXPONENT);
  const channel = Math.round(255 * (0.5 + frequencyRatio * 0.5));

  return `rgb(${channel}, ${channel}, ${channel})`;
}

function getDisplayPhotonCount(frequency, intensity) {
  const frequencyRatio =
    (Math.log10(frequency) - MIN_EXPONENT) / (MAX_EXPONENT - MIN_EXPONENT);
  const frequencyPosition =
    1 - frequencyRatio;
  const baseCountAtMinimumIntensity =
    DISPLAYED_PARTICLE_MIN +
    (DISPLAYED_PARTICLE_LIMIT / (MAX_SENSOR_INTENSITY / MIN_SENSOR_INTENSITY) -
      DISPLAYED_PARTICLE_MIN) *
      frequencyPosition;
  const intensityMultiplier = intensity / MIN_SENSOR_INTENSITY;

  return Math.round(baseCountAtMinimumIntensity * intensityMultiplier);
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
    amplitude: WAVE_MIN_AMPLITUDE + radiationState.powerRatio * WAVE_AMPLITUDE_RANGE,
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
  const beamBlur = getParticleBeamBlurForDisplayCount(displayCount);
  const wavelength = getRadiationWavelength();

  return {
    displayCount,
    amplitude: 34,
    wavelength,
    angularFrequency: (WAVE_SPEED_PX_PER_MS * Math.PI * 2) / wavelength,
    photonFluxPerMicrosecond: radiationState.photonFluxPerMicrosecond,
    radius: PARTICLE_RADIUS,
    color: getParticleColorForFrequency(radiationState.frequency),
    beamBlur,
  };
}

function resetWaveEmission(timestamp) {
  waveEmitterParams = getWaveParamsFromControls();
  waveSamples = [];
  lastWaveSampleAt = timestamp;
  sourceWavePhase = 0;
}

function resetParticleEmission(timestamp) {
  particleEmitterParams = getParticleParamsFromControls();
  invalidateParticleField();
}

function rebuildParticleFieldAtCurrentTime() {
  invalidateParticleField();
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
    rebuildParticleFieldAtCurrentTime();
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

function commitWaveEmissionChange() {
  pauseWaveAnimation();
  if (currentRadiationModel === "wave") {
    rebuildWaveAtCurrentTime();
  } else {
    rebuildParticlesAtCurrentTime();
    console.log(`Displayed particles: ${particleEmitterParams.displayCount}`);
  }
  updateIntensityLabel();
  updatePhotonFluxLabel();
}

function getVisibleWavePoints(timestamp, centerY) {
  const points = [];

  for (let index = waveSamples.length - 1; index >= 0; index -= 1) {
    const sample = waveSamples[index];

    if (sample.emittedAt > timestamp) {
      continue;
    }

    const x = (timestamp - sample.emittedAt) * WAVE_SPEED_PX_PER_MS;

    if (x < 0 || x > waveCanvasWidth) {
      continue;
    }

    const fieldValue = Math.sin(sample.phase);
    points.push({
      x,
      fieldValue,
      electricY: centerY + fieldValue * sample.amplitude,
      magneticX: x + fieldValue * MAGNETIC_PROJECTION_SKEW_PX,
      magneticY:
        centerY - fieldValue * sample.amplitude * MAGNETIC_PROJECTION_SCALE,
    });
  }

  return points;
}

function renderProjectedFieldRibbon(points, centerY, options) {
  if (points.length < 2) {
    return;
  }

  waveContext.save();
  waveContext.beginPath();
  waveContext.moveTo(points[0].x, centerY);

  for (const point of points) {
    waveContext.lineTo(point[options.xKey], point[options.yKey]);
  }

  waveContext.lineTo(points[points.length - 1].x, centerY);
  waveContext.closePath();
  waveContext.fillStyle = options.fillStyle;
  waveContext.fill();
  waveContext.strokeStyle = options.strokeStyle;
  waveContext.lineWidth = 1.2;
  waveContext.stroke();

  waveContext.beginPath();
  let lastRibX = -Infinity;
  for (const point of points) {
    if (point.x - lastRibX < FIELD_RIB_SPACING_PX) {
      continue;
    }

    waveContext.moveTo(point.x, centerY);
    waveContext.lineTo(point[options.xKey], point[options.yKey]);
    lastRibX = point.x;
  }

  waveContext.strokeStyle = options.ribStyle;
  waveContext.lineWidth = 0.8;
  waveContext.stroke();
  waveContext.restore();
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

  const wavePoints = getVisibleWavePoints(timestamp, centerY);

  if (magneticFieldInput.checked) {
    renderProjectedFieldRibbon(wavePoints, centerY, {
      xKey: "magneticX",
      yKey: "magneticY",
      fillStyle: "rgba(95, 136, 255, 0.42)",
      strokeStyle: "rgba(158, 181, 255, 0.72)",
      ribStyle: "rgba(210, 222, 255, 0.38)",
    });
  }
  renderProjectedFieldRibbon(wavePoints, centerY, {
    xKey: "x",
    yKey: "electricY",
    fillStyle: "rgba(255, 132, 68, 0.64)",
    strokeStyle: "rgba(255, 194, 126, 0.88)",
    ribStyle: "rgba(255, 225, 190, 0.42)",
  });

  waveContext.save();
  waveContext.beginPath();
  waveContext.lineWidth = 4;
  waveContext.lineCap = "round";
  waveContext.lineJoin = "round";

  for (let index = 0; index < wavePoints.length; index += 1) {
    const point = wavePoints[index];

    if (index === 0) {
      waveContext.moveTo(point.x, point.electricY);
    } else {
      waveContext.lineTo(point.x, point.electricY);
    }
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

  const params = particleEmitterParams || getParticleParamsFromControls();
  ensureParticleField(params);
  clearWaveCanvas();

  if (params.displayCount <= 0) {
    return;
  }

  const centerY = getRadiationCenterY();
  const y = centerY - particleFieldHeight / 2;
  const offset = particleFieldWidth > 0
    ? (timestamp * WAVE_SPEED_PX_PER_MS) % particleFieldWidth
    : 0;

  waveContext.save();
  waveContext.filter = params.beamBlur > 0 ? `blur(${params.beamBlur}px)` : "none";
  waveContext.drawImage(
    particleFieldCanvas,
    offset,
    y,
    particleFieldWidth,
    particleFieldHeight,
  );
  waveContext.drawImage(
    particleFieldCanvas,
    offset - particleFieldWidth,
    y,
    particleFieldWidth,
    particleFieldHeight,
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
  console.log(`Displayed photons: ${particleFieldDisplayCount}`);
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

  if (currentRadiationModel === "particle" && particleFieldDisplayCount === 0) {
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
  invalidateParticleField();
  lastWaveSampleAt = 0;
  sourceWavePhase = 0;
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
  frequencyInputMode = "rounded";
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

intensityValue.addEventListener("change", () => {
  applyIntensityValue(intensityValue.value);
});

intensityValue.addEventListener("blur", () => {
  applyIntensityValue(intensityValue.value);
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
magneticFieldInput.addEventListener("change", () => {
  if (currentRadiationModel === "wave") {
    renderWaveAtTime(waveSimulationTime);
  }
});
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
