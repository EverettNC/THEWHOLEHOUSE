import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_LEXICON } from "./lexicon";
import type {
  HonestyDialect,
  HonestyEar,
  LexiconEntry,
  PorchCorrection,
  PorchTake,
} from "./types";

const HISTORY_CAP = 40;
const STORAGE_KEY = "christman-porch-v1";

const DEFAULT_SAID = new Set(
  DEFAULT_LEXICON.map((e) => e.said.toLowerCase()),
);

export function isDefaultSaid(said: string): boolean {
  return DEFAULT_SAID.has(said.trim().toLowerCase());
}

export function taughtLexicon(lexicon: LexiconEntry[]): LexiconEntry[] {
  return lexicon.filter((e) => !isDefaultSaid(e.said));
}

type PorchPersisted = {
  history: PorchTake[];
  extraLexicon: LexiconEntry[];
  activeId: string | null;
};

export type PorchState = {
  history: PorchTake[];
  lexicon: LexiconEntry[];
  activeId: string | null;
  addTake: (take: PorchTake) => void;
  setActive: (id: string | null) => void;
  teachLexicon: (saidOrEntry: LexiconEntry | string, keep?: string, note?: string) => void;
  removeLexicon: (said: string) => void;
  clearHistory: () => void;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function isPorchCorrection(value: unknown): value is PorchCorrection {
  const rec = asRecord(value);
  return (
    !!rec &&
    typeof rec.from === "string" &&
    typeof rec.to === "string" &&
    typeof rec.why === "string"
  );
}

function isHonestyEar(value: unknown): value is HonestyEar {
  return value === "xai-stt" || value === "sample" || value === "file";
}

function isHonestyDialect(value: unknown): value is HonestyDialect {
  return value === "grok-4.5" || value === "passthrough";
}

function isPorchTake(value: unknown): value is PorchTake {
  const rec = asRecord(value);
  if (!rec) return false;
  const honesty = asRecord(rec.honesty);
  if (!honesty) return false;
  return (
    typeof rec.id === "string" &&
    typeof rec.at === "number" &&
    typeof rec.durationMs === "number" &&
    typeof rec.asSaid === "string" &&
    typeof rec.forTheFamily === "string" &&
    typeof rec.rawEar === "string" &&
    Array.isArray(rec.corrections) &&
    rec.corrections.every(isPorchCorrection) &&
    Array.isArray(rec.route) &&
    rec.route.every((r) => typeof r === "string") &&
    isHonestyEar(honesty.ear) &&
    isHonestyDialect(honesty.dialect) &&
    honesty.corti === "not-this-nerve" &&
    honesty.cloud === true &&
    typeof honesty.rule === "string"
  );
}

function isLexiconEntry(value: unknown): value is LexiconEntry {
  const rec = asRecord(value);
  return (
    !!rec &&
    typeof rec.said === "string" &&
    typeof rec.keep === "string" &&
    typeof rec.note === "string"
  );
}

function asPersisted(value: unknown): PorchPersisted | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const history = Array.isArray(rec.history)
    ? rec.history.filter(isPorchTake).slice(0, HISTORY_CAP)
    : [];
  const extraLexicon = Array.isArray(rec.extraLexicon)
    ? rec.extraLexicon.filter(isLexiconEntry).filter((e) => !isDefaultSaid(e.said))
    : [];
  const activeId =
    rec.activeId === null || typeof rec.activeId === "string"
      ? rec.activeId
      : null;
  return { history, extraLexicon, activeId };
}

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const usePorch = create<PorchState>()(
  persist(
    (set) => ({
      history: [],
      lexicon: [...DEFAULT_LEXICON],
      activeId: null,
      addTake: (take) =>
        set((s) => ({
          history: [take, ...s.history].slice(0, HISTORY_CAP),
          activeId: take.id,
        })),
      setActive: (id) => set({ activeId: id }),
      teachLexicon: (saidOrEntry: string | LexiconEntry, keep?: string, note?: string) => {
        const s =
          typeof saidOrEntry === "string"
            ? saidOrEntry.trim()
            : saidOrEntry.said.trim();
        const k =
          typeof saidOrEntry === "string"
            ? (keep ?? "").trim()
            : saidOrEntry.keep.trim();
        const n =
          typeof saidOrEntry === "string"
            ? (note ?? "").trim()
            : saidOrEntry.note.trim();
        if (!s || !k) return;
        if (isDefaultSaid(s)) return;
        set((state) => {
          const extras = taughtLexicon(state.lexicon).filter(
            (e) => e.said.toLowerCase() !== s.toLowerCase(),
          );
          return {
            lexicon: [...DEFAULT_LEXICON, ...extras, { said: s, keep: k, note: n }],
          };
        });
      },
      removeLexicon: (said) => {
        const target = said.trim().toLowerCase();
        if (!target || isDefaultSaid(target)) return;
        set((state) => ({
          lexicon: [
            ...DEFAULT_LEXICON,
            ...taughtLexicon(state.lexicon).filter(
              (e) => e.said.toLowerCase() !== target,
            ),
          ],
        }));
      },
      clearHistory: () => set({ history: [], activeId: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : localStorage,
      ),
      partialize: (s): PorchPersisted => ({
        history: s.history.slice(0, HISTORY_CAP),
        extraLexicon: taughtLexicon(s.lexicon),
        activeId: s.activeId,
      }),
      merge: (persisted, current) => {
        const p = asPersisted(persisted);
        if (!p) return current;
        return {
          ...current,
          history: p.history,
          lexicon: [...DEFAULT_LEXICON, ...p.extraLexicon],
          activeId: p.activeId,
        };
      },
    },
  ),
);
