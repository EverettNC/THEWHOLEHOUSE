import { Mic, MicOff, Power } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CochleaCanvas } from "./cochlea-canvas";
import { Keyboard } from "./keyboard";
import { Readout } from "./readout";
import { Spectrogram } from "./spectrogram";
import { TonePanel } from "./tone-panel";
import { TrainPanel } from "./train-panel";
import { useHearing, type Mode } from "./hearing-context";

const MODES: { id: Mode; label: string }[] = [
  { id: "listen", label: "Listen" },
  { id: "tone", label: "Tone" },
  { id: "train", label: "Train" },
];

export function AppShell() {
  const {
    opened,
    opening,
    open,
    mic,
    startMic,
    stopMic,
    mode,
    setMode,
    error,
    framed,
  } = useHearing();

  return (
    <div className="relative overflow-x-hidden bg-bg text-fg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <header className="relative z-10 flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.32em] text-subtle">
            Christman · organ of corti
          </p>
          <h1 className="mt-1 font-sans text-xl font-light tracking-[0.28em] text-fg">
            CORTI
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                data-testid={`mode-${m.id}`}
                onClick={() => setMode(m.id)}
                className={cn(
                  "h-9 rounded-sm px-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-colors duration-150",
                  mode === m.id ? "bg-raised text-fg" : "text-subtle hover:text-fg",
                )}
              >
                {m.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-28 sm:px-6 lg:pb-10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-start">
          <div className="flex flex-col items-center rounded-xl bg-surface p-3 shadow-[var(--shadow-border)] sm:p-5">
            <CochleaCanvas />
            <div className="mt-3 flex w-full flex-wrap items-center justify-center gap-2">
              {!opened ? (
                <Button
                  type="button"
                  onClick={() => void open()}
                  disabled={opening}
                  data-testid="open-cochlea"
                >
                  <Power className="size-4" />
                  {opening ? "Opening…" : "Open the cochlea"}
                </Button>
              ) : mic === "on" ? (
                <Button type="button" variant="outline" onClick={stopMic} data-testid="start-mic">
                  <MicOff className="size-4" />
                  Close mic
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void startMic()}
                  disabled={mic === "pending"}
                  data-testid="start-mic"
                >
                  <Mic className="size-4" />
                  {mic === "pending" ? "Requesting…" : "Listen"}
                </Button>
              )}
            </div>
            {error && (
              <p className="mt-3 max-w-md text-center text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            {framed && mic !== "on" && (
              <p className="mt-2 max-w-md text-center text-sm text-muted">
                This preview frame cannot open a microphone.{" "}
                <a
                  href={typeof window !== "undefined" ? window.location.href : "/"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-fg underline decoration-border underline-offset-4"
                >
                  Open Corti in its own window
                </a>
                , then press Listen. The keyboard still hears itself here.
              </p>
            )}
            {mic === "denied" && !framed && (
              <p className="mt-2 max-w-md text-center text-sm text-muted">
                The microphone is closed. Tone and train still work. I will not invent a room.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-5">
            {mode === "train" ? (
              <TrainPanel />
            ) : mode === "tone" ? (
              <TonePanel />
            ) : (
              <Readout />
            )}
          </div>
        </div>

        {mode !== "train" && <Spectrogram />}
        <Keyboard />

        <footer className="border-t border-border pt-5 pb-2 text-xs leading-relaxed text-subtle">
          Corti is the silicon cochlea of The Christman AI Project. Sister to
          OpenSmell. christman_dsp.c runs here — RMS, ZCR, YIN, LPC. It will
          not name a pitch it did not lock, and it will not wear a percentage
          it did not measure. Kind stays on this client. The canal is{" "}
          <Link to="/sound" className="text-fg underline decoration-border underline-offset-4">
            Christman-Sound
          </Link>
          .
        </footer>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 gap-1 border-t border-border bg-bg/95 px-2 py-2 backdrop-blur-sm sm:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        aria-label="Mode"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={cn(
              "h-11 rounded-sm font-mono text-[0.6875rem] uppercase tracking-[0.14em]",
              mode === m.id ? "bg-raised text-fg" : "text-subtle",
            )}
          >
            {m.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
