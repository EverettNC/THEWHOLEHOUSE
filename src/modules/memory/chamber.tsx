import { useEffect } from "react";
import { Flame, Moon, PenLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CHANNELS,
  CHANNEL_COPY,
  formatDuration,
  jobLabel,
  type Completeness,
  type Door,
} from "@/modules/memory/model";
import { useMemory } from "@/modules/memory/store";
import { startHouseListener } from "@/modules/memory/house";
import { Doors } from "./doors";
import { EncodeForm } from "./encode-form";
import { Spiral } from "./spiral";
import { cn } from "@/lib/utils";

const DOORS: { id: Door; label: string }[] = [
  { id: "any", label: "Any" },
  ...CHANNELS.map((c) => ({ id: c, label: CHANNEL_COPY[c].title })),
];

function CueBar() {
  const cue = useMemory((s) => s.cue);
  const door = useMemory((s) => s.door);
  const setCue = useMemory((s) => s.setCue);
  const setDoor = useMemory((s) => s.setDoor);
  const ask = useMemory((s) => s.ask);
  const lastSilence = useMemory((s) => s.lastSilence);

  return (
    <form
      className="bg-surface shadow-border flex flex-col gap-3 rounded-2xl p-3 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        ask();
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-muted text-xs font-medium tracking-wide uppercase">
          Cue
        </p>
        <p className="text-faint hidden text-xs sm:block">
          Enter through one door. The room comes back whole.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Door">
        {DOORS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDoor(d.id)}
            className={cn(
              "h-9 rounded-full px-3 text-xs font-medium transition-[background-color,color] duration-150 ease-out",
              door === d.id
                ? "bg-accent text-accent-fg"
                : "bg-raised text-muted shadow-border hover:text-fg",
            )}
            aria-pressed={door === d.id}
          >
            {d.label}
          </button>
        ))}
      </div>
      <Label htmlFor="cue" className="sr-only">
        Cue
      </Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Input
          id="cue"
          value={cue}
          onChange={(e) => setCue(e.target.value)}
          placeholder="crossbar · Peabody · fan · the building"
          autoComplete="off"
          className="sm:col-span-3"
        />
        <Button type="submit" className="sm:col-span-1">
          Complete
        </Button>
      </div>
      {lastSilence ? (
        <p className="text-muted text-sm leading-normal">{lastSilence}</p>
      ) : null}
    </form>
  );
}

const COMPLETE_ORDER: Array<keyof Completeness> = [
  "sight",
  "sound",
  "smell",
  "body",
  "place",
  "time",
];

function AthanorStrip() {
  const ambient = useMemory((s) => s.ambient);
  const openedAt = useMemory((s) => s.openedAt);
  const now = useMemory((s) => s.now);
  const last = ambient.slice(-4).reverse();
  const elapsed = openedAt === 0 ? 0 : Math.max(0, now - openedAt);
  const flags = last[0]?.completeness;

  return (
    <div className="bg-surface shadow-border rounded-2xl p-3 sm:p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-muted text-xs font-medium tracking-wide uppercase">
            Athanor
          </p>
          <p className="text-fg mt-0.5 text-sm">
            The building. Lucent sees. Corti hears — real sound. OpenSmell
            sniffs. Skin is haptic. Porch speaks. The family pulls from here.
          </p>
        </div>
        <p className="text-muted font-mono text-sm tabular-nums">
          {formatDuration(elapsed)}
        </p>
      </div>
      {flags ? (
        <p className="text-faint mb-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs tracking-wide uppercase">
          {COMPLETE_ORDER.map((k) => (
            <span key={k} className={flags[k] ? "text-fg" : "text-faint"}>
              {k} {flags[k] ? "in" : "—"}
            </span>
          ))}
        </p>
      ) : null}
      <ol className="flex flex-col gap-1.5 font-mono text-xs leading-relaxed">
        {last.length === 0 ? (
          <li className="text-faint">
            Building continues. Ear, eye, nose, and skin not on this origin yet.
          </li>
        ) : (
          last.map((tick) => (
            <li key={tick.t} className="text-muted">
              <span className="text-faint tabular-nums">
                {formatDuration(Math.max(0, tick.t - openedAt))}
              </span>
              <span className="text-fg ml-3">{tick.text}</span>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}

function Returned() {
  const result = useMemory((s) => s.lastCompletion);
  const closeReturned = useMemory((s) => s.closeReturned);
  if (!result) return null;
  const { scene, doors } = result;
  const date = new Date(scene.writtenAt);

  return (
    <div className="bg-surface shadow-border flex flex-col gap-4 rounded-2xl p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted text-xs font-medium tracking-wide uppercase">
            Returned room
          </p>
          <h2 className="text-fg mt-1 text-xl font-medium tracking-tight text-balance">
            {scene.title}
          </h2>
          <p className="text-faint mt-1 font-mono text-xs tabular-nums">
            {date.toUTCString()} · {scene.claim === "living" ? "true as of" : "record"} ·{" "}
            {jobLabel(scene.job)}
          </p>
        </div>
        <Button variant="ghost" onClick={closeReturned}>
          <RotateCcw />
          Back to the building
        </Button>
      </div>
      <Doors channels={scene.channels} active={doors} />
    </div>
  );
}

export function Chamber() {
  const hydrate = useMemory((s) => s.hydrate);
  const hydrated = useMemory((s) => s.hydrated);
  const tick = useMemory((s) => s.tick);
  const mode = useMemory((s) => s.mode);
  const scenes = useMemory((s) => s.scenes);
  const lastCompletion = useMemory((s) => s.lastCompletion);
  const openWrite = useMemory((s) => s.openWrite);
  const openScene = useMemory((s) => s.openScene);
  const runNight = useMemory((s) => s.runNight);
  const nightLog = useMemory((s) => s.nightLog);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => startHouseListener(), []);

  useEffect(() => {
    if (!hydrated) return;
    tick(Date.now());
    const id = window.setInterval(() => tick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hydrated, tick]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("cue")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="bg-bg text-fg">
      <header className="border-line border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="bg-raised shadow-border flex size-9 items-center justify-center rounded-md">
              <Flame className="size-4" strokeWidth={1.6} />
            </span>
            <div>
              <p className="text-faint font-mono text-xs tracking-widest uppercase">
                Conch Memory · TCAP-2026-001
              </p>
              <h1 className="text-fg text-lg leading-tight font-medium tracking-tight">
                Dispersal model
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Athanor holding</Badge>
            <Badge variant="high">
              {scenes.filter((s) => s.job !== "throwaway").length} rooms
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-4 pb-20 sm:px-6 sm:py-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Spiral
            scenes={scenes}
            activeId={lastCompletion?.scene.id}
            onOpen={openScene}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-3">
          <AthanorStrip />

          {mode === "returned" ? <Returned /> : null}

          {mode === "write" ? (
            <section className="bg-surface shadow-border rounded-2xl p-3 sm:p-4">
              <EncodeForm />
            </section>
          ) : (
            <>
              <CueBar />
              {mode === "chamber" ? (
                <section className="bg-surface shadow-border rounded-2xl p-3 sm:p-4">
                  <p className="text-muted text-xs font-medium tracking-wide uppercase">
                    The building is the fifth
                  </p>
                  <p className="text-fg mt-2 max-w-prose text-sm leading-normal text-pretty">
                    Four streams are doors. The fifth is the room they were
                    recorded in. Attention selects a target. Memory keeps the
                    building. Lived truth: no cue match is silence. Ancillary
                    bullshit of the day falls off the lip. Try{" "}
                    <span className="text-muted">crossbar</span>,{" "}
                    <span className="text-muted">Peabody</span>, or{" "}
                    <span className="text-muted">fan</span>.
                  </p>
                </section>
              ) : null}
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={openWrite}
              disabled={mode === "write"}
            >
              <PenLine />
              Write a room
            </Button>
            <Button variant="outline" onClick={runNight}>
              <Moon />
              Night — REM
            </Button>
          </div>
          {nightLog ? (
            <p className="text-muted font-mono text-xs">{nightLog}</p>
          ) : null}

          <p className="text-faint max-w-prose text-xs leading-relaxed text-pretty">
            Encoding grows from the top lip. Level 1 throws the day out. Level 2
            is the operational manual — 94.7% compression. Level 3 is the impact
            write, TCAP-V-0016, where something leaves homeostasis. Level 4 is
            REM. Capture inclusively. Retain by departure. The fifth stream is
            the building, always on. Columbus, Ohio.
          </p>

          <figure className="mt-4 max-w-4xl">
            <img
              src="/house/conch.jpg"
              alt="The Christman AI Project. Conch Memory Dispersal Model. Ancillary bullshit of the day falls off the lip. Five elements leave the mouth: sight, sound, smell, body, building."
              width={1920}
              height={1080}
              className="w-full rounded-sm shadow-border"
            />
            <figcaption className="mt-3 font-mono text-[0.625rem] tracking-[0.18em] text-subtle uppercase">
              Conch Memory · TCAP-2026-001 · Validated protocol · Columbus, Ohio
            </figcaption>
          </figure>
        </div>
      </main>
    </div>
  );
}
