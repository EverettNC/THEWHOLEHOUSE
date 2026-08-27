import { formatCents, formatHz } from "@/lib/audio/notes";
import { Badge } from "@/components/ui/badge";
import { useHearing } from "./hearing-context";

export function Readout() {
  const { last, mic, opened, a4 } = useHearing();
  const note = last?.note ?? null;
  const pitch = last?.pitch ?? null;
  const locked = Boolean(note && pitch && pitch.probability > 0.62);
  const cents = note?.cents ?? 0;
  const needle = Math.max(-50, Math.min(50, cents));
  const live = Boolean(last && last.rms > 0.006);
  const f = last?.proxies.formants;

  return (
    <section className="flex flex-col gap-5 rounded-lg bg-surface p-5 shadow-[var(--shadow-border)]">
      <header className="flex items-center justify-between gap-3">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-subtle">
          Absolute lock
        </p>
        <Badge variant={locked ? "lock" : mic === "on" ? "open" : "default"}>
          {locked ? "Locked" : mic === "on" ? "Listening" : opened ? "Idle" : "Closed"}
        </Badge>
      </header>

      <div>
        <p
          data-testid="note-name"
          className="font-sans text-6xl font-light leading-none tracking-tight text-fg tabular-nums sm:text-7xl"
        >
          {locked ? note!.name : "—"}
        </p>
        <p className="mt-2 font-mono text-sm text-muted tabular-nums">
          {locked ? `${formatHz(note!.freq)} Hz` : "No fundamental"}
        </p>
      </div>

      <div>
        <div className="relative h-8">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
          <div className="absolute left-1/2 top-1 h-6 w-px -translate-x-1/2 bg-accent/50" />
          <div
            className="absolute top-1 h-6 w-px bg-fg transition-transform duration-150 ease-out"
            style={{
              left: "50%",
              transform: `translateX(${needle}%)`,
            }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[0.625rem] uppercase tracking-wider text-subtle">
          <span>−50 ¢</span>
          <span className="tabular-nums text-muted">
            {locked ? `${formatCents(cents)} ¢` : "—"}
          </span>
          <span>+50 ¢</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-xs">
        <div>
          <dt className="text-subtle">Clarity</dt>
          <dd className="mt-0.5 tabular-nums text-fg">
            {pitch ? `${Math.round(pitch.probability * 100)}%` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">A4</dt>
          <dd className="mt-0.5 tabular-nums text-fg">{a4} Hz</dd>
        </div>
        <div>
          <dt className="text-subtle">F1 · LPC</dt>
          <dd className="mt-0.5 tabular-nums text-fg">
            {live && f && f.f1 > 0 ? `${Math.round(f.f1)} Hz` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">F2 · LPC</dt>
          <dd className="mt-0.5 tabular-nums text-fg">
            {live && f && f.f2 > 0 ? `${Math.round(f.f2)} Hz` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">Centroid</dt>
          <dd className="mt-0.5 tabular-nums text-fg">
            {live ? `${Math.round(last!.proxies.centroidHz)} Hz` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">Level</dt>
          <dd className="mt-0.5 tabular-nums text-fg">
            {last ? last.rms.toFixed(3) : "—"}
          </dd>
        </div>
      </dl>

      <div>
        <p className="mb-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-subtle">
          Partials
        </p>
        {last && last.partials.length > 0 && last.rms > 0.006 ? (
          <ul className="flex flex-wrap gap-1.5">
            {last.partials.map((p) => (
              <li
                key={p.bin}
                className="rounded-sm bg-raised px-2 py-1 font-mono text-[0.6875rem] tabular-nums text-muted"
              >
                {Math.round(p.freq)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-subtle">No spectral peaks above the floor.</p>
        )}
      </div>

      <p className="text-xs leading-relaxed text-subtle">
        F1/F2 are LPC peaks, not emotion. Centroid is a spectral proxy.
        Greenwood 1961 maps frequency to place. If there is no lock, there is
        no note.
      </p>
    </section>
  );
}
