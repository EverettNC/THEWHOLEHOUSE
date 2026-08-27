import { downloadText } from "@/lib/utils";
import { SMELL_FAMILY, SMELL_HONESTY_RULE, SMELL_ORGAN, type SmellPacket, type SmellTake } from "./types";

export function toSmellPacket(take: SmellTake): SmellPacket {
  return {
    organ: SMELL_ORGAN,
    family: SMELL_FAMILY,
    kind: "reading",
    take,
  };
}

export function downloadSmellPacket(take: SmellTake): void {
  downloadText(`opensmell-${take.id}.json`, JSON.stringify(toSmellPacket(take), null, 2), "application/json");
}

export function honestyFor(kind: SmellTake["reading"]["kind"], claim: SmellTake["reading"]["claim"], scalarOnly: boolean) {
  return {
    nose: kind,
    claim,
    channels: scalarOnly ? ("scalar" as const) : ("proxy-labels" as const),
    clinical: false as const,
    rule: SMELL_HONESTY_RULE,
  };
}
