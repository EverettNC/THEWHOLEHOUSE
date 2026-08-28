import { useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HouseSign() {
  const video = useRef<HTMLVideoElement>(null);
  const [hearing, setHearing] = useState(false);

  async function hear() {
    const el = video.current;
    if (!el) return;
    el.muted = false;
    el.loop = false;
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
    <figure className="m-0">
      <div className="overflow-hidden rounded-sm bg-bg shadow-border">
        <video
          ref={video}
          className="aspect-video w-full"
          autoPlay
          muted
          loop
          playsInline
          poster="/house/sign.jpg"
          onEnded={onEnded}
          aria-label="The Christman AI Family plaque turns. The back reads The Whole House."
        >
          <source src="/house/sign.mp4" type="video/mp4" />
        </video>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void hear()} data-testid="hear-the-sign">
          <Volume2 />
          {hearing ? "Playing" : "You gotta see this"}
        </Button>
        <p className="font-mono text-[0.625rem] tracking-[0.16em] text-subtle uppercase">
          The turn has a voice. Press it.
        </p>
      </figcaption>
    </figure>
  );
}
