import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  DEFAULT_CORNEA,
  PATHOLOGY,
  evaluateOptics,
  type CorneaParams,
  type LayerId,
  type OpticalReport,
  type PathologyId,
} from "./optics";

export type WorldId = "window" | "still-life" | "colonnade";

interface CorneaState extends CorneaParams {
  pathology: PathologyId;
  worldId: WorldId;
  cameraOn: boolean;
  cameraError: string | null;
  demoWorld: boolean;
  compare: boolean;
  showRays: boolean;
  crossSection: boolean;
  selectedLayer: LayerId | null;
  mosaic: boolean;
  intro: boolean;
  setParam: <K extends keyof CorneaParams>(key: K, value: CorneaParams[K]) => void;
  applyPathology: (id: PathologyId) => void;
  setWorld: (id: WorldId) => void;
  setDemoWorld: (v: boolean) => void;
  setCameraOn: (on: boolean, error?: string | null) => void;
  setCompare: (v: boolean) => void;
  setShowRays: (v: boolean) => void;
  setCrossSection: (v: boolean) => void;
  setSelectedLayer: (id: LayerId | null) => void;
  setMosaic: (v: boolean) => void;
  dismissIntro: () => void;
}

export const useCornea = create<CorneaState>((set) => ({
  ...DEFAULT_CORNEA,
  pathology: "healthy",
  worldId: "window",
  cameraOn: false,
  cameraError: null,
  demoWorld: true,
  compare: false,
  showRays: true,
  crossSection: false,
  selectedLayer: null,
  mosaic: true,
  intro: false,
  setParam: (key, value) => set({ [key]: value } as Partial<CorneaState>),
  applyPathology: (id) =>
    set({
      pathology: id,
      ...DEFAULT_CORNEA,
      ...PATHOLOGY[id].patch,
    }),
  setWorld: (id) => set({ worldId: id, cameraOn: false, cameraError: null, demoWorld: true }),
  setDemoWorld: (v) => set({ demoWorld: v }),
  setCameraOn: (on, error = null) =>
    set(
      on
        ? { cameraOn: true, cameraError: error ?? null, demoWorld: false }
        : { cameraOn: false, cameraError: error ?? null, demoWorld: true },
    ),
  setCompare: (v) => set({ compare: v }),
  setShowRays: (v) => set({ showRays: v }),
  setCrossSection: (v) => set({ crossSection: v }),
  setSelectedLayer: (id) => set({ selectedLayer: id }),
  setMosaic: (v) => set({ mosaic: v }),
  dismissIntro: () => set({ intro: false }),
}));

const PARAM_SELECTOR = (s: CorneaState): CorneaParams => ({
  anteriorRadiusMm: s.anteriorRadiusMm,
  posteriorRadiusMm: s.posteriorRadiusMm,
  thicknessMm: s.thicknessMm,
  qAnterior: s.qAnterior,
  qPosterior: s.qPosterior,
  diameterMm: s.diameterMm,
  opticalZoneMm: s.opticalZoneMm,
  pupilMm: s.pupilMm,
  astigmatismD: s.astigmatismD,
  axisDeg: s.axisDeg,
  hydration: s.hydration,
  tearFilm: s.tearFilm,
  ior: s.ior,
  siliconMm: s.siliconMm,
  keratoconus: s.keratoconus,
});

export function useCorneaParams(): CorneaParams {
  return useCornea(useShallow(PARAM_SELECTOR));
}

export function useOptics(): OpticalReport {
  return evaluateOptics(useCorneaParams());
}
