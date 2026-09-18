import { createFileRoute } from "@tanstack/react-router";
import { getLucent, setLucent } from "@/lib/house/live-rack";
import type { LucentKind } from "@/lib/house/live-rack";

export const Route = createFileRoute("/api/lucent/live")({
  server: {
    handlers: {
      GET: async () => {
        const live = getLucent();
        if (!live) {
          return Response.json({
            ok: true,
            organ: "lucent",
            measured: false,
            seeing: false,
            b64: "",
            width: 0,
            height: 0,
            kind: null,
          });
        }
        return Response.json({
          ok: true,
          measured: true,
          organ: live.organ,
          t: live.t,
          seeing: live.seeing,
          age_ms: live.age_ms,
          b64: live.seeing ? live.b64 : "",
          width: live.width,
          height: live.height,
          kind: live.kind,
        });
      },
      POST: async ({ request }) => {
        let body: {
          seeing?: boolean;
          b64?: string;
          width?: number;
          height?: number;
          kind?: LucentKind;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json(
            { ok: false, error: "Lucent could not read that body." },
            { status: 400 },
          );
        }
        const live = setLucent({
          seeing: Boolean(body.seeing),
          b64: typeof body.b64 === "string" ? body.b64 : "",
          width: typeof body.width === "number" ? body.width : 0,
          height: typeof body.height === "number" ? body.height : 0,
          kind: body.kind ?? null,
        });
        return Response.json({
          ok: true,
          measured: true,
          organ: live.organ,
          t: live.t,
          seeing: live.seeing,
          width: live.width,
          height: live.height,
          kind: live.kind,
        });
      },
    },
  },
});
