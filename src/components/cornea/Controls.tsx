import { Camera, ImageIcon, Layers, Monitor, SplitSquareHorizontal } from "lucide-react";
import { useRef } from "react";
import { LAYERS, PATHOLOGY, WORLDS, formatDiopter, formatMm, type PathologyId } from "@/lib/cornea/optics";
import {
  onSightFileInput,
  startDeviceCamera,
  startScreenFeed,
  stopLiveFeed,
  useLiveFeed,
} from "@/lib/cornea/live-feed";
import { useCornea, useCorneaParams, useOptics } from "@/lib/cornea/store";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { EyeLink } from "./EyeLink";

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="font-mono text-xs tabular text-fg">{value}</span>
      </span>
      {children}
    </label>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium transition-[background-color,color,opacity] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
        on ? "bg-accent text-accent-fg" : "text-muted shadow-[var(--shadow-border)] hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function Controls() {
  const p = useCorneaParams();
  const optics = useOptics();
  const setParam = useCornea((s) => s.setParam);
  const pathology = useCornea((s) => s.pathology);
  const applyPathology = useCornea((s) => s.applyPathology);
  const worldId = useCornea((s) => s.worldId);
  const setWorld = useCornea((s) => s.setWorld);
  const demoWorld = useCornea((s) => s.demoWorld);
  const live = useLiveFeed();
  const compare = useCornea((s) => s.compare);
  const setCompare = useCornea((s) => s.setCompare);
  const showRays = useCornea((s) => s.showRays);
  const setShowRays = useCornea((s) => s.setShowRays);
  const crossSection = useCornea((s) => s.crossSection);
  const setCrossSection = useCornea((s) => s.setCrossSection);
  const mosaic = useCornea((s) => s.mosaic);
  const setMosaic = useCornea((s) => s.setMosaic);
  const selectedLayer = useCornea((s) => s.selectedLayer);
  const setSelectedLayer = useCornea((s) => s.setSelectedLayer);
  const photoRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.85fr)]">
      <section className="min-w-0">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Optics</h2>
          <span className="font-mono text-xs tabular text-fg">{formatDiopter(optics.totalPowerD)}</span>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Anterior radius" value={formatMm(p.anteriorRadiusMm)}>
            <Slider
              min={6.2}
              max={9.2}
              step={0.02}
              value={[p.anteriorRadiusMm]}
              onValueChange={([v]) => setParam("anteriorRadiusMm", v)}
            />
          </Field>
          <Field label="Posterior radius" value={formatMm(p.posteriorRadiusMm)}>
            <Slider
              min={5.4}
              max={7.6}
              step={0.02}
              value={[p.posteriorRadiusMm]}
              onValueChange={([v]) => setParam("posteriorRadiusMm", v)}
            />
          </Field>
          <Field label="Central thickness" value={`${(p.thicknessMm * 1000).toFixed(0)} µm`}>
            <Slider
              min={0.42}
              max={0.78}
              step={0.005}
              value={[p.thicknessMm]}
              onValueChange={([v]) => setParam("thicknessMm", v)}
            />
          </Field>
          <Field label="Asphericity Q" value={p.qAnterior.toFixed(2)}>
            <Slider
              min={-1.4}
              max={0.6}
              step={0.02}
              value={[p.qAnterior]}
              onValueChange={([v]) => setParam("qAnterior", v)}
            />
          </Field>
          <Field label="Astigmatism" value={formatDiopter(p.astigmatismD)}>
            <Slider
              min={-0.01}
              max={5}
              step={0.05}
              value={[p.astigmatismD]}
              onValueChange={([v]) => setParam("astigmatismD", v)}
            />
          </Field>
          <Field label="Cylinder axis" value={`${p.axisDeg.toFixed(0)}°`}>
            <Slider
              min={0}
              max={180}
              step={1}
              value={[p.axisDeg]}
              onValueChange={([v]) => setParam("axisDeg", v)}
            />
          </Field>
          <Field label="Pupil" value={formatMm(p.pupilMm, 1)}>
            <Slider
              min={2}
              max={8}
              step={0.1}
              value={[p.pupilMm]}
              onValueChange={([v]) => setParam("pupilMm", v)}
            />
          </Field>
          <Field label="Silicon plane" value={formatMm(p.siliconMm, 1)}>
            <Slider
              min={14}
              max={40}
              step={0.1}
              value={[p.siliconMm]}
              onValueChange={([v]) => setParam("siliconMm", v)}
            />
          </Field>
          <Field label="Tear film" value={`${Math.round(p.tearFilm * 100)}%`}>
            <Slider
              min={0.1}
              max={1}
              step={0.01}
              value={[p.tearFilm]}
              onValueChange={([v]) => setParam("tearFilm", v)}
            />
          </Field>
          <Field label="Hydration" value={`${Math.round(p.hydration * 100)}%`}>
            <Slider
              min={0.62}
              max={0.95}
              step={0.01}
              value={[p.hydration]}
              onValueChange={([v]) => setParam("hydration", v)}
            />
          </Field>
        </div>
      </section>

      <section className="min-w-0">
        <h2 className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Tissue state</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PATHOLOGY) as PathologyId[]).map((id) => (
            <Toggle key={id} on={pathology === id} onClick={() => applyPathology(id)}>
              {PATHOLOGY[id].label}
            </Toggle>
          ))}
        </div>
        <p className="mt-3 text-sm leading-snug text-muted">{PATHOLOGY[pathology].note}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Toggle on={showRays} onClick={() => setShowRays(!showRays)}>
            Rays
          </Toggle>
          <Toggle on={crossSection} onClick={() => setCrossSection(!crossSection)}>
            <Layers className="size-3.5" />
            Section
          </Toggle>
          <Toggle on={compare} onClick={() => setCompare(!compare)}>
            <SplitSquareHorizontal className="size-3.5" />
            Split
          </Toggle>
          <Toggle on={mosaic} onClick={() => setMosaic(!mosaic)}>
            Mosaic
          </Toggle>
        </div>
      </section>

      <section className="min-w-0">
        <h2 className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Incoming light</h2>
        <input
          ref={photoRef}
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          onChange={onSightFileInput}
        />
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant={live.kind === "file" && live.status === "live" ? "primary" : "secondary"}
            className="w-full"
            disabled={live.status === "requesting"}
            onClick={() => photoRef.current?.click()}
          >
            <ImageIcon />
            Photo of what I see
          </Button>
          {live.embedded ? (
            <EyeLink className="w-full" size="md" />
          ) : (
            <Button
              type="button"
              variant={live.kind === "camera" && live.status === "live" ? "primary" : "secondary"}
              className="w-full"
              disabled={live.status === "requesting"}
              onClick={() => {
                if (live.status === "live" && live.kind === "camera") {
                  stopLiveFeed();
                  return;
                }
                void startDeviceCamera();
              }}
            >
              <Camera />
              {live.kind === "camera" && live.status === "live" ? "Camera live — your sight" : "Live sight"}
            </Button>
          )}
          <Button
            type="button"
            variant={live.kind === "screen" && live.status === "live" ? "primary" : "secondary"}
            className="w-full"
            disabled={live.status === "requesting"}
            onClick={() => {
              if (live.status === "live" && live.kind === "screen") stopLiveFeed();
              else void startScreenFeed();
            }}
          >
            <Monitor />
            {live.kind === "screen" && live.status === "live" ? "Screen live" : "This screen"}
          </Button>
        </div>
        {live.error ? <p className="mt-2 text-xs text-muted">{live.error}</p> : null}

        <p className="mt-4 mb-2 text-xs text-subtle">Sample light — replace anytime with a photo</p>
          <div className="grid grid-cols-3 gap-2">
            {WORLDS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  stopLiveFeed();
                  setWorld(w.id);
                }}
                className={cn(
                  "group overflow-hidden rounded-md text-left shadow-[var(--shadow-border)] transition-[box-shadow] duration-[var(--motion-quick)]",
                  demoWorld && worldId === w.id && "shadow-[var(--shadow-border-hover)] ring-1 ring-accent/70",
                )}
              >
                <img
                  src={w.src}
                  alt=""
                  className="aspect-video w-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
                />
                <span className="block px-2 py-1.5 text-xs text-muted group-hover:text-fg">{w.label}</span>
              </button>
            ))}
          </div>

        <h2 className="mt-5 mb-2 text-xs font-medium tracking-wide text-muted uppercase">Five layers</h2>
        <ul className="space-y-1">
          {LAYERS.map((layer) => {
            const on = selectedLayer === layer.id;
            return (
              <li key={layer.id}>
                <button
                  type="button"
                  onClick={() => setSelectedLayer(on ? null : layer.id)}
                  className={cn(
                    "flex w-full items-baseline gap-3 rounded-md px-2 py-2 text-left transition-colors duration-[var(--motion-quick)]",
                    on ? "bg-raised text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <span className="w-24 shrink-0 text-sm font-medium text-fg">{layer.name}</span>
                  <span className="font-mono text-xs tabular">{layer.thicknessUm} µm</span>
                  <span className="hidden min-w-0 truncate text-xs sm:inline">{layer.role}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
