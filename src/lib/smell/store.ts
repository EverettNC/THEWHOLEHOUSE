import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { classify, isScalarOnly } from "./classify";
import { honestyFor } from "./packet";
import type { SmellReading, SmellTake } from "./types";

const HISTORY_CAP = 24;
const STORAGE_KEY = "christman-opensmell-v1";

type SmellState = {
  history: SmellTake[];
  activeId: string | null;
  sniffing: boolean;
  liveKind: SmellReading["kind"] | null;
  liveIntensity: number | null;
  liveBaseline: number | null;
  addTake: (reading: SmellReading) => SmellTake;
  setActive: (id: string | null) => void;
  setLive: (args: {
    sniffing: boolean;
    kind: SmellReading["kind"] | null;
    intensity: number | null;
    baseline: number | null;
  }) => void;
  clearHistory: () => void;
};

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `smell-${Date.now()}`;
}

export const useSmell = create<SmellState>()(
  persist(
    (set) => ({
      history: [],
      activeId: null,
      sniffing: false,
      liveKind: null,
      liveIntensity: null,
      liveBaseline: null,
      addTake: (reading) => {
        const scalarOnly = isScalarOnly(reading.channels);
        const take: SmellTake = {
          id: newId(),
          at: reading.at,
          reading,
          hits: classify(reading.channels),
          scalarOnly,
          honesty: honestyFor(reading.kind, reading.claim, scalarOnly),
        };
        set((s) => ({
          history: [take, ...s.history].slice(0, HISTORY_CAP),
          activeId: take.id,
        }));
        return take;
      },
      setActive: (id) => set({ activeId: id }),
      setLive: ({ sniffing, kind, intensity, baseline }) =>
        set({
          sniffing,
          liveKind: sniffing ? kind : null,
          liveIntensity: sniffing ? intensity : null,
          liveBaseline: sniffing ? baseline : null,
        }),
      clearHistory: () => set({ history: [], activeId: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ history: s.history, activeId: s.activeId }),
    },
  ),
);
