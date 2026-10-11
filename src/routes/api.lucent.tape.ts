import { createFileRoute } from "@tanstack/react-router";

/**
 * Lucent's sight, read back from ELEMENTS.
 * from / to: epoch ms or ISO. Default is the last hour.
 * limit: how many index entries to return (times + file paths, not the bytes).
 * The bytes of any one frame come from /api/lucent/frame?file=...
 */
function parseTime(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n;
  const d = Date.parse(value);
  return Number.isFinite(d) ? d : null;
}

const WEEK_MS = 7 * 86_400_000;

export const Route = createFileRoute("/api/lucent/tape")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const to = parseTime(url.searchParams.get("to")) ?? Date.now();
        const from = parseTime(url.searchParams.get("from")) ?? to - 3_600_000;
        const asked = Number(url.searchParams.get("limit"));
        const limit = Math.min(5000, Math.max(1, Number.isFinite(asked) && asked > 0 ? asked : 500));
        if (from > to) {
          return Response.json({ ok: false, error: "from comes after to." }, { status: 400 });
        }
        if (to - from > WEEK_MS) {
          return Response.json({ ok: false, error: "Ask for a week or less at a time." }, { status: 400 });
        }
        const { getSightStatus, readSightRange } = await import("@/lib/sound/lucent-disk");
        const range = await readSightRange(from, to, limit);
        return Response.json({ ok: true, organ: "lucent", disk: getSightStatus(), ...range });
      },
    },
  },
});
