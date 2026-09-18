/**
 * In-process rack for the house organs.
 * Measured values only. A missing F0 stays null. Never invent a pitch.
 * 8765 pulls Porch words and Lucent frames from here — it does not open a mic or camera.
 */
import type { CortiEar } from "@/modules/memory/house";
import type { SoundCard } from "@/lib/sound/packet";
import type { PorchTake } from "@/lib/porch/types";
import { appendCanal, downsampleTape, DRAW_FRAMES, type CanalBatch, type CanalRecord } from "@/lib/sound/canal";

export type CortiLive = CortiEar & { t: number; organ: "corti" };

export type PorchLive = {
  organ: "porch";
  t: number;
  listening: boolean;
  take: PorchTake | null;
};

export type LucentKind = "camera" | "screen" | "file" | null;

export type LucentLive = {
  organ: "lucent";
  t: number;
  seeing: boolean;
  b64: string;
  width: number;
  height: number;
  kind: LucentKind;
};

const LUCENT_FRESH_MS = 2500;
const LUCENT_B64_CAP = 400_000;

const houseMem = globalThis as typeof globalThis & {
  __houseCorti__?: CortiLive | null;
  __houseSound__?: SoundCard | null;
  __houseSoundAt__?: number;
  __houseCanal__?: CanalRecord | null;
  __housePorch__?: PorchLive | null;
  __houseLucent__?: LucentLive | null;
};

let corti: CortiLive | null = houseMem.__houseCorti__ ?? null;
let sound: SoundCard | null = houseMem.__houseSound__ ?? null;
let soundAt = houseMem.__houseSoundAt__ ?? 0;
let canal: CanalRecord | null = houseMem.__houseCanal__ ?? null;
let porch: PorchLive | null = houseMem.__housePorch__ ?? null;
let lucent: LucentLive | null = houseMem.__houseLucent__ ?? null;

export function setCorti(next: CortiEar): CortiLive {
  corti = {
    organ: "corti",
    t: Date.now(),
    listening: Boolean(next.listening),
    rms: Number.isFinite(next.rms) ? next.rms : 0,
    zcr: Number.isFinite(next.zcr) ? next.zcr : 0,
    f0: next.locked && next.f0 != null && Number.isFinite(next.f0) && next.f0 > 0
      ? next.f0
      : null,
    locked: Boolean(next.locked && next.f0 != null && Number.isFinite(next.f0) && next.f0 > 0),
  };
  houseMem.__houseCorti__ = corti;
  return corti;
}

export function getCorti(): CortiLive | null {
  return corti;
}

export function setSound(card: SoundCard): SoundCard {
  sound = card;
  soundAt = Date.now();
  houseMem.__houseSound__ = sound;
  houseMem.__houseSoundAt__ = soundAt;
  return card;
}

export function getSound(): { card: SoundCard; t: number } | null {
  if (!sound) return null;
  return { card: sound, t: soundAt };
}

export function appendSoundCanal(batch: CanalBatch): CanalRecord {
  canal = appendCanal(canal, batch);
  houseMem.__houseCanal__ = canal;
  return canal;
}

export function getCanal(): CanalRecord | null {
  return canal;
}

export function getCanalDraw(): CanalRecord | null {
  if (!canal) return null;
  return { ...canal, tape: downsampleTape(canal.tape, DRAW_FRAMES) };
}

export function setPorch(next: { listening?: boolean; take?: PorchTake | null }): PorchLive {
  const take = next.take && typeof next.take.id === "string" ? next.take : porch?.take ?? null;
  porch = {
    organ: "porch",
    t: Date.now(),
    listening: Boolean(next.listening),
    take,
  };
  houseMem.__housePorch__ = porch;
  return porch;
}

export function getPorch(): PorchLive | null {
  return porch;
}

export function setLucent(next: {
  seeing?: boolean;
  b64?: string;
  width?: number;
  height?: number;
  kind?: LucentKind;
}): LucentLive {
  const incoming = typeof next.b64 === "string" ? next.b64 : "";
  const b64 =
    incoming && incoming.length <= LUCENT_B64_CAP
      ? incoming
      : incoming
        ? incoming.slice(0, LUCENT_B64_CAP)
        : lucent?.b64 ?? "";
  const seeing = Boolean(next.seeing && b64);
  lucent = {
    organ: "lucent",
    t: Date.now(),
    seeing,
    b64: seeing ? b64 : lucent?.b64 ?? "",
    width: Number.isFinite(next.width) ? Number(next.width) : lucent?.width ?? 0,
    height: Number.isFinite(next.height) ? Number(next.height) : lucent?.height ?? 0,
    kind: next.kind === "camera" || next.kind === "screen" || next.kind === "file" ? next.kind : lucent?.kind ?? null,
  };
  if (!next.seeing) {
    lucent.seeing = false;
  }
  houseMem.__houseLucent__ = lucent;
  return lucent;
}

export function getLucent(): (LucentLive & { age_ms: number }) | null {
  if (!lucent) return null;
  const age_ms = Date.now() - lucent.t;
  return {
    ...lucent,
    seeing: Boolean(lucent.seeing && lucent.b64 && age_ms < LUCENT_FRESH_MS),
    age_ms,
  };
}
