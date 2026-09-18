import { createFileRoute } from "@tanstack/react-router";
import { getPorch, setPorch } from "@/lib/house/live-rack";
import type { PorchTake } from "@/lib/porch/types";

export const Route = createFileRoute("/api/porch/live")({
  server: {
    handlers: {
      GET: async () => {
        const live = getPorch();
        if (!live) {
          return Response.json({
            ok: true,
            organ: "porch",
            measured: false,
            listening: false,
            take: null,
          });
        }
        return Response.json({ ok: true, measured: true, ...live });
      },
      POST: async ({ request }) => {
        let body: { listening?: boolean; take?: PorchTake | null };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json(
            { ok: false, error: "Porch could not read that body." },
            { status: 400 },
          );
        }
        const live = setPorch({
          listening: Boolean(body.listening),
          take: body.take ?? null,
        });
        return Response.json({ ok: true, measured: true, ...live });
      },
    },
  },
});
