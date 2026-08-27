import { create } from "zustand";
import {
  CHANNELS,
  LEGACY_STORAGE_KEY,
  OPENED_KEY,
  RESONANCE_GATE,
  SEED_SCENES,
  STORAGE_KEY,
  applyNight,
  applyRem,
  canReclaim,
  complete,
  decayAccumulators,
  emptyChannels,
  emptyFacets,
  migrateScene,
  pulseAccumulators,
  reclaimScene,
  tokenize,
  type Accumulator,
  type AmbientTick,
  type Channel,
  type Channels,
  type Claim,
  type Completion,
  type Door,
  type Facet,
  type Facets,
  type Scene,
  type ShadowHit,
} from "./model";
import { latestHouseTick, mergeHouse } from "./house";

type Mode = "chamber" | "write" | "returned";

type MemoryState = {
  scenes: Scene[];
  ambient: AmbientTick[];
  accumulators: Accumulator[];
  shadows: ShadowHit[];
  completedIds: string[];
  openedAt: number;
  now: number;
  hydrated: boolean;
  mode: Mode;
  door: Door;
  cue: string;
  lastCompletion: Completion | null;
  lastSilence: string | null;
  nightLog: string | null;
  pressure: string | null;
  draftTitle: string;
  draft: Channels;
  draftFacets: Facets;
  leftHomeostasis: boolean;
  procedure: boolean;
  claim: Claim;
};

type MemoryActions = {
  hydrate: () => void;
  tick: (now: number) => void;
  setCue: (cue: string) => void;
  setDoor: (door: Door) => void;
  ask: () => void;
  openWrite: () => void;
  cancelWrite: () => void;
  setDraftTitle: (s: string) => void;
  setDraftChannel: (ch: Channel, v: string) => void;
  setDraftFacet: (f: Facet, v: string) => void;
  setLeftHomeostasis: (v: boolean) => void;
  setProcedure: (v: boolean) => void;
  setClaim: (c: Claim) => void;
  writeScene: () => void;
  runNight: () => void;
  openScene: (id: string) => void;
  closeReturned: () => void;
  reclaim: (id: string) => void;
};

const MAX_AMBIENT = 24;
const MAX_SCENES = 40;
const MAX_SHADOWS = 16;

function persist(scenes: Scene[]) {
  try {
    const owned = scenes.filter((s) => !s.seeded);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(owned));
  } catch {
    /* ignore */
  }
}

function loadOwned(): Scene[] {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateScene).filter((s): s is Scene => s !== null);
  } catch {
    return [];
  }
}

function loadOpened(): number {
  try {
    const raw = localStorage.getItem(OPENED_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const now = Date.now();
    localStorage.setItem(OPENED_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

export const useMemory = create<MemoryState & MemoryActions>((set, get) => ({
  scenes: SEED_SCENES,
  ambient: [],
  accumulators: [],
  shadows: [],
  completedIds: [],
  openedAt: 0,
  now: 0,
  hydrated: false,
  mode: "chamber",
  door: "any",
  cue: "",
  lastCompletion: null,
  lastSilence: null,
  nightLog: null,
  pressure: null,
  draftTitle: "",
  draft: emptyChannels(),
  draftFacets: emptyFacets(),
  leftHomeostasis: false,
  procedure: false,
  claim: "record",

  hydrate: () => {
    if (get().hydrated) return;
    const owned = loadOwned();
    const openedAt = loadOpened();
    const byId = new Map<string, Scene>();
    for (const s of SEED_SCENES) byId.set(s.id, s);
    for (const s of owned) byId.set(s.id, s);
    set({
      scenes: [...byId.values()].sort((a, b) => a.spiralDepth - b.spiralDepth || b.writtenAt - a.writtenAt),
      openedAt,
      now: Date.now(),
      hydrated: true,
    });
  },

  tick: (now) => {
    const { openedAt, ambient, hydrated, cue, scenes, accumulators, mode } = get();
    if (!hydrated || openedAt === 0) {
      set({ now });
      return;
    }

    let nextAcc = decayAccumulators(accumulators, now);
    if (cue.trim()) nextAcc = pulseAccumulators(nextAcc, scenes, cue, now);

    const pressing = nextAcc
      .filter((a) => a.resonance >= RESONANCE_GATE)
      .map((a) => scenes.find((s) => s.id === a.sceneId))
      .filter((s): s is Scene => Boolean(s));

    let pressure: string | null = null;
    if (pressing.length === 1 && mode === "chamber") {
      pressure = `A room is pressing. ${pressing[0].title}. Process is still the gateway.`;
    } else if (pressing.length > 1 && mode === "chamber") {
      pressure = "More than one room is pressing. Ambiguous stays silent.";
    }

    const lastT = ambient[ambient.length - 1]?.t ?? 0;
    const shouldWrite = ambient.length === 0 || now - lastT >= 8000;
    if (!shouldWrite) {
      set({ now, accumulators: nextAcc, pressure });
      return;
    }
    const house = latestHouseTick() ?? mergeHouse(null, null, null, null, now);
    const tick: AmbientTick = {
      t: now,
      text: house.text,
      completeness: house.completeness,
      wholeEnvironment: house.wholeEnvironment,
    };
    set({
      now,
      accumulators: nextAcc,
      pressure,
      ambient: [...ambient.slice(-(MAX_AMBIENT - 1)), tick],
    });
  },

  setCue: (cue) => set({ cue, lastSilence: null }),
  setDoor: (door) => set({ door, lastSilence: null }),

  ask: () => {
    const { cue, scenes, door, now, shadows, accumulators } = get();
    const outcome = complete(cue, scenes, door);
    const nextAcc = pulseAccumulators(accumulators, scenes, cue, now);

    if (!outcome.hit) {
      const additions: ShadowHit[] = outcome.shadows.map((s) => ({
        t: now,
        cue,
        sceneId: s.sceneId,
        doors: s.doors,
        reason: s.reason,
      }));
      const nextScenes = scenes.map((scene) =>
        outcome.shadows.some((s) => s.sceneId === scene.id)
          ? { ...scene, shadowHits: scene.shadowHits + 1 }
          : scene,
      );
      persist(nextScenes);
      set({
        scenes: nextScenes,
        accumulators: nextAcc,
        lastCompletion: null,
        lastSilence: "No completion. A single word is not a room.",
        mode: "chamber",
        shadows: [...additions, ...shadows].slice(0, MAX_SHADOWS),
      });
      return;
    }

    const acc = nextAcc.find((a) => a.sceneId === outcome.hit!.scene.id);
    const explicit = tokenize(cue).length >= 2 || outcome.hit.unique.length >= 1;
    if (!explicit && (acc?.resonance ?? 0) < RESONANCE_GATE) {
      const shadow: ShadowHit = {
        t: now,
        cue,
        sceneId: outcome.hit.scene.id,
        doors: outcome.hit.doors,
        reason: "low-resonance",
      };
      set({
        accumulators: nextAcc,
        lastCompletion: null,
        lastSilence: "Near the room. Resonance has not crossed the gate.",
        mode: "chamber",
        shadows: [shadow, ...shadows].slice(0, MAX_SHADOWS),
      });
      return;
    }

    set((state) => ({
      accumulators: nextAcc,
      lastCompletion: outcome.hit,
      lastSilence: null,
      mode: "returned",
      completedIds: [outcome.hit!.scene.id, ...state.completedIds].slice(0, 24),
    }));
  },

  openWrite: () => {
    const { ambient, now } = get();
    const last = ambient
      .slice(-3)
      .map((a) => a.text)
      .join(" ");
    const house = latestHouseTick();
    const place = [
      `The building, ${new Date(now).toUTCString()}.`,
      house?.text ?? last,
    ]
      .filter(Boolean)
      .join(" ");
    set({
      mode: "write",
      lastSilence: null,
      lastCompletion: null,
      draftTitle: "",
      draft: { ...emptyChannels(), place },
      draftFacets: emptyFacets(),
      leftHomeostasis: false,
      procedure: false,
      claim: "record",
      nightLog: null,
    });
  },

  cancelWrite: () => set({ mode: "chamber" }),
  setDraftTitle: (s) => set({ draftTitle: s }),
  setDraftChannel: (ch, v) => set((s) => ({ draft: { ...s.draft, [ch]: v } })),
  setDraftFacet: (f, v) => set((s) => ({ draftFacets: { ...s.draftFacets, [f]: v } })),
  setLeftHomeostasis: (v) => set({ leftHomeostasis: v }),
  setProcedure: (v) => set({ procedure: v }),
  setClaim: (c) => set({ claim: c }),

  writeScene: () => {
    const {
      draftTitle,
      draft,
      draftFacets,
      leftHomeostasis,
      procedure,
      claim,
      scenes,
      openedAt,
      now,
    } = get();
    const title = draftTitle.trim() || "Untitled room";
    const filled = CHANNELS.some((c) => draft[c].trim().length > 0);
    if (!filled) return;
    const channels = {
      sight: draft.sight.trim(),
      sound: draft.sound.trim(),
      smell: draft.smell.trim(),
      body: draft.body.trim(),
      place: draft.place.trim(),
    };
    const scene: Scene = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `s-${now}`,
      title,
      writtenAt: now,
      claim,
      job: "pending",
      leftHomeostasis,
      procedure,
      channels,
      facets: {
        structural: draftFacets.structural.trim(),
        stakes: draftFacets.stakes.trim(),
        role: draftFacets.role.trim(),
        constraint: draftFacets.constraint.trim(),
        room: draftFacets.room.trim(),
      },
      indexSignature: [],
      spiralDepth: 0,
      shadowHits: 0,
      reclaimed: false,
      durationMs: Math.max(0, now - openedAt),
      seeded: false,
    };
    scene.indexSignature = tokenize(
      scene.title + " " + CHANNELS.map((c) => scene.channels[c]).join(" "),
    );
    const next = [scene, ...scenes].slice(0, MAX_SCENES);
    persist(next);
    set({
      scenes: next,
      mode: "returned",
      lastCompletion: {
        scene,
        doors: CHANNELS.filter((c) => scene.channels[c]),
        unique: [],
        facets: [],
      },
      lastSilence: null,
      draft: emptyChannels(),
      draftFacets: emptyFacets(),
      draftTitle: "",
    });
  },

  runNight: () => {
    const before = get().scenes;
    const afterJobs = applyNight(before);
    const next = applyRem(afterJobs, get().completedIds, get().now);
    const thrown = before.filter(
      (s) => s.job === "pending" && !s.leftHomeostasis && !s.procedure,
    ).length;
    const held = before.filter((s) => s.job === "pending" && s.leftHomeostasis).length;
    const folded = before.filter(
      (s) => s.job === "pending" && s.procedure && !s.leftHomeostasis,
    ).length;
    persist(next);
    set({
      scenes: next.sort((a, b) => a.spiralDepth - b.spiralDepth || b.writtenAt - a.writtenAt),
      nightLog: `Night ran. Level 3 held ${held}. Level 2 compressed ${folded}. Level 1 thrown ${thrown}. REM reindexed ${next.filter((s) => s.job !== "throwaway").length}.`,
      mode: "chamber",
      lastCompletion: null,
      completedIds: [],
    });
  },

  openScene: (id) => {
    const scene = get().scenes.find((s) => s.id === id);
    if (!scene) return;
    set((state) => ({
      mode: "returned",
      lastCompletion: {
        scene,
        doors: CHANNELS.filter((c) => scene.channels[c]),
        unique: [],
        facets: [],
      },
      lastSilence: null,
      completedIds: [id, ...state.completedIds].slice(0, 24),
    }));
  },

  closeReturned: () => set({ mode: "chamber", lastCompletion: null }),

  reclaim: (id) => {
    const { scenes } = get();
    const target = scenes.find((s) => s.id === id);
    if (!target || !canReclaim(target)) return;
    const next = scenes.map((s) => (s.id === id ? reclaimScene(s) : s));
    persist(next);
    set((state) => ({
      scenes: next,
      accumulators: state.accumulators.filter((a) => a.sceneId !== id),
      lastCompletion: state.lastCompletion?.scene.id === id
        ? { ...state.lastCompletion, scene: reclaimScene(state.lastCompletion.scene) }
        : state.lastCompletion,
    }));
  },
}));
