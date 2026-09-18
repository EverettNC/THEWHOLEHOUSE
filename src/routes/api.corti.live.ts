import { createFileRoute } from "@tanstack/react-router";
import { earFromFrame } from "@/modules/memory/house";
import { getCorti, setCorti } from "@/lib/house/live-rack";

export const Route = createFileRoute("/api/corti/live")({
  server: {
    handlers: {
      GET: async () => {
        const live = getCorti();
        if (!live) {
          return Response.json({
            ok: true,
            organ: "corti",
            family: "christman-sound",
            measured: false,
            listening: false,
            rms: 0,
            zcr: 0,
            f0: null,
            locked: false,
          });
        }
        return Response.json({ ok: true, measured: true, ...live });
      },
      POST: async ({ request }) => {
        let body: {
          listening?: boolean;
          rms?: number;
          zcr?: number;
          f0?: number | null;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json(
            { ok: false, error: "Corti could not read that body." },
            { status: 400 },
          );
        }
        const ear = earFromFrame({
          listening: Boolean(body.listening),
          rms: typeof body.rms === "number" ? body.rms : 0,
          zcr: typeof body.zcr === "number" ? body.zcr : 0,
          f0: typeof body.f0 === "number" ? body.f0 : null,
        });
        const live = setCorti(ear);
        return Response.json({ ok: true, measured: true, ...live });
      },
    },
  },
});
