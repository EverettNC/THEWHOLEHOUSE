import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from "react";
import { LAYERS, formatDiopter } from "@/lib/cornea/optics";
import { useLiveFeed } from "@/lib/cornea/live-feed";
import { useCornea, useOptics } from "@/lib/cornea/store";
import { HOUSE_CHANNEL, eyeFromLive } from "@/modules/memory/house";
import { Controls } from "./Controls";
import { cn } from "@/lib/utils";

const CorneaScene = lazy(() =>
  import("./CorneaScene").then((m) => ({ default: m.CorneaScene })),
);
const SightView = lazy(() => import("./SightView").then((m) => ({ default: m.SightView })));

function Readout() {
  const optics = useOptics();
  const siliconMm = useCornea((s) => s.siliconMm);
  const focused = Math.abs(optics.defocusD) < 0.5;
  const live = useLiveFeed();
  const hasPixels = Boolean(live.status === "live" && (live.video || live.still));
  const source = hasPixels
    ? live.kind === "camera"
      ? "your camera"
      : live.kind === "screen"
        ? "this screen"
        : "your photo"
    : live.eyeOpen
      ? "the eye window"
      : "sample room";
  return (
    <dl className="flex flex-wrap justify-end gap-x-5 gap-y-1 font-mono text-xs tabular text-muted">
      <div className="hidden sm:block">
        <dt className="inline text-subtle">In </dt>
        <dd className="inline text-fg">{source}</dd>
      </div>
      <div>
        <dt className="inline text-subtle">F </dt>
        <dd className="inline text-fg">{formatDiopter(optics.totalPowerD)}</dd>
      </div>
      <div className="hidden sm:block">
        <dt className="inline text-subtle">K1 </dt>
        <dd className="inline text-fg">{optics.k1.toFixed(2)}</dd>
      </div>
      <div className="hidden md:block">
        <dt className="inline text-subtle">f </dt>
        <dd className="inline text-fg">{optics.focalLengthAirMm.toFixed(1)} mm</dd>
      </div>
      <div className="hidden md:block">
        <dt className="inline text-subtle">Si </dt>
        <dd className="inline text-fg">{siliconMm.toFixed(1)} mm</dd>
      </div>
      <div>
        <dt className="inline text-subtle">T </dt>
        <dd className="inline text-fg">{Math.round(optics.transmission * 100)}%</dd>
      </div>
      <div className="hidden sm:block">
        <dd className={cn("inline", focused ? "text-fg" : "text-muted")}>
          {focused ? "in focus" : `${optics.defocusD >= 0 ? "+" : ""}${optics.defocusD.toFixed(2)} D defocus`}
        </dd>
      </div>
    </dl>
  );
}

function PaneFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg">
      <div
        className="size-28 rounded-full opacity-80"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--color-fg) 35%, transparent), color-mix(in oklab, var(--color-accent) 18%, transparent) 42%, transparent 68%)",
          boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--color-fg) 12%, transparent)",
        }}
      />
    </div>
  );
}

class GlBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Lucent pane failed", error, info);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function HouseFromLucent() {
  const live = useLiveFeed();
  const optics = useOptics();
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(HOUSE_CHANNEL);
    const id = window.setInterval(() => {
      ch.postMessage({
        source: "lucent",
        t: Date.now(),
        lucent: eyeFromLive({
          status: live.status,
          kind: live.kind,
          transmission: optics.transmission,
          defocusD: optics.defocusD,
        }),
      });
    }, 800);
    return () => {
      window.clearInterval(id);
      ch.close();
    };
  }, [live.status, live.kind, optics.transmission, optics.defocusD]);
  return null;
}

export function LucentApp() {
  const selectedLayer = useCornea((s) => s.selectedLayer);
  const layer = LAYERS.find((l) => l.id === selectedLayer);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-bg text-fg">
      <HouseFromLucent />
      <header className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xl italic text-fg">Lucent</span>
          <span className="hidden text-xs tracking-caps text-muted uppercase sm:inline">synthetic cornea</span>
        </div>
        <Readout />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(280px,1.25fr)_minmax(200px,0.85fr)_minmax(160px,0.42fr)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:grid-rows-[minmax(0,1fr)_minmax(210px,34%)]">
        <section className="relative min-h-[220px] overflow-hidden lg:order-1">
          <div className="absolute inset-0">
            <GlBoundary fallback={<PaneFallback />}>
              <Suspense fallback={<PaneFallback />}>
                <SightView />
              </Suspense>
            </GlBoundary>
          </div>
          {layer ? (
            <p className="pointer-events-none absolute bottom-3 left-3 max-w-xs rounded-md bg-bg/70 px-3 py-2 text-xs leading-relaxed text-fg lg:hidden">
              <span className="font-medium">{layer.name}</span>
              {" — "}
              {layer.role}
            </p>
          ) : null}
        </section>

        <section className="relative min-h-[200px] overflow-hidden lg:order-2">
          <div className="absolute inset-0">
            <GlBoundary fallback={<PaneFallback />}>
              <Suspense fallback={<PaneFallback />}>
                <CorneaScene />
              </Suspense>
            </GlBoundary>
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-3">
            <span className="rounded-md bg-bg/50 px-2 py-1 font-mono text-xs text-muted">ORGAN</span>
            <span className="rounded-md bg-bg/50 px-2 py-1 font-mono text-xs text-muted">drag to orbit</span>
          </div>
          {layer ? (
            <p className="pointer-events-none absolute bottom-3 left-3 hidden max-w-xs rounded-md bg-bg/70 px-3 py-2 text-xs leading-relaxed text-fg lg:block">
              <span className="font-medium">{layer.name}</span>
              {" — "}
              {layer.role}
            </p>
          ) : null}
        </section>

        <section className="min-h-0 overflow-y-auto border-t border-border bg-surface px-4 py-4 pb-24 sm:px-6 lg:order-3 lg:col-span-2">
          <Controls />
        </section>
      </div>
    </div>
  );
}
