const frequencySlider = document.getElementById("frequencySlider");
const frequencyValue = document.getElementById("frequencyValue");
const spectrumTicks = document.getElementById("spectrumTicks");
const intensitySlider = document.getElementById("intensitySlider");
const intensityValue = document.getElementById("intensityValue");
const sourcePowerSwitch = document.querySelector(".powerSwitchInput");
const waveCanvas = document.getElementById("waveCanvas");
const waveContext = waveCanvas.getContext("2d", {
  alpha: true,
  desynchronized: true,
});

const MIN_EXPONENT = 3;
const MAX_EXPONENT = 20;
const activeRadiationModel = "wave";
const WAVE_SPEED_PX_PER_MS = 0.16;
const MAX_WAVE_SAMPLE_SPACING_PX = 5;
let waveAnimationFrame = null;
let waveSamples = [];
let lastWaveSampleAt = 0;
let sourceWavePhase = 0;
let waveEmitterParams = null;
let waveCanvasWidth = 1;
let waveCanvasHeight = 1;
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

function formatScientific(value) {
  const exponent = Math.floor(Math.log10(value));
  const coefficient = value / 10 ** exponent;
  const roundedCoefficient = Math.round(coefficient * 10) / 10;
  const coefficientText = Number.isInteger(roundedCoefficient)
    ? String(roundedCoefficient)
    : String(roundedCoefficient);

  if (coefficientText === "1") {
    return `10${toSuperscript(String(exponent))} Hz`;
  }

  return `${coefficientText}×10${toSuperscript(String(exponent))} Hz`;
}

function sliderValueToFrequency(value) {
  const ratio = Number(value) / Number(frequencySlider.max);
  const exponent = MIN_EXPONENT + ratio * (MAX_EXPONENT - MIN_EXPONENT);
  return 10 ** exponent;
}

function frequencyToPercent(frequency) {
  const exponent = Math.log10(frequency);
  return ((exponent - MIN_EXPONENT) / (MAX_EXPONENT - MIN_EXPONENT)) * 100;
}

function renderSpectrumTicks() {
  const boundaries = spectrumBands.slice(1).map((band) => band.min);

  spectrumTicks.innerHTML = boundaries
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

function updateFrequencyLabel() {
  const frequency = sliderValueToFrequency(frequencySlider.value);
  const bandName = getBandName(frequency);

  frequencyValue.innerHTML = `${formatScientific(frequency)} (${bandName})`;
  frequencyValue.setAttribute("aria-label", `${frequency.toExponential(2)} hertz`);
}

function updateIntensityLabel() {
  intensityValue.textContent = `${intensitySlider.value}%`;
}

function isWaveModelEnabled() {
  return activeRadiationModel === waveCanvas.dataset.radiationModel;
}

function resizeWaveCanvas() {
  const { width, height } = waveCanvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const canvasWidth = Math.max(1, Math.floor(width * pixelRatio));
  const canvasHeight = Math.max(1, Math.floor(height * pixelRatio));

  waveCanvasWidth = width;
  waveCanvasHeight = height;

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

function getWaveParamsFromControls() {
  const intensityRatio = Number(intensitySlider.value) / Number(intensitySlider.max);
  const sliderRatio = Number(frequencySlider.value) / Number(frequencySlider.max);
  const minWavelength = 8;
  const maxWavelength = Math.max(waveCanvasWidth, 320);
  const wavelength = maxWavelength * (minWavelength / maxWavelength) ** sliderRatio;

  return {
    amplitude: 8 + intensityRatio * 34,
    wavelength,
    angularFrequency: (WAVE_SPEED_PX_PER_MS * Math.PI * 2) / wavelength,
  };
}

function resetWaveEmission(timestamp) {
  waveSamples = [];
  lastWaveSampleAt = timestamp;
  sourceWavePhase = 0;
  waveEmitterParams = getWaveParamsFromControls();
}

function emitWaveSamples(timestamp) {
  while (lastWaveSampleAt <= timestamp) {
    const params = waveEmitterParams || getWaveParamsFromControls();
    const sampleSpacing = Math.min(MAX_WAVE_SAMPLE_SPACING_PX, params.wavelength / 16);
    const sampleInterval = sampleSpacing / WAVE_SPEED_PX_PER_MS;

    sourceWavePhase += params.angularFrequency * sampleInterval;
    waveSamples.push({
      emittedAt: lastWaveSampleAt,
      phase: sourceWavePhase,
      amplitude: params.amplitude,
    });

    lastWaveSampleAt += sampleInterval;
  }
}

function commitWaveEmissionChange() {
  if (sourcePowerSwitch.checked && isWaveModelEnabled()) {
    emitWaveSamples(performance.now());
  }

  waveEmitterParams = getWaveParamsFromControls();
}

function drawWave(timestamp) {
  if (!sourcePowerSwitch.checked || !isWaveModelEnabled()) {
    stopWaveAnimation();
    return;
  }

  const centerY = waveCanvasHeight / 2;
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
    waveAnimationFrame = window.requestAnimationFrame(drawWave);
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
    const x = (timestamp - sample.emittedAt) * WAVE_SPEED_PX_PER_MS;
    const y = centerY + Math.sin(sample.phase) * sample.amplitude;
    const nextX = (timestamp - nextSample.emittedAt) * WAVE_SPEED_PX_PER_MS;
    const nextY = centerY + Math.sin(nextSample.phase) * nextSample.amplitude;

    if (index === waveSamples.length - 1) {
      waveContext.moveTo(x, y);
    }

    waveContext.lineTo(nextX, nextY);
  }

  waveContext.strokeStyle = "rgba(147, 255, 176, 0.2)";
  waveContext.lineWidth = 9;
  waveContext.stroke();
  waveContext.strokeStyle = "rgba(147, 255, 176, 0.88)";
  waveContext.lineWidth = 3;
  waveContext.stroke();
  waveContext.restore();

  waveAnimationFrame = window.requestAnimationFrame(drawWave);
}

function startWaveAnimation() {
  if (!isWaveModelEnabled() || waveAnimationFrame !== null) {
    return;
  }

  resetWaveEmission(performance.now());
  waveAnimationFrame = window.requestAnimationFrame(drawWave);
}

function stopWaveAnimation() {
  if (waveAnimationFrame !== null) {
    window.cancelAnimationFrame(waveAnimationFrame);
    waveAnimationFrame = null;
  }

  clearWaveCanvas();
  waveSamples = [];
  lastWaveSampleAt = 0;
  sourceWavePhase = 0;
}

function updateSourcePower() {
  if (sourcePowerSwitch.checked) {
    startWaveAnimation();
  } else {
    stopWaveAnimation();
  }
}

frequencySlider.addEventListener("input", () => {
  commitWaveEmissionChange();
  updateFrequencyLabel();
});
intensitySlider.addEventListener("input", () => {
  commitWaveEmissionChange();
  updateIntensityLabel();
});
sourcePowerSwitch.addEventListener("change", updateSourcePower);
window.addEventListener("resize", () => {
  resizeWaveCanvas();

  if (!sourcePowerSwitch.checked) {
    clearWaveCanvas();
  }
});

renderSpectrumTicks();
updateFrequencyLabel();
updateIntensityLabel();
resizeWaveCanvas();
updateSourcePower();
