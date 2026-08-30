import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HapticMark() {
  const video = useRef<HTMLVideoElement>(null);
  const [hearing, setHearing] = useState(false);

  async function hear() {
    const el = video.current;
    if (!el) return;
    el.muted = false;
    el.volume = 1;
    el.currentTime = 0;
    try {
      await el.play();
      setHearing(true);
    } catch {
      setHearing(false);
    }
  }

  function onEnded() {
    const el = video.current;
    if (!el) return;
    el.muted = true;
    el.loop = true;
    setHearing(false);
    void el.play().catch(() => undefined);
  }

  return (
    <figure className="mt-8 mb-2 max-w-lg">
      <button
        type="button"
        onClick={() => void hear()}
        className="block w-full overflow-hidden rounded-sm bg-bg text-left shadow-border"
        aria-label="Play the haptic mark with sound"
      >
        <video
          ref={video}
          className="pointer-events-none aspect-square w-full"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/house/haptic.jpg"
          onEnded={onEnded}
        >
          <source src="/house/haptic.mp4" type="video/mp4" />
        </video>
      </button>
      <figcaption className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => void hear()}>
          {hearing ? <Volume2 /> : <VolumeX />}
          {hearing ? "Hearing the skin" : "Hear the haptic"}
        </Button>
        <p className="font-mono text-[0.625rem] tracking-[0.18em] text-subtle uppercase">
          Skin · Haptic · The machine under the skin
        </p>
      </figcaption>
    </figure>
  );
}
