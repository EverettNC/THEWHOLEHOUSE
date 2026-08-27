import { downloadText } from "@/lib/utils";
import {
  PORCH_FAMILY,
  PORCH_ORGAN,
  type PorchPacket,
  type PorchTake,
} from "./types";

export function toPorchPacket(take: PorchTake): PorchPacket {
  return {
    organ: PORCH_ORGAN,
    family: PORCH_FAMILY,
    kind: "utterance",
    take,
  };
}

export function downloadPorchPacket(take: PorchTake): void {
  const packet = toPorchPacket(take);
  downloadText(
    `porch-${take.id}.json`,
    JSON.stringify(packet, null, 2),
    "application/json",
  );
}
