import { createFileRoute } from "@tanstack/react-router";
import { appendSoundCanal, getCanalDraw, getSound, setSound } from "@/lib/house/live-rack";
import type { CanalBatch } from "@/lib/sound/canal";
import type { SoundCard } from "@/lib/sound/packet";

function canalPayload() {
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
  };
}

export const Route = createFileRoute("/api/sound/latest")({
  server: {
    handlers: {
      GET: async () => Response.json(canalPayload()),
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
          appendSoundCanal({
            listening: Boolean(batch.listening),
            startedAt: Number(batch.startedAt) || Date.now(),
            frames: batch.frames,
          });
          return Response.json(canalPayload());
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
        return Response.json({ ...canalPayload(), ok: true, measured: true, card });
      },
    },
  },
});
