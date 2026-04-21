const frequencySlider = document.getElementById("frequencySlider");
const frequencyValue = document.getElementById("frequencyValue");
const spectrumTicks = document.getElementById("spectrumTicks");

const MIN_EXPONENT = 3;
const MAX_EXPONENT = 20;
const spectrumBands = [
  {
    name: "Ραδιοφωνικά κύματα",
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

frequencySlider.addEventListener("input", updateFrequencyLabel);

renderSpectrumTicks();
updateFrequencyLabel();
