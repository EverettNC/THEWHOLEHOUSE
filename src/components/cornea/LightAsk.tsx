import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EyeLink } from "./EyeLink";
import {
  focusSeeWindow,
  isEmbeddedFrame,
  liveSourceReady,
  startDeviceCamera,
  useLiveFeed,
} from "@/lib/cornea/live-feed";

export function LightAsk() {
  const live = useLiveFeed();
  const busy = live.status === "requesting";
  if (liveSourceReady(live)) return null;
  if (live.eyeOpen) {
    return (
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center gap-2 bg-bg/70 px-3 py-3">
        <p className="mr-auto min-w-0 text-xs text-muted">
          This preview cannot hold a camera. Silicon is seeing in the eye window.
        </p>
        <Button size="sm" onClick={() => focusSeeWindow()}>
          <Camera />
          Show eye
        </Button>
      </div>
    );
  }
  const embedded = live.embedded || (typeof window !== "undefined" && isEmbeddedFrame());
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center gap-2 bg-bg/70 px-3 py-3">
      <p className="mr-auto min-w-0 text-xs text-muted">
        {live.error ||
          (embedded
            ? "This preview cannot hold a camera. Live sight is its own window."
            : "Live camera through the cornea.")}
      </p>
      {embedded ? (
        <EyeLink />
      ) : (
        <Button size="sm" disabled={busy} onClick={() => void startDeviceCamera()}>
          <Camera />
          {busy ? "Opening eye" : "Live sight"}
        </Button>
      )}
    </div>
  );
}
