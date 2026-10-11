import { createFileRoute } from "@tanstack/react-router";
import { appendSoundCanal, getCanal, getCanalDraw, getSound, setSound } from "@/lib/house/live-rack";
import type { CanalBatch } from "@/lib/sound/canal";
import type { SoundCard } from "@/lib/sound/packet";

async function diskStatus() {
  const { getDiskStatus } = await import("@/lib/sound/canal-disk");
  return getDiskStatus();
}

async function canalPayload() {
  const tape = getCanalDraw();
  const latest = getSound();
  return {
    ok: true,
    organ: "canal",
    family: "christman-sound",
    measured: Boolean(tape && tape.frameCount > 0),
    t: tape?.startedAt ?? latest?.t ?? null,
    tape: tape,
    card: latest?.card ?? null,
    disk: await diskStatus(),
  };
}

export const Route = createFileRoute("/api/sound/latest")({
  server: {
    handlers: {
      GET: async () => Response.json(await canalPayload()),
      POST: async ({ request }) => {
        let body: (SoundCard & CanalBatch) | CanalBatch | SoundCard;
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json(
            { ok: false, error: "Sound could not read that body." },
            { status: 400 },
          );
        }
        if (!body || (body as SoundCard).family !== "christman-sound") {
          return Response.json(
            { ok: false, error: "Not a Christman-Sound packet." },
            { status: 400 },
          );
        }
        if ((body as { organ?: string }).organ === "canal" && Array.isArray((body as CanalBatch).frames)) {
          const batch = body as CanalBatch;
          const receivedAt = Date.now();
          const before = getCanal();
          const lastT =
            before && before.tape.length > 0 ? before.tape[before.tape.length - 1]!.t : -Infinity;
          const record = appendSoundCanal({
            listening: Boolean(batch.listening),
            startedAt: Number(batch.startedAt) || Date.now(),
            frames: batch.frames,
          });
          // The window drops its head after two hours. ELEMENTS keeps every frame.
          const fresh = [];
          for (let i = record.tape.length - 1; i >= 0 && record.tape[i]!.t > lastT; i--) {
            fresh.push(record.tape[i]!);
          }
          fresh.reverse();
          const { writeCanalFrames } = await import("@/lib/sound/canal-disk");
          writeCanalFrames(receivedAt, fresh);
          return Response.json(await canalPayload());
        }
        const card = body as SoundCard;
        if (!Array.isArray(card.tape)) {
          return Response.json(
            { ok: false, error: "Not a Christman-Sound card." },
            { status: 400 },
          );
        }
        setSound(card);
        // The spread used to land last and quietly overwrite ok, measured and
        // the card just saved. The saved card is the answer, so it goes last.
        return Response.json({ ...(await canalPayload()), ok: true, measured: true, card });
      },
    },
  },
});
