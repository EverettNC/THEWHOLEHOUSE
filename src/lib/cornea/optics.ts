/** Gullstrand-style two-surface cornea. Distances in millimetres, power in diopters. */

export const N_AIR = 1.0;
export const N_TEAR = 1.336;
export const N_CORNEA = 1.376;
export const N_AQUEOUS = 1.336;

export const DEFAULT_CORNEA = {
  anteriorRadiusMm: 7.8,
  posteriorRadiusMm: 6.5,
  thicknessMm: 0.535,
  qAnterior: -0.26,
  qPosterior: -0.5,
  diameterMm: 11.5,
  opticalZoneMm: 8,
  pupilMm: 4,
  astigmatismD: 0,
  axisDeg: 180,
  hydration: 0.78,
  tearFilm: 0.94,
  ior: N_CORNEA,
  siliconMm: 24,
  keratoconus: 0,
} as const;

export type CorneaParams = { [K in keyof typeof DEFAULT_CORNEA]: number };

export type PathologyId =
  | "healthy"
  | "keratoconus"
  | "dryeye"
  | "edema"
  | "astigmatism"
  | "lasik";

export const PATHOLOGY: Record<
  PathologyId,
  { label: string; note: string; patch: Partial<CorneaParams> }
> = {
  healthy: {
    label: "Healthy",
    note: "Prolate asphere, 43 D, tear film intact.",
    patch: { ...DEFAULT_CORNEA },
  },
  keratoconus: {
    label: "Keratoconus",
    note: "Inferior steepening, irregular astigmatism, coma.",
    patch: {
      anteriorRadiusMm: 6.4,
      qAnterior: -1.15,
      astigmatismD: 3.4,
      axisDeg: 45,
      keratoconus: 1,
      tearFilm: 0.7,
    },
  },
  dryeye: {
    label: "Dry eye",
    note: "Tear-film breakup. Scatter and fluctuating focus.",
    patch: { tearFilm: 0.22, hydration: 0.7 },
  },
  edema: {
    label: "Edema",
    note: "Stromal swelling. Haze, thickened tissue, lost transparency.",
    patch: { thicknessMm: 0.72, hydration: 0.92, ior: 1.36, tearFilm: 0.55 },
  },
  astigmatism: {
    label: "Astigmatism",
    note: "Regular 2.25 D against-the-rule cylinder.",
    patch: { astigmatismD: 2.25, axisDeg: 90 },
  },
  lasik: {
    label: "Post-LASIK",
    note: "Flattened anterior surface. Oblate asphere.",
    patch: { anteriorRadiusMm: 8.55, qAnterior: 0.35, thicknessMm: 0.48 },
  },
};

export function surfacePowerD(nInc: number, nExt: number, radiusMm: number) {
  if (Math.abs(radiusMm) < 1e-6) return 0;
  return (nExt - nInc) / (radiusMm / 1000);
}

export function thickLensPowerD(Fa: number, Fp: number, thicknessMm: number, n: number) {
  const t = thicknessMm / 1000;
  return Fa + Fp - (t / n) * Fa * Fp;
}

export function asphericSag(r: number, radius: number, q: number) {
  const R = radius;
  const rr = r * r;
  const disc = 1 - (1 + q) * rr / (R * R);
  if (disc <= 0) return (R > 0 ? 1 : -1) * Math.abs(R);
  return rr / R / (1 + Math.sqrt(disc));
}

export function asphericSlope(r: number, radius: number, q: number) {
  const h = 1e-4;
  return (asphericSag(r + h, radius, q) - asphericSag(r - h, radius, q)) / (2 * h);
}

export interface OpticalReport {
  anteriorPowerD: number;
  posteriorPowerD: number;
  totalPowerD: number;
  focalLengthAirMm: number;
  focalLengthAqueousMm: number;
  defocusD: number;
  k1: number;
  k2: number;
  scatter: number;
  transmission: number;
}

export function evaluateOptics(p: CorneaParams): OpticalReport {
  const nC = p.ior;
  const Fa = surfacePowerD(N_AIR, nC, p.anteriorRadiusMm);
  const Fp = surfacePowerD(nC, N_AQUEOUS, p.posteriorRadiusMm);
  const F = thickLensPowerD(Fa, Fp, p.thicknessMm, nC);
  const fAir = F === 0 ? 1e6 : 1000 / F;
  const fAq = F === 0 ? 1e6 : (N_AQUEOUS * 1000) / F;
  const k1 = 337.5 / p.anteriorRadiusMm;
  const k2 = k1 + p.astigmatismD;
  const hydrationScatter = Math.max(0, (p.hydration - 0.78) * 3.4) + Math.max(0, 0.78 - p.hydration) * 0.6;
  const tearScatter = (1 - p.tearFilm) * 0.45;
  const edemaScatter = Math.max(0, p.thicknessMm - 0.535) * 1.8;
  const scatter = Math.min(1, hydrationScatter + tearScatter + edemaScatter + p.keratoconus * 0.12);
  const transmission = Math.max(0.35, 0.98 - scatter * 0.55) * (0.7 + 0.3 * p.tearFilm);
  const defocusD = F - 1000 / Math.max(8, p.siliconMm);
  return {
    anteriorPowerD: Fa,
    posteriorPowerD: Fp,
    totalPowerD: F,
    focalLengthAirMm: fAir,
    focalLengthAqueousMm: fAq,
    defocusD,
    k1,
    k2,
    scatter,
    transmission,
  };
}

export function formatDiopter(d: number) {
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d.toFixed(2)} D`;
}

export function formatMm(n: number, digits = 2) {
  return `${n.toFixed(digits)} mm`;
}

type Vec2 = [number, number];

function norm2(v: Vec2): Vec2 {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

function refract2d(inc: Vec2, normal: Vec2, n1: number, n2: number): Vec2 {
  const i = norm2(inc);
  let n = norm2(normal);
  let cosi = -(n[0] * i[0] + n[1] * i[1]);
  if (cosi < 0) {
    n = [-n[0], -n[1]];
    cosi = -(n[0] * i[0] + n[1] * i[1]);
  }
  const eta = n1 / n2;
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) {
    const dot = 2 * (i[0] * n[0] + i[1] * n[1]);
    return [i[0] - dot * n[0], i[1] - dot * n[1]];
  }
  const a = eta;
  const b = eta * cosi - Math.sqrt(k);
  return norm2([a * i[0] + b * n[0], a * i[1] + b * n[1]]);
}

export interface RayPath {
  points: [number, number][];
}

export function traceMeridianRays(p: CorneaParams, heights: number[], zStart = -18, zEnd?: number): RayPath[] {
  const report = evaluateOptics(p);
  const endZ = zEnd ?? Math.max(p.siliconMm + 2, report.focalLengthAirMm + 2);
  const nC = p.ior;
  return heights.map((h0) => {
    const points: [number, number][] = [];
    let h = h0;
    let z = zStart;
    let dir: Vec2 = [0, 1];
    points.push([h, z]);

    const hitAnterior = () => {
      for (let s = 0; s < 80; s++) {
        const sag = asphericSag(Math.abs(h), p.anteriorRadiusMm, p.qAnterior);
        if (z >= sag - 0.02) return true;
        z += dir[1] * 0.08;
        h += dir[0] * 0.08;
        if (Math.abs(h) > p.diameterMm / 2 + 0.4) return false;
      }
      return false;
    };

    if (!hitAnterior()) {
      points.push([h + dir[0] * 8, z + dir[1] * 8]);
      return { points };
    }
    const slopeA = asphericSlope(Math.abs(h), p.anteriorRadiusMm, p.qAnterior) * Math.sign(h || 1);
    const nA: Vec2 = norm2([-slopeA, 1]);
    dir = refract2d(dir, nA, N_AIR, nC);
    points.push([h, z]);

    const hitPosterior = () => {
      for (let s = 0; s < 60; s++) {
        const sagP = p.thicknessMm + asphericSag(Math.abs(h), p.posteriorRadiusMm, p.qPosterior);
        if (z >= sagP - 0.01) return true;
        z += dir[1] * 0.04;
        h += dir[0] * 0.04;
        if (Math.abs(h) > p.diameterMm / 2) return false;
      }
      return false;
    };

    if (!hitPosterior()) {
      points.push([h, z]);
      return { points };
    }
    const slopeP = asphericSlope(Math.abs(h), p.posteriorRadiusMm, p.qPosterior) * Math.sign(h || 1);
    const nP: Vec2 = norm2([-slopeP, 1]);
    dir = refract2d(dir, nP, nC, N_AQUEOUS);
    points.push([h, z]);

    const remain = endZ - z;
    if (remain > 0 && dir[1] > 1e-6) {
      const t = remain / dir[1];
      points.push([h + dir[0] * t, z + dir[1] * t]);
    } else {
      points.push([h + dir[0] * 6, z + dir[1] * 6]);
    }
    return { points };
  });
}

export const LAYERS = [
  {
    id: "epithelium",
    name: "Epithelium",
    thicknessUm: 50,
    role: "Barrier and tear-film bed. Regenerates in days.",
  },
  {
    id: "bowman",
    name: "Bowman",
    thicknessUm: 12,
    role: "Acellular collagen. Mechanical stability.",
  },
  {
    id: "stroma",
    name: "Stroma",
    thicknessUm: 450,
    role: "Ninety percent of thickness. Ordered collagen keeps it clear.",
  },
  {
    id: "descemet",
    name: "Descemet",
    thicknessUm: 10,
    role: "Basement membrane of the endothelium.",
  },
  {
    id: "endothelium",
    name: "Endothelium",
    thicknessUm: 5,
    role: "Pump. Keeps stroma deturgesced so silicon can see.",
  },
] as const;

export type LayerId = (typeof LAYERS)[number]["id"];

export const WORLDS = [
  {
    id: "window",
    src: "/worlds/window.jpg",
    label: "Window",
    note: "Near-field garden. Depth and glare.",
  },
  {
    id: "still-life",
    src: "/worlds/still-life.jpg",
    label: "Still life",
    note: "Specular glass, mixed distances.",
  },
  {
    id: "colonnade",
    src: "/worlds/colonnade.jpg",
    label: "Colonnade",
    note: "Deep perspective, high contrast.",
  },
] as const;
