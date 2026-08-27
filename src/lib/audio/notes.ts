export const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;

export const NOTE_NAMES_FLAT = [
  "C",
  "D♭",
  "D",
  "E♭",
  "E",
  "F",
  "G♭",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
] as const;

export type PitchClass = (typeof NOTE_NAMES)[number];

export type AnalyzedNote = {
  midi: number;
  pc: number;
  name: string;
  letter: string;
  octave: number;
  cents: number;
  freq: number;
  inTune: boolean;
};

export const A4_PRESETS = [432, 440, 442, 444] as const;

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

export function freqToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}

export function analyzeNote(freq: number, a4 = 440): AnalyzedNote {
  const raw = freqToMidi(freq, a4);
  const midi = Math.round(raw);
  const cents = (raw - midi) * 100;
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const letter = NOTE_NAMES[pc] ?? "C";
  return {
    midi,
    pc,
    name: `${letter}${octave}`,
    letter,
    octave,
    cents,
    freq,
    inTune: Math.abs(cents) < 8,
  };
}

export function midiName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc] ?? "C"}${octave}`;
}

export function isBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

/** Greenwood (1961) human cochlear frequency–place map. x = 0 at apex, 1 at base. */
const GW_A = 165.4;
const GW_A_EXP = 2.1;
const GW_K = 0.88;

export function freqToPlace(freq: number): number {
  const x = Math.log10(freq / GW_A + GW_K) / GW_A_EXP;
  return Math.max(0, Math.min(1, x));
}

export function placeToFreq(place: number): number {
  const x = Math.max(0, Math.min(1, place));
  return GW_A * (10 ** (GW_A_EXP * x) - GW_K);
}

export const COCHLEA_FMIN = placeToFreq(0.05);
export const COCHLEA_FMAX = placeToFreq(0.98);

export function formatHz(freq: number): string {
  if (freq >= 10000) return `${(freq / 1000).toFixed(2)} k`;
  if (freq >= 1000) return `${(freq / 1000).toFixed(3)} k`;
  if (freq >= 100) return freq.toFixed(1);
  return freq.toFixed(2);
}

export function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents >= 0 ? "+" : "−";
  return `${sign}${abs.toFixed(1)}`;
}
