import { useState, type PointerEvent } from "react";
import { isBlackKey, midiName, NOTE_NAMES } from "@/lib/audio/notes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHearing } from "./hearing-context";

const START = 48;
const COUNT = 25;

function capture(e: PointerEvent<HTMLButtonElement>) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    /* synthetic / headless pointers have no capture */
  }
}

export function Keyboard() {
  const { playMidi, releaseMidi, held, last } = useHearing();
  const [oct, setOct] = useState(4);
  const liveMidi = last?.note?.midi;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-subtle">
          Membrane keys
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOct((o) => Math.max(2, o - 1))}
            aria-label="Lower octave"
          >
            −
          </Button>
          <span className="min-w-10 text-center font-mono text-xs tabular-nums text-muted">
            C{oct}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOct((o) => Math.min(6, o + 1))}
            aria-label="Raise octave"
          >
            +
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1.5 sm:hidden">
        {NOTE_NAMES.map((name, pc) => {
          const midi = (oct + 1) * 12 + pc;
          const on = held.includes(midi) || liveMidi === midi;
          return (
            <button
              key={name}
              type="button"
              data-testid={`key-${midi}`}
              className={cn(
                "h-12 rounded-sm font-mono text-xs transition-colors duration-150",
                on ? "bg-accent text-accent-fg" : "bg-raised text-muted",
              )}
              onPointerDown={(e) => {
                capture(e);
                playMidi(midi);
              }}
              onPointerUp={() => releaseMidi(midi)}
              onPointerCancel={() => releaseMidi(midi)}
            >
              {name}
            </button>
          );
        })}
      </div>

      <div className="relative hidden h-28 overflow-hidden rounded-md bg-raised sm:block">
        <div className="absolute inset-0 flex">
          {Array.from({ length: COUNT }, (_, i) => START + i)
            .filter((m) => !isBlackKey(m))
            .map((midi) => {
              const on = held.includes(midi) || liveMidi === midi;
              return (
                <button
                  key={midi}
                  type="button"
                  data-testid={`key-${midi}`}
                  className={cn(
                    "relative flex-1 border-r border-bg text-[0.625rem] font-mono text-subtle last:border-0",
                    on ? "bg-accent text-accent-fg" : "bg-fg/95 text-bg",
                  )}
                  onPointerDown={(e) => {
                    capture(e);
                    playMidi(midi);
                  }}
                  onPointerUp={() => releaseMidi(midi)}
                  onPointerCancel={() => releaseMidi(midi)}
                >
                  <span className="absolute inset-x-0 bottom-2">{midiName(midi)}</span>
                </button>
              );
            })}
        </div>
        <div className="pointer-events-none absolute inset-0 flex">
          {Array.from({ length: COUNT }, (_, i) => START + i)
            .filter((m) => !isBlackKey(m))
            .map((midi) => {
              const next = midi + 1;
              if (!isBlackKey(next) || next > START + COUNT - 1) {
                return <div key={`gap-${midi}`} className="relative flex-1" />;
              }
              const on = held.includes(next) || liveMidi === next;
              return (
                <div key={`gap-${midi}`} className="relative flex-1">
                  <button
                    type="button"
                    data-testid={`key-${next}`}
                    className={cn(
                      "pointer-events-auto absolute left-[68%] top-0 z-10 h-[58%] w-[64%] rounded-b-sm",
                      on ? "bg-accent" : "bg-bg",
                    )}
                    onPointerDown={(e) => {
                      capture(e);
                      playMidi(next);
                    }}
                    onPointerUp={() => releaseMidi(next)}
                    onPointerCancel={() => releaseMidi(next)}
                  />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
