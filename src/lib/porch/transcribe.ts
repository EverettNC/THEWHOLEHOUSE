import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { extForMime } from "@/lib/utils";
import { buildKeyterms } from "./lexicon";
import type { HonestyEar, LexiconEntry, PorchTake } from "./types";
import { PORCH_HONESTY_RULE } from "./types";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

const lexiconEntrySchema = z.object({
  said: z.string(),
  keep: z.string(),
  note: z.string(),
});

const transcribeInputSchema = z.object({
  audioBase64: z.string(),
  mime: z.string(),
  filename: z.string().optional(),
  extraLexicon: z.array(lexiconEntrySchema).optional(),
  source: z.enum(["mic", "file", "sample"]),
});

export type TranscribeInput = z.infer<typeof transcribeInputSchema>;

export type TranscribeResult =
  | { ok: true; take: PorchTake }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function errorFromBody(body: unknown): string | null {
  const rec = asRecord(body);
  if (!rec) return null;
  if (typeof rec.error === "string" && rec.error.trim()) return rec.error;
  if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
  const nested = asRecord(rec.error);
  if (nested && typeof nested.message === "string" && nested.message.trim()) {
    return nested.message;
  }
  return null;
}

function pickTranscript(body: unknown): string | null {
  const rec = asRecord(body);
  if (!rec) return null;
  if (typeof rec.text === "string") return rec.text;
  if (typeof rec.transcript === "string") return rec.transcript;
  return null;
}

function durationMsFrom(body: unknown): number {
  const rec = asRecord(body);
  if (!rec) return 0;
  if (typeof rec.duration === "number" && Number.isFinite(rec.duration)) {
    return Math.max(0, Math.round(rec.duration * 1000));
  }
  const words = rec.words;
  if (Array.isArray(words) && words.length > 0) {
    const last = asRecord(words[words.length - 1]);
    if (last && typeof last.end === "number" && Number.isFinite(last.end)) {
      return Math.max(0, Math.round(last.end * 1000));
    }
  }
  return 0;
}

function earFor(source: TranscribeInput["source"]): HonestyEar {
  if (source === "sample") return "sample";
  if (source === "file") return "file";
  return "xai-stt";
}

function fail(error: string): TranscribeResult {
  return { ok: false, error };
}

export async function runPorchStt(data: TranscribeInput): Promise<TranscribeResult> {
    const key = process.env.XAI_API_KEY?.trim();
    if (!key) return fail("The word-ear is not available here.");

    const extraLexicon: LexiconEntry[] = data.extraLexicon ?? [];

    let audio: Buffer;
    try {
      audio = Buffer.from(data.audioBase64, "base64");
    } catch {
      return fail("The word-ear could not read that sound.");
    }

    if (audio.byteLength === 0) return fail("No sound reached the ear.");
    if (audio.byteLength > MAX_AUDIO_BYTES) {
      return fail("That clip is too heavy for the word-ear (8 MB).");
    }

    const filename =
      data.filename?.trim() || `porch.${extForMime(data.mime)}`;
    const mime = data.mime.trim() || "application/octet-stream";
    const keyterms = buildKeyterms(extraLexicon);

    const form = new FormData();
    form.append("language", "en");
    form.append("filler_words", "true");
    for (const term of keyterms) {
      form.append("keyterm", term);
    }
    form.append("file", new File([new Uint8Array(audio)], filename, { type: mime }));

    let sttBody: unknown;
    try {
      const res = await fetch("https://api.x.ai/v1/stt", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      const rawText = await res.text();
      try {
        sttBody = JSON.parse(rawText) as unknown;
      } catch {
        return fail(
          res.ok
            ? "The word-ear sent back silence."
            : `The word-ear failed (${res.status}).`,
        );
      }
      if (!res.ok) {
        return fail(
          errorFromBody(sttBody) ?? `The word-ear failed (${res.status}).`,
        );
      }
    } catch {
      return fail("The word-ear could not be reached.");
    }

    const rawEar = pickTranscript(sttBody);
    if (rawEar === null) return fail("The word-ear sent back silence.");

    const { reconstructDialect } = await import("./dialect");
    let layer: {
      asSaid: string;
      forTheFamily: string;
      corrections: PorchTake["corrections"];
      route: string[];
      dialect: PorchTake["honesty"]["dialect"];
    };
    try {
      layer = await reconstructDialect(rawEar, extraLexicon);
    } catch {
      layer = {
        asSaid: rawEar,
        forTheFamily: rawEar,
        corrections: [],
        route: [],
        dialect: "passthrough",
      };
    }

    const take: PorchTake = {
      id: crypto.randomUUID(),
      at: Date.now(),
      durationMs: durationMsFrom(sttBody),
      asSaid: layer.asSaid,
      forTheFamily: layer.forTheFamily,
      rawEar,
      corrections: layer.corrections,
      route: layer.route,
      honesty: {
        ear: earFor(data.source),
        dialect: layer.dialect,
        corti: "not-this-nerve",
        cloud: true,
        rule: PORCH_HONESTY_RULE,
      },
    };

    return { ok: true, take };
}

export const transcribe = createServerFn({ method: "POST" })
  .validator(transcribeInputSchema)
  .handler(async ({ data }): Promise<TranscribeResult> => runPorchStt(data));
