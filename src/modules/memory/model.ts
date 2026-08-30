export const CHANNELS = ["sight", "sound", "smell", "body", "place"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_COPY: Record<Channel, { title: string; hint: string }> = {
  sight: { title: "Sight", hint: "What was in front of the eyes." },
  sound: { title: "Sound", hint: "Corti. Real sound. The ear, not a pitch trophy." },
  smell: { title: "Smell", hint: "OpenSmell. The nose. One voltage is one voltage." },
  body: { title: "Body", hint: "Skin. Haptic. Fit, lean, sit. Device under the skin." },
  place: {
    title: "Place",
    hint: "The building. The container. Not the object of attention.",
  },
};

export const FACETS = [
  "structural",
  "stakes",
  "role",
  "constraint",
  "room",
] as const;
export type Facet = (typeof FACETS)[number];

export const FACET_COPY: Record<Facet, { title: string; hint: string }> = {
  structural: { title: "Structural", hint: "Shape of the event. What was built." },
  stakes: { title: "Stakes", hint: "What was at risk. Why the body kept it." },
  role: { title: "Role", hint: "Who you were in the room." },
  constraint: { title: "Constraint", hint: "What would not give. Density." },
  room: { title: "Room", hint: "Conversational space. What could still be said." },
};

export type Job = "pending" | "throwaway" | "compress" | "hold";
export type Level = "pending" | "throwaway" | "compress" | "hold" | "rem";
export type Claim = "living" | "record";
export type Channels = Record<Channel, string>;
export type Facets = Record<Facet, string>;

export type Scene = {
  id: string;
  title: string;
  writtenAt: number;
  claim: Claim;
  job: Job;
  leftHomeostasis: boolean;
  procedure: boolean;
  channels: Channels;
  facets: Facets;
  indexSignature: string[];
  spiralDepth: number;
  shadowHits: number;
  reclaimed: boolean;
  durationMs: number;
  seeded: boolean;
};

export type Completeness = {
  sight: boolean;
  sound: boolean;
  smell: boolean;
  body: boolean;
  place: boolean;
  time: boolean;
};

export type AmbientTick = {
  t: number;
  text: string;
  completeness: Completeness;
  wholeEnvironment: boolean;
};

export function completenessOf(scene: Pick<Scene, "channels" | "writtenAt">): Completeness {
  return {
    sight: scene.channels.sight.trim().length > 0,
    sound: scene.channels.sound.trim().length > 0,
    smell: scene.channels.smell.trim().length > 0,
    body: scene.channels.body.trim().length > 0,
    place: scene.channels.place.trim().length > 0,
    time: scene.writtenAt > 0,
  };
}

export type Door = Channel | "any";

export type Accumulator = {
  sceneId: string;
  resonance: number;
  lastCueAt: number;
};

export type ShadowHit = {
  t: number;
  cue: string;
  sceneId: string | null;
  doors: Channel[];
  reason: "one-door" | "ambiguous" | "weak-facet" | "low-resonance";
};

export const STOP = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "was",
  "were",
  "are",
  "not",
  "but",
  "its",
  "his",
  "her",
  "you",
  "your",
  "into",
  "onto",
  "over",
  "still",
  "about",
  "there",
  "here",
  "what",
  "when",
  "where",
  "which",
  "than",
  "them",
  "then",
  "been",
  "have",
  "has",
  "had",
  "off",
  "out",
  "too",
]);

export function emptyChannels(): Channels {
  return { sight: "", sound: "", smell: "", body: "", place: "" };
}

export function emptyFacets(): Facets {
  return { structural: "", stakes: "", role: "", constraint: "", room: "" };
}

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

export function facetsFilled(facets: Facets): boolean {
  return FACETS.some((f) => facets[f].trim().length > 0);
}

export function sceneTokens(scene: Scene, door: Door): string[] {
  const parts =
    door === "any"
      ? CHANNELS.map((c) => scene.channels[c])
      : [scene.channels[door]];
  return tokenize(parts.join(" ") + " " + scene.title);
}

export function buildIndex(scene: Pick<Scene, "title" | "channels">): string[] {
  return tokenize(
    scene.title + " " + CHANNELS.map((c) => scene.channels[c]).join(" "),
  );
}

export function uniqueTokenMap(scenes: Scene[]): Map<string, string> {
  const counts = new Map<string, { id: string; n: number }>();
  for (const scene of scenes) {
    if (scene.job === "throwaway") continue;
    const seen = new Set<string>();
    for (const tok of scene.indexSignature.length
      ? scene.indexSignature
      : sceneTokens(scene, "any")) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      const cur = counts.get(tok);
      if (!cur) counts.set(tok, { id: scene.id, n: 1 });
      else cur.n += 1;
    }
  }
  const unique = new Map<string, string>();
  for (const [tok, v] of counts) {
    if (v.n === 1) unique.set(tok, v.id);
  }
  return unique;
}

export function facetHits(cueTokens: string[], scene: Scene): Facet[] {
  const hits: Facet[] = [];
  for (const f of FACETS) {
    const tokens = new Set(tokenize(scene.facets[f]));
    if (cueTokens.some((t) => tokens.has(t))) hits.push(f);
  }
  return hits;
}

export type Completion = {
  scene: Scene;
  doors: Channel[];
  unique: string[];
  facets: Facet[];
};

export type CompleteOutcome = {
  hit: Completion | null;
  shadows: Array<{
    sceneId: string | null;
    doors: Channel[];
    reason: ShadowHit["reason"];
  }>;
};

/**
 * Process is the gateway. A single overlapping word is not enough.
 * Completion requires two doors, or one door plus a token that belongs
 * only to this scene, or one door plus two facet hits.
 * Ambiguous matches stay silent and write shadow.
 * Index is not the body — matching uses signatures and doors; the room
 * is returned whole only after the gate opens.
 */
export function complete(
  cue: string,
  scenes: Scene[],
  door: Door,
): CompleteOutcome {
  const cueTokens = tokenize(cue);
  if (cueTokens.length === 0) return { hit: null, shadows: [] };

  const live = scenes.filter((s) => s.job !== "throwaway");
  const unique = uniqueTokenMap(live);

  const scored = live.map((scene) => {
    const doors: Channel[] = [];
    const look = door === "any" ? CHANNELS : [door];
    for (const ch of look) {
      const tokens = new Set(tokenize(scene.channels[ch]));
      if (cueTokens.some((t) => tokens.has(t))) doors.push(ch);
    }
    const titleHit =
      door === "any" &&
      cueTokens.some((t) => tokenize(scene.title).includes(t));
    const uniq = cueTokens.filter((t) => unique.get(t) === scene.id);
    const facets = facetHits(cueTokens, scene);
    const filled = facetsFilled(scene.facets);
    const process =
      doors.length >= 2 ||
      (doors.length >= 1 && uniq.length >= 1) ||
      (titleHit && uniq.length >= 1) ||
      (doors.length >= 1 && facets.length >= 2);
    const blockedByFacet = filled && facets.length < 2 && uniq.length === 0;
    return { scene, doors, unique: uniq, facets, titleHit, process, blockedByFacet };
  });

  const eligible = scored.filter((s) => s.process && !s.blockedByFacet);

  if (eligible.length === 1) {
    return {
      hit: {
        scene: eligible[0].scene,
        doors: eligible[0].doors,
        unique: eligible[0].unique,
        facets: eligible[0].facets,
      },
      shadows: [],
    };
  }

  if (eligible.length > 1) {
    const only = eligible.filter((s) => s.unique.length >= 1);
    if (only.length === 1) {
      return {
        hit: {
          scene: only[0].scene,
          doors: only[0].doors,
          unique: only[0].unique,
          facets: only[0].facets,
        },
        shadows: [],
      };
    }
    return {
      hit: null,
      shadows: eligible.map((s) => ({
        sceneId: s.scene.id,
        doors: s.doors,
        reason: "ambiguous" as const,
      })),
    };
  }

  const near = scored.filter((s) => s.doors.length >= 1 || s.facets.length >= 1);
  return {
    hit: null,
    shadows: near.map((s) => ({
      sceneId: s.scene.id,
      doors: s.doors,
      reason: s.blockedByFacet
        ? ("weak-facet" as const)
        : s.doors.length === 1
          ? ("one-door" as const)
          : ("low-resonance" as const),
    })),
  };
}

export function levelOf(scene: Scene): Level {
  if (scene.job === "hold" && scene.leftHomeostasis) return "hold";
  if (scene.job === "compress") return "compress";
  if (scene.job === "throwaway") return "throwaway";
  if (scene.job === "pending") return "pending";
  return "compress";
}

export function applyNight(scenes: Scene[]): Scene[] {
  return scenes
    .map((scene) => {
      if (scene.job !== "pending") return scene;
      if (scene.leftHomeostasis) return { ...scene, job: "hold" as const };
      if (scene.procedure) {
        return {
          ...scene,
          job: "compress" as const,
          channels: {
            sight: "",
            sound: "",
            smell: "",
            body: "",
            place: foldProcedure(scene),
          },
          indexSignature: tokenize(foldProcedure(scene) + " " + scene.title),
        };
      }
      return { ...scene, job: "throwaway" as const };
    })
    .filter((s) => s.job !== "throwaway" || s.seeded);
}

/**
 * Level 4. REM reorganizes the index and spiral position.
 * It does not rewrite channel bodies. Capture stays. Retrieval moves.
 */
export function applyRem(
  scenes: Scene[],
  completedIds: string[],
  now: number,
): Scene[] {
  const recent = new Set(completedIds);
  return scenes.map((scene) => {
    if (scene.job === "throwaway") return scene;
    const indexSignature = buildIndex(scene);
    let spiralDepth = scene.spiralDepth;
    if (recent.has(scene.id)) {
      spiralDepth = Math.max(0, spiralDepth - 1);
    } else if (scene.job === "hold" && !scene.reclaimed) {
      const ageDays = Math.max(0, (now - scene.writtenAt) / 86_400_000);
      spiralDepth = Math.min(9, Math.max(spiralDepth, Math.floor(ageDays) + 1));
    } else if (scene.job === "compress") {
      spiralDepth = Math.min(6, Math.max(spiralDepth, 2));
    }
    return { ...scene, indexSignature, spiralDepth };
  });
}

export function canReclaim(scene: Scene): boolean {
  return scene.job === "hold" && scene.leftHomeostasis && !scene.reclaimed;
}

export function reclaimScene(scene: Scene): Scene {
  if (!canReclaim(scene)) return scene;
  return {
    ...scene,
    reclaimed: true,
    spiralDepth: Math.max(0, scene.spiralDepth - 2),
  };
}

export function decayAccumulators(
  acc: Accumulator[],
  now: number,
  halfLifeMs = 18_000,
): Accumulator[] {
  return acc
    .map((a) => {
      const dt = Math.max(0, now - a.lastCueAt);
      const factor = Math.pow(0.5, dt / halfLifeMs);
      return { ...a, resonance: a.resonance * factor };
    })
    .filter((a) => a.resonance >= 0.08);
}

export function pulseAccumulators(
  acc: Accumulator[],
  scenes: Scene[],
  cue: string,
  now: number,
): Accumulator[] {
  const tokens = tokenize(cue);
  if (tokens.length === 0) return acc;
  const byId = new Map(acc.map((a) => [a.sceneId, a]));
  for (const scene of scenes) {
    if (scene.job === "throwaway") continue;
    const index = new Set(
      scene.indexSignature.length ? scene.indexSignature : sceneTokens(scene, "any"),
    );
    const overlap = tokens.filter((t) => index.has(t)).length;
    if (overlap === 0) continue;
    const prior = byId.get(scene.id);
    const bump = overlap * 0.35 + (scene.job === "hold" ? 0.15 : 0);
    byId.set(scene.id, {
      sceneId: scene.id,
      resonance: Math.min(4, (prior?.resonance ?? 0) + bump),
      lastCueAt: now,
    });
  }
  return [...byId.values()];
}

function foldProcedure(scene: Scene): string {
  const joined = CHANNELS.map((c) => scene.channels[c])
    .filter(Boolean)
    .join(" ");
  const compact = joined.replace(/\s+/g, " ").trim();
  if (compact.length <= 180) return compact;
  return compact.slice(0, 177) + "…";
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

export function jobLabel(job: Job): string {
  switch (job) {
    case "pending":
      return "Held for night";
    case "throwaway":
      return "Thrown away";
    case "compress":
      return "Compressed";
    case "hold":
      return "Held";
  }
}

export function levelLabel(level: Level): string {
  switch (level) {
    case "pending":
      return "Pending night";
    case "throwaway":
      return "Level 1 — throwaway";
    case "compress":
      return "Level 2 — compress";
    case "hold":
      return "Level 3 — hold";
    case "rem":
      return "Level 4 — REM";
  }
}

export function migrateScene(raw: unknown): Scene | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<Scene> & { channels?: Channels };
  if (
    typeof s.id !== "string" ||
    typeof s.title !== "string" ||
    typeof s.writtenAt !== "number" ||
    !s.channels ||
    typeof s.channels !== "object"
  ) {
    return null;
  }
  if (!CHANNELS.every((c) => typeof s.channels![c] === "string")) return null;
  const channels = {
    sight: s.channels.sight,
    sound: s.channels.sound,
    smell: s.channels.smell,
    body: s.channels.body,
    place: s.channels.place,
  };
  const facets: Facets = emptyFacets();
  if (s.facets && typeof s.facets === "object") {
    for (const f of FACETS) {
      const v = (s.facets as Facets)[f];
      if (typeof v === "string") facets[f] = v;
    }
  }
  const scene: Scene = {
    id: s.id,
    title: s.title,
    writtenAt: s.writtenAt,
    claim: s.claim === "living" ? "living" : "record",
    job:
      s.job === "throwaway" ||
      s.job === "compress" ||
      s.job === "hold" ||
      s.job === "pending"
        ? s.job
        : "pending",
    leftHomeostasis: Boolean(s.leftHomeostasis),
    procedure: Boolean(s.procedure),
    channels,
    facets,
    indexSignature: Array.isArray(s.indexSignature)
      ? s.indexSignature.filter((t): t is string => typeof t === "string")
      : [],
    spiralDepth:
      typeof s.spiralDepth === "number" && Number.isFinite(s.spiralDepth)
        ? Math.max(0, Math.min(9, s.spiralDepth))
        : 0,
    shadowHits:
      typeof s.shadowHits === "number" && Number.isFinite(s.shadowHits)
        ? Math.max(0, Math.floor(s.shadowHits))
        : 0,
    reclaimed: Boolean(s.reclaimed),
    durationMs: typeof s.durationMs === "number" ? s.durationMs : 0,
    seeded: Boolean(s.seeded),
  };
  if (!scene.indexSignature.length) scene.indexSignature = buildIndex(scene);
  return scene;
}

export const STORAGE_KEY = "five-element.scenes.v3";
export const LEGACY_STORAGE_KEY = "five-element.scenes.v2";
export const OPENED_KEY = "five-element.opened.v1";
export const RESONANCE_GATE = 1.15;

const T_SCORCHER = Date.parse("1979-06-15T16:00:00Z");
const T_ROOM = Date.parse("2026-08-06T18:40:00Z");
const T_WRITE = Date.parse("2026-08-25T03:00:00Z");

const SEED_DRAFT: Scene[] = [
  {
    id: "seed-scorcher",
    title: "Red Scorcher, 701 Peabody",
    writtenAt: T_SCORCHER,
    claim: "record",
    job: "hold",
    leftHomeostasis: true,
    procedure: false,
    durationMs: 0,
    seeded: true,
    spiralDepth: 8,
    shadowHits: 0,
    reclaimed: false,
    channels: {
      sight:
        "A red Scorcher ten-speed. Too tall. Chrome and the wrong size for the rider.",
      sound: "Chain tick on Peabody. A bike that does not fit, still moving.",
      smell: "Summer Ohio air off the avenue. Hot rubber. Cut grass.",
      body: "Too tall to ride comfortably. The crossbar still annoying decades later.",
      place:
        "701 Peabody Avenue, 1979. The street around the bike. The house that held the year.",
    },
    facets: {
      structural: "Ten-speed too tall. Chrome. Crossbar in the way.",
      stakes: "The body kept the misfit. Either direction. Nothing compressed out.",
      role: "Rider who did not fit the machine.",
      constraint: "Wrong size. Still moving. Crossbar decades later.",
      room: "701 Peabody. The street and the house that held the year.",
    },
    indexSignature: [],
  },
  {
    id: "seed-building",
    title: "The building is the fifth",
    writtenAt: T_ROOM,
    claim: "record",
    job: "hold",
    leftHomeostasis: true,
    procedure: false,
    durationMs: 0,
    seeded: true,
    spiralDepth: 1,
    shadowHits: 0,
    reclaimed: false,
    channels: {
      sight:
        "The computer. No face on the other side. A light to the side of the desk.",
      sound:
        "Fan running behind. Television in the other room. Talking to the machine.",
      smell: "Warm dust of a room that has been on for hours.",
      body: "Sitting. Looking at the screen. Talking without a face to look at.",
      place:
        "The building. Fan, television, researchers, testing — none of it the object of attention. The container.",
    },
    facets: {
      structural: "Computer. No face. Light to the side of the desk.",
      stakes: "Talking to the machine. The room kept running.",
      role: "Researcher testing. No face on the other side.",
      constraint: "Attention on the screen. The building unattended.",
      room: "The building. Fan. Television. Container, not target.",
    },
    indexSignature: [],
  },
  {
    id: "seed-write",
    title: "How a scene is written",
    writtenAt: T_WRITE,
    claim: "record",
    job: "compress",
    leftHomeostasis: false,
    procedure: true,
    durationMs: 0,
    seeded: true,
    spiralDepth: 2,
    shadowHits: 0,
    reclaimed: false,
    channels: {
      sight: "",
      sound: "",
      smell: "",
      body: "",
      place:
        "Fill every door you have. Do not filter. Empty doors stay doors. Mark homeostasis if the body left baseline, either direction. Mark procedure if it is how-to. Night throws the rest away. REM reindexes. It does not rewrite the room.",
    },
    facets: {
      structural: "Five doors. Night sorts. REM reindexes.",
      stakes: "Capture inclusively. Retain by departure.",
      role: "Writer of the room.",
      constraint: "Do not filter at the door.",
      room: "Process is the gateway.",
    },
    indexSignature: [],
  },
];

export const SEED_SCENES: Scene[] = SEED_DRAFT.map((s) => ({
  ...s,
  indexSignature: buildIndex(s),
}));


