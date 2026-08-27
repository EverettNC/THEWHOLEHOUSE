import { useCallback, useEffect, useRef, useState } from "react";

function framed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function EyeWindow() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef<"environment" | "user">("environment");
  const [msg, setMsg] = useState("Opening the eye…");
  const [needAllow, setNeedAllow] = useState(false);
  const [inFrame, setInFrame] = useState(false);
  const [live, setLive] = useState(false);

  const tell = useCallback((type: string, extra?: Record<string, unknown>) => {
    if (!window.opener || window.opener.closed) return;
    window.opener.postMessage({ channel: "lucent-see", type, ...extra }, "*");
  }, []);

  const openEye = useCallback(async () => {
    setMsg("Opening the eye…");
    setNeedAllow(false);
    const video = videoRef.current;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      setMsg("This browser has no camera.");
      setNeedAllow(true);
      tell("denied");
      return;
    }
    try {
      let next: MediaStream;
      try {
        next = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingRef.current },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        next = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = next;
      video.srcObject = next;
      video.muted = true;
      video.playsInline = true;
      await video.play().catch(() => {});
      setLive(true);
      setMsg("Live through the cornea. Keep this window open.");
      tell("ready");
    } catch {
      setLive(false);
      setNeedAllow(true);
      setMsg(
        framed()
          ? "This preview cannot hold a camera. Open the eye as its own window."
          : "Allow the camera in this window. That is the only place silicon can see.",
      );
      tell("denied");
    }
  }, [tell]);

  useEffect(() => {
    setInFrame(framed());
    void openEye();
    const onUnload = () => tell("closed");
    window.addEventListener("beforeunload", onUnload);
    const onMsg = (event: MessageEvent) => {
      if (event.source !== window.opener) return;
      const data = event.data as { channel?: string; type?: string; facing?: string } | null;
      if (!data || data.channel !== "lucent-see") return;
      if (data.type === "flip") {
        facingRef.current = data.facing === "user" ? "user" : "environment";
        void openEye();
      }
    };
    window.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("message", onMsg);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [openEye, tell]);

  useEffect(() => {
    if (!live) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    let raf = 0;
    let jpegBusy = false;
    const draw = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const tw = Math.max(2, Math.floor(w * dpr));
      const th = Math.max(2, Math.floor(h * dpr));
      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw;
        canvas.height = th;
      }
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx && video.videoWidth > 1) {
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, tw, th);
        ctx.save();
        ctx.beginPath();
        ctx.arc(tw / 2, th / 2, Math.min(tw, th) * 0.48, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(video, 0, 0, tw, th);
        ctx.restore();
      }
      raf = window.requestAnimationFrame(draw);
    };
    raf = window.requestAnimationFrame(draw);

    const pump = window.setInterval(() => {
      if (!window.opener || window.opener.closed || jpegBusy || video.videoWidth < 2) return;
      jpegBusy = true;
      const c = document.createElement("canvas");
      const w = 640;
      const h = Math.max(2, Math.round(640 * (video.videoHeight / Math.max(video.videoWidth, 1))));
      c.width = w;
      c.height = h;
      c.getContext("2d")?.drawImage(video, 0, 0, w, h);
      c.toBlob(
        (blob) => {
          if (!blob) {
            jpegBusy = false;
            return;
          }
          void blob.arrayBuffer().then((buf) => {
            jpegBusy = false;
            if (!window.opener || window.opener.closed) return;
            window.opener.postMessage({ channel: "lucent-see", type: "jpeg", buf, w, h }, "*", [buf]);
          });
        },
        "image/jpeg",
        0.55,
      );
    }, 80);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(pump);
    };
  }, [live]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <div className="relative min-h-0 flex-1 bg-bg">
        <video ref={videoRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-0" muted playsInline autoPlay />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <p className="pointer-events-none absolute top-3.5 left-4 font-mono text-[11px] tracking-wide text-fg/70">
          YOUR SIGHT THROUGH CORNEA
        </p>
      </div>
      <div className="flex items-center gap-3 bg-bg px-4 py-3">
        <p className="min-w-0 flex-1 text-xs text-muted">{msg}</p>
        {live ? (
          <button
            type="button"
            className="h-11 rounded-md px-3.5 text-sm text-fg shadow-[var(--shadow-border)]"
            onClick={() => {
              facingRef.current = facingRef.current === "user" ? "environment" : "user";
              void openEye();
            }}
          >
            Flip
          </button>
        ) : null}
        {needAllow ? (
          inFrame ? (
            <a
              href="/see"
              target="lucent-see"
              rel="opener"
              className="inline-flex h-11 items-center rounded-md bg-accent px-3.5 text-sm font-medium text-accent-fg"
            >
              Open eye
            </a>
          ) : (
            <button
              type="button"
              className="h-11 rounded-md bg-accent px-3.5 text-sm font-medium text-accent-fg"
              onClick={() => void openEye()}
            >
              Allow camera
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
