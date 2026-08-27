import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { honestyFor } from "./packet";
import type { SkinFrame, SkinKind, SkinTake } from "./types";

const HISTORY_CAP = 24;
const STORAGE_KEY = "christman.skin.takes.v1";

type SkinState = {
  takes: SkinTake[];
  activeId: string | null;
  frame: SkinFrame | null;
  addTake: (take: Omit<SkinTake, "id" | "honesty"> & { kind: SkinKind }) => SkinTake;
  setFrame: (frame: SkinFrame | null) => void;
  setActive: (id: string | null) => void;
};

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `skin-${Date.now()}`;
}

export const useSkin = create<SkinState>()(
  persist(
    (set) => ({
      takes: [],
      activeId: null,
      frame: null,
      addTake: (partial) => {
        const take: SkinTake = {
          id: newId(),
          at: partial.at,
          durationMs: partial.durationMs,
          peakPressure: partial.peakPressure,
          posture: partial.posture,
          kind: partial.kind,
          honesty: honestyFor(partial.kind, partial.kind !== "pointer"),
        };
        set((s) => ({
          takes: [take, ...s.takes].slice(0, HISTORY_CAP),
          activeId: take.id,
        }));
        return take;
      },
      setFrame: (frame) => set({ frame }),
      setActive: (id) => set({ activeId: id }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ takes: s.takes, activeId: s.activeId }),
    },
  ),
);
