import type { PorchTake } from "@/lib/porch/types";
import type { LucentKind } from "@/lib/house/live-rack";
import type { CanalBatch } from "@/lib/sound/canal";

/** Browser organs post to the house rack. 8765 pulls. Failures stay silent — absence is not a sense. */

export function postCanalLive(body: CanalBatch) {
  return fetch("/api/sound/latest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organ: "canal",
      family: "christman-sound",
      listening: body.listening,
      startedAt: body.startedAt,
      frames: body.frames,
    }),
  }).catch(() => undefined);
}

export function postPorchLive(body: { listening: boolean; take?: PorchTake | null }) {
  return fetch("/api/porch/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export function postLucentLive(body: {
  seeing: boolean;
  b64?: string;
  width?: number;
  height?: number;
  kind?: LucentKind;
}) {
  return fetch("/api/lucent/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}
