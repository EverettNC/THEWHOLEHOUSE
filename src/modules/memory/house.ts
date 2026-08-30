/**
 * Fifth stream — the building.
 * CORTI is the ear. LUCENT is the eye. OpenSmell is the nose. Skin is the body.
 * Porch is the words. Completeness is six booleans. Whole-environment needs
 * place plus two unattended ambient features. No invented pitch, gas, or pose.
 * Words are attended. They still land in the building for the family to pull.
 */
export const HOUSE_CHANNEL = "christman.house.record";

export const CORTI_GIT = "https://github.com/EverettNC/CORTI.git";
export const LUCENT_GIT = "https://github.com/EverettNC/LUCENT.git";
export const OPENSMELL_GIT = "https://github.com/EverettNC/OpenSmell.git";
export const CORTI_RECORD_URL =
  "https://raw.githubusercontent.com/EverettNC/CORTI/main/house/record.json";
export const LUCENT_RECORD_URL =
  "https://raw.githubusercontent.com/EverettNC/LUCENT/main/house/record.json";

export const SILENCE_RMS = 0.008;

export type Completeness = {
  sight: boolean;
  sound: boolean;
  smell: boolean;
  body: boolean;
  place: boolean;
  time: boolean;
};

export type CortiEar = {
  listening: boolean;
  rms: number;
  zcr: number;
  f0: number | null;
  locked: boolean;
};

export type LucentEye = {
  seeing: boolean;
  kind: "camera" | "screen" | "file" | "world" | null;
  transmission: number;
  focused: boolean;
};

export type SmellNose = {
  sniffing: boolean;
  kind: "serial" | "file" | "sample" | null;
  intensity: number | null;
  baseline: number | null;
  delta: number | null;
  live: boolean;
};

export type SkinBody = {
  contacting: boolean;
  motion: boolean;
  pressure: number | null;
  beta: number | null;
  gamma: number | null;
  accel: number | null;
  posture: "sit" | "lean" | "fit" | "still" | null;
  live: boolean;
};

export type PorchMouth = {
  speaking: boolean;
  asSaid: string;
  at: number;
};

export type HouseTick = {
  t: number;
  completeness: Completeness;
  wholeEnvironment: boolean;
  corti: CortiEar | null;
  lucent: LucentEye | null;
  smell: SmellNose | null;
  skin: SkinBody | null;
  porch: PorchMouth | null;
  text: string;
};

export type HousePartial = {
  source: "corti" | "lucent" | "opensmell" | "skin" | "porch";
  t: number;
  corti?: CortiEar;
  lucent?: LucentEye;
  smell?: SmellNose;
  skin?: SkinBody;
  porch?: PorchMouth;
};

export function emptyCompleteness(): Completeness {
  return {
    sight: false,
    sound: false,
    smell: false,
    body: false,
    place: false,
    time: false,
  };
}

export function ambientCount(c: Completeness): number {
  return Number(c.sight) + Number(c.sound) + Number(c.smell) + Number(c.body);
}

/** Protocol §11. Place plus at least two unattended ambient features. */
export function wholeEnvironment(c: Completeness): boolean {
  return c.place && ambientCount(c) >= 2;
}

export function earFromFrame(args: {
  listening: boolean;
  rms: number;
  zcr: number;
  f0: number | null;
}): CortiEar {
  const locked =
    args.listening && args.f0 != null && Number.isFinite(args.f0) && args.f0 > 0;
  return {
    listening: args.listening,
    rms: args.rms,
    zcr: args.zcr,
    f0: locked ? args.f0 : null,
    locked,
  };
}

export function eyeFromLive(args: {
  status: string;
  kind: LucentEye["kind"];
  transmission: number;
  defocusD: number;
}): LucentEye {
  const seeing = args.status === "live";
  return {
    seeing,
    kind: seeing ? args.kind : null,
    transmission: args.transmission,
    focused: seeing && Math.abs(args.defocusD) < 0.5,
  };
}

/**
 * Live house-smell is serial, sniffing. File and sample are records.
 * One voltage is one voltage. Do not invent benzene.
 */
export function noseFromReading(args: {
  sniffing: boolean;
  kind: SmellNose["kind"];
  intensity: number | null;
  baseline: number | null;
}): SmellNose {
  const intensity =
    args.sniffing && args.intensity != null && Number.isFinite(args.intensity)
      ? args.intensity
      : null;
  const baseline =
    args.sniffing && args.baseline != null && Number.isFinite(args.baseline)
      ? args.baseline
      : null;
  const delta = intensity != null && baseline != null ? intensity - baseline : intensity;
  const live = Boolean(args.sniffing && args.kind === "serial" && intensity != null);
  return {
    sniffing: args.sniffing,
    kind: args.sniffing ? args.kind : null,
    intensity,
    baseline,
    delta: args.sniffing ? delta : null,
    live,
  };
}

/**
 * Live body is contact or motion with a real reading.
 * Do not invent a pose when the gyroscope is not here.
 */
export function bodyFromSkin(args: {
  contacting: boolean;
  motion: boolean;
  pressure: number | null;
  beta: number | null;
  gamma: number | null;
  accel: number | null;
}): SkinBody {
  const pressure =
    args.contacting && args.pressure != null && Number.isFinite(args.pressure)
      ? args.pressure
      : null;
  const beta = args.motion && args.beta != null && Number.isFinite(args.beta) ? args.beta : null;
  const gamma =
    args.motion && args.gamma != null && Number.isFinite(args.gamma) ? args.gamma : null;
  const accel =
    args.motion && args.accel != null && Number.isFinite(args.accel) ? args.accel : null;
  const lean = gamma != null && Math.abs(gamma) > 12;
  const sit = accel != null && accel < 0.15;
  const live = args.contacting || args.motion;
  const posture: SkinBody["posture"] = !live
    ? null
    : lean
      ? "lean"
      : sit
        ? "sit"
        : args.contacting
          ? "fit"
          : "still";
  return {
    contacting: args.contacting,
    motion: args.motion,
    pressure,
    beta,
    gamma,
    accel,
    posture,
    live,
  };
}

export function describeHouse(
  corti: CortiEar | null,
  lucent: LucentEye | null,
  smell: SmellNose | null = null,
  skin: SkinBody | null = null,
  porch: PorchMouth | null = null,
): string {
  const ear = !corti?.listening
    ? "Ear not listening."
    : corti.rms <= SILENCE_RMS
      ? "Corti open. Quiet."
      : corti.locked && corti.f0 != null
        ? `Corti hearing. Energy ${corti.rms.toFixed(3)}. Pitch ${Math.round(corti.f0)} Hz.`
        : `Corti hearing. Energy ${corti.rms.toFixed(3)}. Real sound. No pitch lock.`;
  const eye = !lucent?.seeing
    ? "Eye not seeing the house."
    : lucent.focused
      ? "Light in. In focus."
      : "Light in.";
  const nose = !smell?.sniffing
    ? "Nose not sniffing."
    : smell.live && smell.intensity != null
      ? `Nose live. Intensity ${smell.intensity.toFixed(2)}.`
      : smell.kind === "sample"
        ? "Sample air. Not the house."
        : smell.kind === "file"
          ? "Recorded air. Not the house."
          : "Nose open. No live voltage.";
  const body = !skin?.live
    ? "Skin not on."
    : `Haptic. ${
        skin.posture === "lean"
          ? "Leaning."
          : skin.posture === "sit"
            ? "Sitting."
            : skin.contacting
              ? "Contact."
              : "Still."
      }${skin.pressure != null ? ` Pressure ${skin.pressure.toFixed(2)}.` : ""}`;
  const words =
    porch?.speaking && porch.asSaid.trim()
      ? `Porch: ${porch.asSaid.trim().slice(0, 160)}`
      : "Porch quiet.";
  return `The building continues. ${ear} ${eye} ${nose} ${body} ${words}`;
}

export function mergeHouse(
  corti: CortiEar | null,
  lucent: LucentEye | null,
  smell: SmellNose | null,
  skin: SkinBody | null,
  t: number,
  porch: PorchMouth | null = null,
): HouseTick {
  const sound = Boolean(corti?.listening && corti.rms > SILENCE_RMS);
  const sight = Boolean(lucent?.seeing);
  const completeness: Completeness = {
    sight,
    sound,
    smell: Boolean(smell?.live),
    body: Boolean(skin?.live),
    place: true,
    time: true,
  };
  return {
    t,
    completeness,
    wholeEnvironment: wholeEnvironment(completeness),
    corti,
    lucent,
    smell,
    skin,
    porch,
    text: describeHouse(corti, lucent, smell, skin, porch),
  };
}

export function parsePartial(raw: unknown): HousePartial | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<HousePartial>;
  if (
    p.source !== "corti" &&
    p.source !== "lucent" &&
    p.source !== "opensmell" &&
    p.source !== "skin" &&
    p.source !== "porch"
  ) {
    return null;
  }
  if (typeof p.t !== "number" || !Number.isFinite(p.t)) return null;
  return p as HousePartial;
}

let lastCorti: CortiEar | null = null;
let lastLucent: LucentEye | null = null;
let lastSmell: SmellNose | null = null;
let lastSkin: SkinBody | null = null;
let lastPorch: PorchMouth | null = null;
let latest: HouseTick | null = null;

export function latestHouseTick(): HouseTick | null {
  return latest;
}

export function notePartial(partial: HousePartial): HouseTick {
  if (partial.source === "corti" && partial.corti) lastCorti = partial.corti;
  if (partial.source === "lucent" && partial.lucent) lastLucent = partial.lucent;
  if (partial.source === "opensmell" && partial.smell) lastSmell = partial.smell;
  if (partial.source === "skin" && partial.skin) lastSkin = partial.skin;
  if (partial.source === "porch" && partial.porch) lastPorch = partial.porch;
  latest = mergeHouse(lastCorti, lastLucent, lastSmell, lastSkin, partial.t, lastPorch);
  return latest;
}

export function startHouseListener(): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return () => {};
  }
  const ch = new BroadcastChannel(HOUSE_CHANNEL);
  ch.onmessage = (ev) => {
    const partial = parsePartial(ev.data);
    if (partial) notePartial(partial);
  };
  void hydrateFromGit();
  return () => ch.close();
}

async function hydrateFromGit() {
  const urls = [CORTI_RECORD_URL, LUCENT_RECORD_URL, "/house/record.json"];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const body = (await res.json()) as { ticks?: unknown[] };
      const ticks = Array.isArray(body.ticks) ? body.ticks : [];
      for (const raw of ticks) {
        const partial = parsePartial(raw);
        if (partial) notePartial(partial);
      }
    } catch {
      /* git or local cache may be unreachable from this origin */
    }
  }
}
