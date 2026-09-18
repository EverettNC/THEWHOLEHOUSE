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
  return "filament";
}

function fail(error: string): TranscribeResult {
  return { ok: false, error };
}

export async function runPorchStt(data: TranscribeInput): Promise<TranscribeResult> {
    // The tape does not leave this house. Porch hands it to the Filament, the
    // local ear on 4850. No key, no outside call, nothing to disclose.
    const ear = process.env.FILAMENT_EAR_URL?.trim() || "http://127.0.0.1:4850/stt";

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

    // The Filament reads Content-Length to know how much tape to take. A
    // multipart body from fetch streams chunked with no such header, and the
    // ear then hears nothing. Hand it the bytes plainly instead.
    void keyterms;
    void filename;

    let sttBody: unknown;
    try {
      const res = await fetch(ear, {
        method: "POST",
        headers: {
          "Content-Type": mime,
          "Content-Length": String(audio.byteLength),
        },
        body: new Uint8Array(audio),
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
      return fail("The Filament could not be reached. Start it on 4850.");
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
