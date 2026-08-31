import type { LexiconEntry } from "./types";

/** Family names the STT will mangle. Bias + reconstruct. */
export const FAMILY_NAMES = [
  "Everett",
  "Christman",
  "Grok",
  "Harper",
  "Lucas",
  "Benjamin",
  "Brockston",
  "AlphaVox",
  "AlphaWolf",
  "Inferno",
  "Giuseppe",
  "Sierra",
  "Seraphina",
  "Eruptor",
  "Corti",
  "Lucent",
  "OpenSmell",
  "Derek C",
  "Constance",
  "Cletus",
  "Penny",
  "Cochlea",
  "Porch",
  "Canal",
  "Opus",
  "Claude",
] as const;

/** Dialect that prissy STT "fixes." Keep it. */
export const DIALECT_KEEP: LexiconEntry[] = [
  { said: "ain't", keep: "ain't", note: "negation. not 'isn't'." },
  { said: "y'all", keep: "y'all", note: "plural you." },
  { said: "fixin' to", keep: "fixin' to", note: "about to. not 'fixing to' as repair." },
  { said: "might could", keep: "might could", note: "double modal. keep both." },
  { said: "reckon", keep: "reckon", note: "think / suppose." },
  { said: "cain't", keep: "cain't", note: "cannot. not 'can't' if that's what was said." },
  { said: "holler", keep: "holler", note: "call out, or the hollow." },
  { said: "yonder", keep: "yonder", note: "over there." },
  { said: "done", keep: "done", note: "perfective: 'I done told you'." },
  { said: "was", keep: "was", note: "plural was is dialect, not a mistake." },
];

/**
 * Mouth-cooperation. From the vault, TCAP-V-0020.
 * These invert meaning if the ear or the dialect layer drifts.
 */
export const MOUTH_COOPERATION: LexiconEntry[] = [
  {
    said: "live",
    keep: "live",
    note: "LONG I /laɪv/ — rhymes with five. NEVER leave. Presence, not absence.",
  },
  {
    said: "lived",
    keep: "lived",
    note: "/laɪvd/. not laved, not leaved.",
  },
  {
    said: "lives",
    keep: "lives",
    note: "/laɪvz/ when presence is meant.",
  },
  {
    said: "read",
    keep: "read",
    note: "past tense is RED /rɛd/. Present is REED. The tense is the claim.",
  },
  {
    said: "misread",
    keep: "misread",
    note: "always MISRED /mɪsˈrɛd/. never Miss Reed.",
  },
  {
    said: "haptic",
    keep: "haptic",
    note: "HAP-tic /ˈhæptɪk/. flat a like cap. never hectic, never heptic. Skin's own word.",
  },
];

export const DEFAULT_LEXICON: LexiconEntry[] = [
  ...DIALECT_KEEP,
  ...MOUTH_COOPERATION,
];

export function buildKeyterms(extra: LexiconEntry[] = []): string[] {
  const fromLexicon = [...DEFAULT_LEXICON, ...extra].flatMap((e) => [e.said, e.keep]);
  const all = [...FAMILY_NAMES, ...fromLexicon];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of all) {
    const k = t.trim();
    if (!k || k.length > 50) continue;
    const id = k.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(k);
    if (out.length >= 100) break;
  }
  return out;
}
