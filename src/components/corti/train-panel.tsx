import { useEffect, useMemo, useState } from "react";
import { NOTE_NAMES, midiName } from "@/lib/audio/notes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHearing } from "./hearing-context";
import type { CalibSample } from "@/lib/audio/corpus";

const STATS_KEY = "corti-train-stats";

type Stats = { rounds: number; hits: number; streak: number; best: number };

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { rounds: 0, hits: 0, streak: 0, best: 0 };
    const parsed = JSON.parse(raw) as Stats;
    return {
      rounds: Number(parsed.rounds) || 0,
      hits: Number(parsed.hits) || 0,
      streak: Number(parsed.streak) || 0,
      best: Number(parsed.best) || 0,
    };
  } catch {
    return { rounds: 0, hits: 0, streak: 0, best: 0 };
  }
}

function saveStats(s: Stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

function downloadCorpus(samples: CalibSample[]) {
  const blob = new Blob(
    [JSON.stringify({ kind: "corti-calib", version: 1, samples }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `corti-calib-${new Date().toISOString().slice(0, 19)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function centsLabel(cents: number | null, locked: boolean) {
  if (!locked || cents == null) return "no lock";
  const n = Math.round(cents);
  return `${n > 0 ? "+" : ""}${n}¢`;
}

export function TrainPanel() {
  const { opened, open, playMidi, setBlind, corpus, corpusSummary, clearCorpus } =
    useHearing();
  const [target, setTarget] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats>(() =>
    typeof window === "undefined" ? { rounds: 0, hits: 0, streak: 0, best: 0 } : loadStats(),
  );

  const targetName = target == null ? null : NOTE_NAMES[target];

  useEffect(() => {
    setBlind(target != null && !revealed);
    return () => setBlind(false);
  }, [target, revealed, setBlind]);

  const playTarget = (pc: number) => {
    const octave = 4 + Math.floor(Math.random() * 2);
    const midi = (octave + 1) * 12 + pc;
    playMidi(midi, { duration: 0.85 });
  };

  const nextRound = () => {
    const pc = Math.floor(Math.random() * 12);
    setTarget(pc);
    setRevealed(false);
    setChoice(null);
    if (!opened) {
      void open().then(() => playTarget(pc));
    } else {
      playTarget(pc);
    }
  };

  const guess = (pc: number) => {
    if (target == null || revealed) return;
    setChoice(pc);
    setRevealed(true);
    const hit = pc === target;
    setStats((prev) => {
      const next: Stats = {
        rounds: prev.rounds + 1,
        hits: prev.hits + (hit ? 1 : 0),
        streak: hit ? prev.streak + 1 : 0,
        best: hit ? Math.max(prev.best, prev.streak + 1) : prev.best,
      };
      saveStats(next);
      return next;
    });
    playTarget(target);
  };

  const acc = useMemo(
    () => (stats.rounds === 0 ? 0 : Math.round((stats.hits / stats.rounds) * 100)),
    [stats],
  );

  return (
    <section className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-[var(--shadow-border)]">
      <header className="flex items-center justify-between gap-3">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-subtle">
          Absolute drill
        </p>
        <p className="font-mono text-xs tabular-nums text-muted">
          {acc}% · {stats.streak} streak · best {stats.best}
        </p>
      </header>

      <p className="text-sm leading-relaxed text-muted">
        Hear a tone. Name the pitch class. The spiral and spectrogram stay
        blind until you guess. No reference is given. That is the point.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={nextRound} data-testid="train-next">
          {target == null ? "Hear a tone" : "Next tone"}
        </Button>
        {target != null && (
          <Button type="button" variant="outline" onClick={() => playTarget(target)}>
            Repeat
          </Button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {NOTE_NAMES.map((name, pc) => {
          const show = revealed && target != null;
          const correct = show && pc === target;
          const wrong = show && pc === choice && pc !== target;
          return (
            <button
              key={name}
              type="button"
              data-testid={`train-pc-${pc}`}
              disabled={target == null}
              onClick={() => guess(pc)}
              className={cn(
                "h-11 rounded-sm font-mono text-xs transition-colors duration-150 disabled:opacity-40",
                correct && "bg-in-tune text-accent-fg",
                wrong && "bg-danger/80 text-fg",
                !correct && !wrong && "bg-raised text-muted hover:text-fg",
              )}
            >
              {name}
            </button>
          );
        })}
      </div>

      {revealed && targetName && (
        <p className="font-mono text-sm text-fg" data-testid="train-reveal">
          It was {targetName}
          {choice === target ? "." : `. You said ${NOTE_NAMES[choice ?? 0]}.`}
        </p>
      )}

      <div className="border-t border-border pt-4" data-testid="train-corpus">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-subtle">
            Ear log
          </p>
          <p className="font-mono text-xs tabular-nums text-muted">
            {corpusSummary.n === 0
              ? "empty"
              : `${corpusSummary.locked}/${corpusSummary.n} locked${
                  corpusSummary.medianAbsCents != null
                    ? ` · |¢| ${corpusSummary.medianAbsCents.toFixed(1)}`
                    : ""
                }`}
          </p>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Every played tone writes what Corti locked against the known Hertz.
          One lock is not a reading. Oscillator, not a speaker.
        </p>
        {corpus.length === 0 ? (
          <p className="mt-3 text-sm text-subtle">
            No trials yet. Hear a tone — the row appears when it ends.
          </p>
        ) : (
          <ul className="mt-3 flex max-h-56 flex-col gap-1 overflow-y-auto">
            {corpus.slice(0, 16).map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-2 font-mono text-[0.6875rem]"
              >
                <span className="text-fg">{midiName(s.midi)}</span>
                <span className="tabular-nums text-muted">
                  {s.expectedHz.toFixed(1)} Hz
                  {s.measuredHz != null
                    ? ` → ${s.measuredHz.toFixed(1)}`
                    : " → —"}
                </span>
                <span
                  className={cn(
                    "tabular-nums",
                    s.locked ? "text-fg" : "text-subtle",
                  )}
                >
                  {centsLabel(s.cents, s.locked)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={corpus.length === 0}
            onClick={() => downloadCorpus(corpus)}
          >
            Download log
          </Button>
          {corpus.length > 0 && (
            <Button type="button" variant="ghost" onClick={clearCorpus}>
              Clear log
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
