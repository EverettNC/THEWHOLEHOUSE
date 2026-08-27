/**
 * OpenSmell — the nose.
 *
 * One MQ-135 analog voltage is one voltage.
 * Twenty channel names are proxy labels, not GC-MS species.
 * Not a diagnosis. Not FDA-cleared. Simulation stays labeled.
 *
 * Live house-smell is serial, sniffing. File and sample are records.
 */

export const SMELL_ORGAN = "opensmell" as const;
export const SMELL_FAMILY = "christman-sound" as const;
export const OPENSMELL_GIT = "https://github.com/EverettNC/OpenSmell.git";

export const SENSOR_CHANNELS = [
  "acetone",
  "isoprene",
  "ammonia",
  "benzene",
  "alkanes",
  "aldehydes",
  "hydrocarbons",
  "dimethyl_sulfide",
  "sulfur",
  "aliphatic_acids",
  "skatole",
  "ketones",
  "sebum_vocs",
  "lipid_oxidation",
  "ethanol_trace",
  "toluene",
  "ethane",
  "propanol",
  "butane",
  "methane_trace",
] as const;

export type SensorChannel = (typeof SENSOR_CHANNELS)[number];

export type SmellKind = "serial" | "file" | "sample";
export type SmellClaim = "living" | "record" | "simulation";

export type SmellProfile = {
  key: string;
  condition: string;
  category: "cancer" | "neurological" | "metabolic" | "infectious" | "psychiatric";
  severity: "high" | "critical";
  channels: SensorChannel[];
};

export type SmellHit = {
  profileKey: string;
  condition: string;
  category: SmellProfile["category"];
  severity: SmellProfile["severity"];
  matchedChannels: SensorChannel[];
  coverage: number;
  meanIntensity: number;
  specificity: number;
  confidence: number;
  alert: boolean;
};

export type SmellReading = {
  kind: SmellKind;
  claim: SmellClaim;
  /** Reducing-gas intensity 0–1. Always present for a live scalar. */
  intensity: number;
  baseline: number | null;
  channels: Partial<Record<SensorChannel, number>> | null;
  at: number;
};

export type SmellTake = {
  id: string;
  at: number;
  reading: SmellReading;
  hits: SmellHit[];
  scalarOnly: boolean;
  honesty: {
    nose: SmellKind;
    claim: SmellClaim;
    channels: "proxy-labels" | "scalar";
    clinical: false;
    rule: string;
  };
};

export type SmellPacket = {
  organ: typeof SMELL_ORGAN;
  family: typeof SMELL_FAMILY;
  kind: "reading";
  take: SmellTake;
};

export const SMELL_HONESTY_RULE =
  "OpenSmell is one MQ-135 voltage, or a labeled file. Channel names are proxy labels, not GC-MS. Not a diagnosis. Sample air is not the house.";

export const DETECT_THRESHOLD = 0.3;
export const MIN_CONFIDENCE = 0.2;
export const ALERT_THRESHOLD = 0.7;
export const CLASSIFY_TOP_N = 3;
