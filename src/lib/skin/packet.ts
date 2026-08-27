import { downloadText } from "@/lib/utils";
import { SKIN_FAMILY, SKIN_HONESTY_RULE, SKIN_ORGAN, type SkinKind, type SkinPacket, type SkinTake } from "./types";

export function toSkinPacket(take: SkinTake): SkinPacket {
  return {
    organ: SKIN_ORGAN,
    family: SKIN_FAMILY,
    kind: "contact",
    take,
  };
}

export function downloadSkinPacket(take: SkinTake): void {
  downloadText(`skin-${take.id}.json`, JSON.stringify(toSkinPacket(take), null, 2), "application/json");
}

export function honestyFor(kind: SkinKind, motion: boolean) {
  return {
    skin: kind,
    motion,
    invented: false as const,
    rule: SKIN_HONESTY_RULE,
  };
}
