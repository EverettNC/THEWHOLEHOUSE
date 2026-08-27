/**
 * Christman-Sound ingest.
 * Corti measures. Sound consumes the card and the tape.
 * `kind` stays on the Corti client. Dropped here.
 */
import type { TapeFrame, VocalEvent } from "@/lib/audio/vocalization";

export type SoundCard = {
  organ: "corti";
  family: "christman-sound";
  honesty: {
    corti: "present";
    kind: "dropped";
    rule: string;
  };
  id: number;
  durationMs: number;
  peakRms: number;
  attackMs: number;
  decayMs: number;
  f0: number | null;
  f1: number;
  f2: number;
  zcr: number;
  voiced: boolean;
  truncated: boolean;
  tape: TapeFrame[];
};

const TAPE_CAP = 360;

export function eventToSoundCard(ev: VocalEvent): SoundCard {
  const truncated = ev.tape.length >= TAPE_CAP;
  return {
    organ: "corti",
    family: "christman-sound",
    honesty: {
      corti: "present",
      kind: "dropped",
      rule: "Corti measures. Sound consumes card and tape. Kind does not cross.",
    },
    id: ev.id,
    durationMs: ev.durationMs,
    peakRms: ev.peakRms,
    attackMs: ev.attackMs,
    decayMs: ev.decayMs,
    f0: ev.f0,
    f1: ev.f1,
    f2: ev.f2,
    zcr: ev.zcr,
    voiced: ev.voiced,
    truncated,
    tape: ev.tape,
  };
}

export function ringToSound(events: VocalEvent[]): SoundCard[] {
  return events.map(eventToSoundCard);
}
