import { useEffect, useState } from "react";
import { blobToBase64 } from "@/lib/utils";
import { postLucentLive } from "@/lib/house/bridge-feed";

export type LiveStatus = "idle" | "requesting" | "live" | "denied" | "missing";
export type LiveKind = "camera" | "screen" | "file" | null;
export type StillEl = HTMLImageElement | HTMLCanvasElement;

export interface LiveSnap {
  status: LiveStatus;
  kind: LiveKind;
  video: HTMLVideoElement | null;
  still: StillEl | null;
  error: string | null;
  embedded: boolean;
  eyeOpen: boolean;
}

type Listener = () => void;

interface Bag {
  videoEl: HTMLVideoElement | null;
  stream: MediaStream | null;
  objectUrl: string | null;
  stillEl: StillEl | null;
  status: LiveStatus;
  kind: LiveKind;
  error: string | null;
  facing: "environment" | "user";
  listeners: Set<Listener>;
  seeWin: Window | null;
  seeListening: boolean;
  pumpCanvas: HTMLCanvasElement | null;
  pumpRaf: number;
  eyeOpen: boolean;
}

function bag(): Bag {
  const g = globalThis as typeof globalThis & { __lucentSight?: Bag };
  if (!g.__lucentSight) {
    g.__lucentSight = {
      videoEl: null,
      stream: null,
      objectUrl: null,
      stillEl: null,
      status: "idle",
      kind: null,
      error: null,
      facing: "environment",
      listeners: new Set(),
      seeWin: null,
      seeListening: false,
      pumpCanvas: null,
      pumpRaf: 0,
      eyeOpen: false,
    };
  }
  const current = g.__lucentSight;
  if (current.pumpCanvas === undefined) current.pumpCanvas = null;
  if (current.pumpRaf === undefined) current.pumpRaf = 0;
  if (current.eyeOpen === undefined) current.eyeOpen = false;
  return current;
}

function emit() {
  bag().listeners.forEach((fn) => fn());
}

export function isEmbeddedFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function liveStreamBlocked(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const policy =
      (document as Document & { permissionsPolicy?: { allowsFeature: (f: string) => boolean } }).permissionsPolicy ||
      (document as Document & { featurePolicy?: { allowsFeature: (f: string) => boolean } }).featurePolicy;
    if (policy && typeof policy.allowsFeature === "function") {
      return policy.allowsFeature("camera") === false;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function ensureVideo() {
  const b = bag();
  if (!b.videoEl) {
    b.videoEl = document.createElement("video");
    b.videoEl.muted = true;
    b.videoEl.autoplay = true;
    b.videoEl.playsInline = true;
    b.videoEl.setAttribute("playsinline", "");
    b.videoEl.setAttribute("webkit-playsinline", "");
    b.videoEl.setAttribute("muted", "");
  }
  return b.videoEl;
}

function stopPump() {
  const b = bag();
  if (b.pumpRaf) {
    window.cancelAnimationFrame(b.pumpRaf);
    b.pumpRaf = 0;
  }
}

function ensurePumpCanvas() {
  const b = bag();
  if (!b.pumpCanvas) b.pumpCanvas = document.createElement("canvas");
  return b.pumpCanvas;
}

function markLiveFromCanvas(canvas: HTMLCanvasElement) {
  const b = bag();
  b.stillEl = canvas;
  b.kind = "camera";
  b.error = null;
  if (b.status !== "live") {
    b.status = "live";
    emit();
  }
}

function acceptRemoteFrame(bmp: ImageBitmap) {
  const canvas = ensurePumpCanvas();
  if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
    canvas.width = Math.max(2, bmp.width);
    canvas.height = Math.max(2, bmp.height);
  }
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    bmp.close();
    return;
  }
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  markLiveFromCanvas(canvas);
}

function startLocalVideoPump(win: Window) {
  let src: HTMLVideoElement | null = null;
  try {
    src = win.document.querySelector("video");
  } catch {
    return false;
  }
  if (!src) return false;
  const canvas = ensurePumpCanvas();
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return false;
  const b = bag();
  if (b.pumpRaf) window.cancelAnimationFrame(b.pumpRaf);
  const tick = () => {
    const now = bag();
    if (!now.seeWin || now.seeWin.closed) return;
    try {
      if (src.videoWidth > 0) {
        if (canvas.width !== src.videoWidth || canvas.height !== src.videoHeight) {
          canvas.width = src.videoWidth;
          canvas.height = src.videoHeight;
        }
        ctx.drawImage(src, 0, 0);
        markLiveFromCanvas(canvas);
      }
    } catch {
      /* cross-origin — frames arrive by message */
    }
    now.pumpRaf = window.requestAnimationFrame(tick);
  };
  b.pumpRaf = window.requestAnimationFrame(tick);
  return true;
}

function closeSeeWin() {
  const b = bag();
  try {
    if (b.seeWin && !b.seeWin.closed) b.seeWin.close();
  } catch {
    /* ignore */
  }
  b.seeWin = null;
  b.eyeOpen = false;
}

function clearMedia() {
  const b = bag();
  stopPump();
  b.stream?.getTracks().forEach((t) => t.stop());
  b.stream = null;
  if (b.videoEl) {
    b.videoEl.pause();
    b.videoEl.srcObject = null;
    b.videoEl.removeAttribute("src");
    b.videoEl.load();
  }
  if (b.objectUrl) {
    URL.revokeObjectURL(b.objectUrl);
    b.objectUrl = null;
  }
  b.stillEl = null;
}

export function getLiveSnap(): LiveSnap {
  const b = bag();
  return {
    status: b.status,
    kind: b.kind,
    video: b.videoEl,
    still: b.stillEl,
    error: b.error,
    embedded: isEmbeddedFrame(),
    eyeOpen: Boolean(b.eyeOpen && b.seeWin && !b.seeWin.closed),
  };
}

export function subscribeLive(fn: Listener) {
  const listeners = bag().listeners;
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useLiveFeed(): LiveSnap {
  const [snap, setSnap] = useState(getLiveSnap);
  useEffect(() => subscribeLive(() => setSnap(getLiveSnap())), []);
  return snap;
}

function waitForVideo(video: HTMLVideoElement) {
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("loadeddata", done);
      video.removeEventListener("playing", done);
      resolve();
    };
    video.addEventListener("loadeddata", done);
    video.addEventListener("playing", done);
    window.setTimeout(done, 1800);
  });
}

async function attachStream(next: MediaStream, nextKind: LiveKind) {
  const b = bag();
  if (b.stream && b.stream !== next) {
    b.stream.getTracks().forEach((t) => t.stop());
  }
  if (b.objectUrl) {
    URL.revokeObjectURL(b.objectUrl);
    b.objectUrl = null;
  }
  b.stillEl = null;
  b.stream = next;
  b.kind = nextKind;
  const video = ensureVideo();
  video.srcObject = next;
  try {
    await video.play();
  } catch {
    /* autoplay can wait */
  }
  await waitForVideo(video);
  next.getVideoTracks().forEach((track) => {
    track.addEventListener("ended", () => {
      if (bag().stream === next) stopLiveFeed();
    });
  });
  b.status = "live";
  b.error = null;
  emit();
}

function listenForSeeWindow() {
  const b = bag();
  if (b.seeListening) return;
  b.seeListening = true;
  window.addEventListener("message", (event) => {
    const data = event.data as { channel?: string; type?: string; bmp?: ImageBitmap; buf?: ArrayBuffer } | null;
    if (!data || data.channel !== "lucent-see") return;
    if (event.source && event.source !== window) {
      try {
        b.seeWin = event.source as Window;
      } catch {
        /* ignore */
      }
    }
    if (data.type === "jpeg" && data.buf instanceof ArrayBuffer) {
      if (b.seeWin && !b.seeWin.closed) {
        void createImageBitmap(new Blob([data.buf], { type: "image/jpeg" })).then(acceptRemoteFrame).catch(() => {});
      }
      return;
    }
    if (data.type === "frame" && data.bmp instanceof ImageBitmap) {
      if (b.seeWin && !b.seeWin.closed) acceptRemoteFrame(data.bmp);
      else data.bmp.close();
      return;
    }
    if (data.type === "ready") {
      b.eyeOpen = true;
      b.kind = "camera";
      b.error = null;
      if (b.status === "requesting") b.status = "idle";
      emit();
      const win = b.seeWin;
      if (win && !win.closed) startLocalVideoPump(win);
      return;
    }
    if (data.type === "denied") {
      b.eyeOpen = Boolean(b.seeWin && !b.seeWin.closed);
      b.error = "Allow the camera in the eye window.";
      emit();
      return;
    }
    if (data.type === "closed") {
      b.eyeOpen = false;
      if (b.kind === "camera") stopLiveFeed();
    }
  });
}

async function stealFromPopup(win: Window): Promise<boolean> {
  const b = bag();
  listenForSeeWindow();
  startLocalVideoPump(win);
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (win.closed) {
      b.status = "idle";
      b.error = null;
      emit();
      return false;
    }
    if (b.eyeOpen || (b.stillEl instanceof HTMLCanvasElement && b.stillEl.width > 2)) {
      return true;
    }
    await new Promise((r) => window.setTimeout(r, 80));
  }
  b.status = "denied";
  b.error = "Allow the camera in the sight window.";
  emit();
  return false;
}

async function startInPageCamera(): Promise<boolean> {
  const b = bag();
  if (!navigator.mediaDevices?.getUserMedia) {
    b.status = "missing";
    b.error = "This browser has no camera.";
    emit();
    return false;
  }
  try {
    let next: MediaStream;
    try {
      next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: b.facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch {
      next = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
    closeSeeWin();
    await attachStream(next, "camera");
    return true;
  } catch {
    return false;
  }
}

function openSeeWindow(): Window | null {
  let popup: Window | null = null;
  try {
    popup = window.open(
      "/see",
      "lucent-see",
      "popup=yes,width=1100,height=740,menubar=no,toolbar=no,location=no,status=no",
    );
  } catch {
    popup = null;
  }
  if (!popup) {
    try {
      popup = window.open("/see", "lucent-see");
    } catch {
      popup = null;
    }
  }
  if (!popup) {
    window.location.assign("/see");
    return null;
  }
  try {
    popup.focus();
  } catch {
    /* ignore */
  }
  return popup;
}

export function prepareEyeWindow() {
  listenForSeeWindow();
  const b = bag();
  b.status = "requesting";
  b.error = null;
  emit();
}

export function focusSeeWindow() {
  const b = bag();
  if (b.seeWin && !b.seeWin.closed) {
    try {
      b.seeWin.focus();
    } catch {
      /* ignore */
    }
    return true;
  }
  void startDeviceCamera();
  return false;
}

export async function startDeviceCamera(
  nextFacing: "environment" | "user" = bag().facing,
  opts: { silent?: boolean } = {},
) {
  const b = bag();
  b.facing = nextFacing ?? b.facing;
  b.status = "requesting";
  b.error = null;
  emit();

  const embedded = isEmbeddedFrame();
  if (!opts.silent && embedded) {
    listenForSeeWindow();
    const popup = b.seeWin && !b.seeWin.closed ? b.seeWin : openSeeWindow();
    b.seeWin = popup;
    if (!popup) {
      b.status = "requesting";
      b.error = "Opening the eye…";
      emit();
      return false;
    }
    startLocalVideoPump(popup);
    return stealFromPopup(popup);
  }

  const inPage = await startInPageCamera();
  if (inPage) return true;

  if (opts.silent) {
    b.status = "idle";
    b.error = null;
    emit();
    return false;
  }

  b.status = "denied";
  b.kind = null;
  b.error = "Allow the camera so silicon can see.";
  emit();
  return false;
}

export async function flipCamera() {
  const b = bag();
  const next = b.facing === "environment" ? "user" : "environment";
  b.facing = next;
  if (b.seeWin && !b.seeWin.closed) {
    try {
      b.seeWin.postMessage({ channel: "lucent-see", type: "flip", facing: next }, "*");
      return;
    } catch {
      /* reopen */
    }
  }
  await startDeviceCamera(next);
}

export async function startScreenFeed() {
  const b = bag();
  if (!navigator.mediaDevices?.getDisplayMedia) {
    b.status = "missing";
    b.kind = null;
    b.error = "This browser cannot share a screen.";
    emit();
    return;
  }
  b.status = "requesting";
  b.error = null;
  emit();
  try {
    const next = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    next.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => stopLiveFeed());
    });
    await attachStream(next, "screen");
  } catch {
    clearMedia();
    b.status = "idle";
    b.kind = null;
    b.error = null;
    emit();
  }
}

async function rasterizeStill(img: HTMLImageElement, maxEdge = 1920): Promise<HTMLCanvasElement> {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h, 1));
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(w * scale));
  c.height = Math.max(2, Math.round(h * scale));
  const ctx = c.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function guessType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) return "video/mp4";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".heic") || lower.endsWith(".heif")) {
    return "image/jpeg";
  }
  return "image/jpeg";
}

export async function attachLocalFile(file: File) {
  const b = bag();
  const type = file.type || guessType(file.name);
  if (!type.startsWith("image/") && !type.startsWith("video/")) {
    b.status = "denied";
    b.kind = null;
    b.error = "That file is not a photo or video.";
    emit();
    return;
  }
  const buffer = await file.arrayBuffer();
  const stable = new File([buffer], file.name || "sight", { type, lastModified: file.lastModified });
  closeSeeWin();
  clearMedia();
  b.status = "requesting";
  b.kind = "file";
  b.error = null;
  emit();
  const url = URL.createObjectURL(stable);
  b.objectUrl = url;
  if (type.startsWith("video/")) {
    const video = ensureVideo();
    video.srcObject = null;
    video.src = url;
    try {
      await video.play();
    } catch {
      /* wait */
    }
    await waitForVideo(video);
    b.status = "live";
    emit();
    return;
  }
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("image-timeout")), 4000);
      img.onload = () => {
        window.clearTimeout(timer);
        resolve();
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("image"));
      };
      img.src = url;
    });
    b.stillEl = await rasterizeStill(img);
  } catch {
    b.status = "denied";
    b.kind = null;
    b.error = "Could not read that still.";
    emit();
    return;
  }
  b.status = "live";
  b.error = null;
  emit();
}

export function onSightFileInput(event: { currentTarget: HTMLInputElement }) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  void attachLocalFile(file).finally(() => {
    input.value = "";
  });
}

export async function attachDroppedFiles(files: FileList | File[] | null | undefined) {
  if (!files || files.length === 0) return;
  const list = Array.from(files);
  const file = list.find((f) => f.type.startsWith("image/") || f.type.startsWith("video/")) ?? list[0];
  if (file) await attachLocalFile(file);
}

export async function attachClipboardData(data: DataTransfer | null | undefined) {
  if (!data) return false;
  const items = Array.from(data.items ?? []);
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        await attachLocalFile(file);
        return true;
      }
    }
  }
  const files = data.files ? Array.from(data.files) : [];
  const image = files.find((f) => f.type.startsWith("image/"));
  if (image) {
    await attachLocalFile(image);
    return true;
  }
  return false;
}

export function stopLiveFeed() {
  const b = bag();
  closeSeeWin();
  clearMedia();
  b.status = "idle";
  b.kind = null;
  b.error = null;
  emit();
}

export function liveSourceReady(snap: LiveSnap): HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null {
  if (snap.still) {
    if (snap.still instanceof HTMLCanvasElement && snap.still.width > 0) return snap.still;
    if (snap.still instanceof HTMLImageElement && snap.still.complete && snap.still.naturalWidth > 0) {
      return snap.still;
    }
  }
  if (
    snap.status === "live" &&
    snap.video &&
    snap.video.readyState >= 2 &&
    snap.video.videoWidth > 0
  ) {
    return snap.video;
  }
  return null;
}

const HOUSE_EYE_MS = 500;
let houseEyeTimer = 0;
let houseEyeBusy = false;
let houseEyeOn = false;

function sourceSize(src: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth || src.width, h: src.naturalHeight || src.height };
  return { w: src.width, h: src.height };
}

async function pushHouseEye() {
  if (houseEyeBusy) return;
  const snap = getLiveSnap();
  const src = liveSourceReady(snap);
  if (!src) return;
  const { w, h } = sourceSize(src);
  if (w < 2 || h < 2) return;
  houseEyeBusy = true;
  try {
    const maxEdge = 640;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const cw = Math.max(2, Math.round(w * scale));
    const ch = Math.max(2, Math.round(h * scale));
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.drawImage(src, 0, 0, cw, ch);
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/jpeg", 0.55));
    if (!blob) return;
    const b64 = await blobToBase64(blob);
    void postLucentLive({
      seeing: true,
      b64,
      width: cw,
      height: ch,
      kind: snap.kind,
    });
  } finally {
    houseEyeBusy = false;
  }
}

function startHouseEye() {
  if (houseEyeTimer) return;
  houseEyeTimer = window.setInterval(() => {
    void pushHouseEye();
  }, HOUSE_EYE_MS);
}

function stopHouseEye() {
  if (houseEyeTimer) {
    window.clearInterval(houseEyeTimer);
    houseEyeTimer = 0;
  }
  void postLucentLive({ seeing: false, b64: "", width: 0, height: 0, kind: null });
}

function syncHouseEye() {
  const snap = getLiveSnap();
  const live = snap.status === "live" && Boolean(liveSourceReady(snap) || snap.eyeOpen);
  if (live && !houseEyeOn) {
    houseEyeOn = true;
    startHouseEye();
  } else if (!live && houseEyeOn) {
    houseEyeOn = false;
    stopHouseEye();
  }
}

if (typeof window !== "undefined") {
  subscribeLive(syncHouseEye);
}
