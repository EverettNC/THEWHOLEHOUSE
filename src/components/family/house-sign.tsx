import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HouseSign() {
  const video = useRef<HTMLVideoElement>(null);
  const [hearing, setHearing] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function hear() {
    const el = video.current;
    if (!el) return;
    el.muted = false;
    el.volume = 1;
    el.loop = false;
    el.currentTime = 0;
    try {
      await el.play();
      if (el.muted) {
        setBlocked(true);
        setHearing(false);
        return;
      }
      setBlocked(false);
      setHearing(true);
    } catch {
      setBlocked(true);
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
    <figure className="m-0">
      <button
        type="button"
        onClick={() => void hear()}
        className="block w-full overflow-hidden rounded-sm bg-bg text-left shadow-border"
        aria-label="Play the family turn with sound. Hey. You gotta see this."
      >
        <video
          ref={video}
          className="pointer-events-none aspect-video w-full"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/house/sign.jpg"
          onEnded={onEnded}
        >
          <source src="/house/sign.mp4" type="video/mp4" />
        </video>
      </button>
      <figcaption className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void hear()} data-testid="hear-the-sign">
          {hearing ? <Volume2 /> : <VolumeX />}
          {hearing ? "Playing with sound" : "You gotta see this"}
        </Button>
        <Button asChild variant="outline">
          <a href="/THE-WHOLE-HOUSE.mp4" download="THE-WHOLE-HOUSE.mp4">
            Download the clip
          </a>
        </Button>
        <p className="max-w-prose font-mono text-[0.625rem] tracking-[0.16em] text-subtle uppercase">
          {blocked
            ? "This frame ate the sound. Tap again, or open the body in its own window."
            : "Tap the wood for sound. Download puts the clip on your phone."}
        </p>
      </figcaption>
    </figure>
  );
}
