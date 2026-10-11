import { createFileRoute } from "@tanstack/react-router";

/**
 * The long tape, read back from ELEMENTS.
 * from / to: epoch milliseconds or ISO time. Default is the last hour.
 * points: how many frames to return; the loudest frame in each slice is kept.
 * Gaps are marked. Absence is not a tape.
 */
function parseTime(value: string | null): number | null {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  const asDate = Date.parse(value);
  return Number.isFinite(asDate) ? asDate : null;
}

const WEEK_MS = 7 * 86_400_000;

export const Route = createFileRoute("/api/sound/tape")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const to = parseTime(url.searchParams.get("to")) ?? Date.now();
        const from = parseTime(url.searchParams.get("from")) ?? to - 3_600_000;
        const asked = Number(url.searchParams.get("points"));
        const points = Math.min(20_000, Math.max(10, Number.isFinite(asked) && asked > 0 ? asked : 2000));
        if (from > to) {
          return Response.json({ ok: false, error: "from comes after to." }, { status: 400 });
        }
        if (to - from > WEEK_MS) {
          return Response.json(
            { ok: false, error: "Ask for a week or less at a time." },
            { status: 400 },
          );
        }
        const { getDiskStatus, readCanalRange } = await import("@/lib/sound/canal-disk");
        const range = await readCanalRange(from, to, points);
        return Response.json({
          ok: true,
          organ: "canal",
          family: "christman-sound",
          disk: getDiskStatus(),
          ...range,
        });
      },
    },
  },
});
