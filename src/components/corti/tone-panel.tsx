import { A4_PRESETS } from "@/lib/audio/notes";
import type { Waveform } from "@/lib/audio/engine";
import { MIN_VOICED_TO_SEAT } from "@/lib/audio/speaker";
import type { VocalEvent } from "@/lib/audio/vocalization";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useHearing } from "./hearing-context";

const WAVES: Waveform[] = ["sine", "triangle", "square", "sawtooth"];

function Meter({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="mb-1.5 flex justify-between font-mono text-[0.625rem] uppercase tracking-wider text-subtle">
        <span>{label}</span>
        <span className="tabular-nums text-muted">
          {unit ?? `${pct}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full bg-accent transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function hz(n: number) {
  return n > 0 ? `${Math.round(n)}` : "—";
}

function EventRow({ ev }: { ev: VocalEvent }) {
  const locked = ev.tape.filter((f) => f.f0 != null).length;
  return (
    <li className="grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-2 font-mono text-[0.6875rem]">
      <span className="uppercase tracking-wider text-fg">{ev.kind}</span>
      <span className="tabular-nums text-muted">
        {Math.round(ev.durationMs)} ms · {ev.tape.length} frames · {locked} locked · F0{" "}
        {ev.f0 ? Math.round(ev.f0) : "—"}
      </span>
      <span className="tabular-nums text-subtle">{ev.peakRms.toFixed(2)}</span>
    </li>
  );
}

export function TonePanel() {
  const {
    last,
    events,
    lastVs,
    seat,
    voicedForSeat,
    restRms,
    liveVocalMs,
    a4,
    setA4,
    waveform,
    setWaveform,
    volume,
    setVolume,
    seatVoice,
    clearVoice,
    corpusSummary,
  } = useHearing();
  const p = last?.proxies;
  const live = last && last.rms > 0.008;

  return (
    <section className="flex flex-col gap-5 rounded-lg bg-surface p-5 shadow-[var(--shadow-border)]">
      <header data-testid="dsp-panel">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-subtle">
          christman_dsp.c
        </p>
        <p className="mt-1 text-sm text-muted">
          Four functions, first time they actually run.
        </p>
      </header>

      <div className="grid gap-3">
        <Meter
          label="Arousal · rms"
          value={p?.arousal ?? 0}
          unit={live ? (p?.arousal ?? 0).toFixed(2) : "—"}
        />
        <Meter
          label="Smoothness · zcr"
          value={p?.smoothness ?? 0}
          unit={live ? (p?.smoothness ?? 0).toFixed(2) : "—"}
        />
      </div>

      <dl className="grid grid-cols-3 gap-3 font-mono text-xs">
        <div>
          <dt className="text-subtle">F1</dt>
          <dd className="mt-0.5 tabular-nums text-fg">
            {live ? hz(p?.formants.f1 ?? 0) : "—"}
            {live && (p?.formants.f1 ?? 0) > 0 ? " Hz" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">F2</dt>
          <dd className="mt-0.5 tabular-nums text-fg">
            {live ? hz(p?.formants.f2 ?? 0) : "—"}
            {live && (p?.formants.f2 ?? 0) > 0 ? " Hz" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">F3</dt>
          <dd className="mt-0.5 tabular-nums text-fg">
            {live ? hz(p?.formants.f3 ?? 0) : "—"}
            {live && (p?.formants.f3 ?? 0) > 0 ? " Hz" : ""}
          </dd>
        </div>
      </dl>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-subtle">
            VAD · dsp
          </p>
          <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">
            {p?.vad?.status ?? "NO_VECTOR"}
          </span>
        </div>
        <dl className="grid grid-cols-3 gap-3 font-mono text-xs">
          <div>
            <dt className="text-subtle">V</dt>
            <dd className="mt-0.5 tabular-nums text-fg">
              {p?.vad ? p.vad.valence.toFixed(2) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">A</dt>
            <dd className="mt-0.5 tabular-nums text-fg">
              {p?.vad ? p.vad.arousal.toFixed(2) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">D</dt>
            <dd className="mt-0.5 tabular-nums text-fg">
              {p?.vad ? p.vad.dominance.toFixed(2) : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-subtle">
          Valence = inverse ZCR. Arousal / dominance = RMS. Not Riley’s
          Linear(1024, 3). Silence is no vector — not 0.5, not dissociation.
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-3 font-mono text-xs">
        <div>
          <dt className="text-subtle">Jitter</dt>
          <dd className="mt-0.5 tabular-nums text-fg">
            {p?.quality ? `${(p.quality.jitter * 100).toFixed(2)}%` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">Shimmer</dt>
          <dd className="mt-0.5 tabular-nums text-fg">
            {p?.quality ? `${(p.quality.shimmer * 100).toFixed(2)}%` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">HNR</dt>
          <dd className="mt-0.5 tabular-nums text-fg">
            {p?.quality?.hnrDb != null ? `${p.quality.hnrDb.toFixed(1)} dB` : "—"}
          </dd>
        </div>
      </dl>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-subtle">
            Vocalizations
          </p>
          {liveVocalMs > 40 && (
            <span className="font-mono text-[0.625rem] tabular-nums text-muted">
              open {Math.round(liveVocalMs)} ms
            </span>
          )}
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-subtle">
            Hum, grunt, or play a key. Kind is a duration bin — not pain, not
            annoyance, not a being.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {events.map((ev) => (
              <EventRow key={ev.id} ev={ev} />
            ))}
          </ul>
        )}
      </div>

      <div data-testid="speaker-seat">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-subtle">
            Speaker
          </p>
          <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">
            {seat ? "SEATED" : "COLD"}
          </span>
        </div>
        {seat ? (
          <p className="font-mono text-xs tabular-nums text-fg">
            F0 {Math.round(seat.f0Median)} Hz · {seat.samples} voiced · rest{" "}
            {seat.restRms.toFixed(3)}
          </p>
        ) : (
          <p className="text-sm text-muted">
            Every utterance arrives cold. Seat after {MIN_VOICED_TO_SEAT} voiced
            events. I will not infer a voice from one grunt.
          </p>
        )}
        {lastVs && (
          <p className="mt-1 font-mono text-xs tabular-nums text-muted" data-testid="vs-seat">
            last {lastVs.status}
            {lastVs.f0DeltaHz != null
              ? ` · ΔF0 ${lastVs.f0DeltaHz >= 0 ? "+" : ""}${Math.round(lastVs.f0DeltaHz)} Hz`
              : ""}
            {lastVs.rmsRatio != null ? ` · RMS ×${lastVs.rmsRatio.toFixed(1)}` : ""}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            data-testid="seat-voice"
            onClick={() => void seatVoice()}
            disabled={voicedForSeat < MIN_VOICED_TO_SEAT}
          >
            Seat this voice ({voicedForSeat}/{MIN_VOICED_TO_SEAT})
          </Button>
          {seat && (
            <Button type="button" variant="ghost" onClick={clearVoice}>
              Clear seat
            </Button>
          )}
        </div>
        <p className="mt-2 font-mono text-[0.625rem] tabular-nums text-subtle">
          room rest {restRms > 0 ? restRms.toFixed(4) : "—"}
          {corpusSummary.n > 0
            ? ` · ear log ${corpusSummary.locked}/${corpusSummary.n}`
            : ""}
        </p>
      </div>

      <p className="rounded-sm bg-raised px-3 py-2 text-xs leading-relaxed text-muted">
        Jitter, shimmer, HNR — the physics ToneScore named, then stubbed as
        0.05 / 88 / 22. I measure the cycles or I show a dash. I will not
        return 85 when librosa is missing. I will not print 0.4A + 0.35V +
        0.25×92. Quiet is not Inferno. Lipstick is not a qubit.
      </p>

      <div className="border-t border-border pt-4">
        <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-subtle">
          Reference oscillator
        </p>
        <div className="flex flex-wrap gap-1.5">
          {A4_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setA4(n)}
              className={cn(
                "h-9 rounded-sm px-3 font-mono text-xs tabular-nums",
                a4 === n ? "bg-accent text-accent-fg" : "bg-raised text-muted",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {WAVES.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWaveform(w)}
              className={cn(
                "h-9 rounded-sm px-3 font-mono text-xs capitalize",
                waveform === w ? "bg-accent text-accent-fg" : "bg-raised text-muted",
              )}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <div className="mb-2 flex justify-between font-mono text-[0.6875rem] uppercase tracking-wider text-subtle">
            <span>Level</span>
            <span className="tabular-nums">{Math.round(volume * 100)}</span>
          </div>
          <Slider
            min={0.02}
            max={0.5}
            step={0.01}
            value={[volume]}
            onValueChange={(v) => setVolume(v[0] ?? 0.22)}
          />
        </div>
      </div>
    </section>
  );
}
