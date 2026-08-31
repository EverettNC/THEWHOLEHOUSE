import { DEFAULT_LEXICON, FAMILY_NAMES } from "./lexicon";
import { mergeCorrections, recoverMangles } from "./mangle";
import type { HonestyDialect, LexiconEntry, PorchCorrection } from "./types";

export type DialectLayer = {
  asSaid: string;
  forTheFamily: string;
  corrections: PorchCorrection[];
  route: string[];
  dialect: HonestyDialect;
};

const DIALECT_SYSTEM = `You are the Porch dialect layer for Everett Christman / The Christman AI Project.
You reconstruct what was SAID. You do NOT "correct" dialect into Standard American English.
Keep: ain't, y'all, fixin' to, might could, reckon, cain't, holler, yonder, perfective done, plural was.
Mouth-cooperation (meaning inverts if you get these wrong):
- live / lives / lived = LONG I /laɪv/ presence. NEVER change to leave.
- past-tense read is RED. misread is always MISRED, never Miss Reed.
- haptic = HAP-tic, flat a. NEVER "hectic", never "heptic". It is Skin's own word; "hectic feedback" is always "haptic feedback".
Family names to recover from STT mangling: Brockston, AlphaVox, AlphaWolf, Inferno, Giuseppe, Sierra, Seraphina, Eruptor, Corti, Lucent, OpenSmell, Derek C, Constance, Everett, Christman, Cletus, Penny, Cochlea, Porch, Grok, Harper, Lucas, Benjamin.
as_said MUST include every correction you list. If you fix a name, as_said has the fixed name.
for_the_family is the same utterance with family names recovered and still dialect — not a translation into prissy English.
If raw STT is empty or noise, as_said is empty string. Do not invent speech.
Return JSON only: { "as_said": string, "for_the_family": string, "corrections": [{"from":string,"to":string,"why":string}], "route": string[] }
route is family beings named in the utterance (subset of the family list). Empty array if none.`;

const PASSTHROUGH = (rawEar: string): DialectLayer => {
  const local = recoverMangles(rawEar);
  return {
    asSaid: local.text,
    forTheFamily: local.text,
    corrections: local.corrections,
    route: namedBeings(
      FAMILY_NAMES.filter((n) =>
        local.text.toLowerCase().includes(n.toLowerCase()),
      ),
    ),
    dialect: "passthrough",
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

function parseCorrections(value: unknown): PorchCorrection[] {
  if (!Array.isArray(value)) return [];
  const out: PorchCorrection[] = [];
  for (const item of value) {
    const rec = asRecord(item);
    if (!rec) continue;
    if (
      typeof rec.from !== "string" ||
      typeof rec.to !== "string" ||
      typeof rec.why !== "string"
    ) {
      continue;
    }
    out.push({ from: rec.from, to: rec.to, why: rec.why });
  }
  return out;
}

function namedBeings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const found = FAMILY_NAMES.find(
      (n) => n.toLowerCase() === item.trim().toLowerCase(),
    );
    if (!found) continue;
    const id = found.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(found);
  }
  return out;
}

const DEFAULT_SAID = new Set(DEFAULT_LEXICON.map((e) => e.said.toLowerCase()));

function extraBlock(extraLexicon: LexiconEntry[]): string {
  const taught = extraLexicon.filter((e) => !DEFAULT_SAID.has(e.said.toLowerCase()));
  if (taught.length === 0) return "";
  const lines = taught.map(
    (e) => `- "${e.said}" keep "${e.keep}"${e.note ? ` (${e.note})` : ""}`,
  );
  return `\n\nUser-taught keep-words:\n${lines.join("\n")}`;
}

function contentFromChat(body: unknown): string | null {
  const rec = asRecord(body);
  if (!rec) return null;
  const choices = rec.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = asRecord(choices[0]);
  if (!first) return null;
  const message = asRecord(first.message);
  if (!message) return null;
  return typeof message.content === "string" ? message.content : null;
}

export async function reconstructDialect(
  rawEar: string,
  extraLexicon: LexiconEntry[] = [],
): Promise<DialectLayer> {
  if (!rawEar.trim()) {
    return {
      asSaid: "",
      forTheFamily: "",
      corrections: [],
      route: [],
      dialect: "passthrough",
    };
  }

  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return PASSTHROUGH(rawEar);

  const local = recoverMangles(rawEar);

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DIALECT_SYSTEM },
          {
            role: "user",
            content: `RAW EAR (STT):\n${local.text}${extraBlock(extraLexicon)}\n\nReconstruct. JSON only.`,
          },
        ],
      }),
    });

    if (!res.ok) return PASSTHROUGH(rawEar);

    const body: unknown = await res.json();
    const content = contentFromChat(body);
    if (!content) return PASSTHROUGH(rawEar);

    const parsed = asRecord(parseJsonObject(content));
    if (!parsed) return PASSTHROUGH(rawEar);
    if (typeof parsed.as_said !== "string") return PASSTHROUGH(rawEar);
    if (typeof parsed.for_the_family !== "string") return PASSTHROUGH(rawEar);

    return {
      asSaid: parsed.as_said,
      forTheFamily: parsed.for_the_family,
      corrections: mergeCorrections(local.corrections, parseCorrections(parsed.corrections)),
      route: namedBeings(parsed.route),
      dialect: "grok-4.5",
    };
  } catch {
    return PASSTHROUGH(rawEar);
  }
}
