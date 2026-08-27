import { useSmell } from "@/lib/smell/store";
import { LIVE_PROFILE_COUNT } from "@/lib/smell/profiles";
import { cn } from "@/lib/utils";

export function ProfileRail() {
  const { history, activeId } = useSmell();
  const take = history.find((t) => t.id === activeId) ?? history[0] ?? null;

  if (!take) {
    return (
      <section className="rounded-2xl bg-surface p-5 shadow-border">
        <h2 className="font-display text-2xl italic">Profiles</h2>
        <p className="mt-3 text-sm text-muted">
          {LIVE_PROFILE_COUNT} live. Proxy labels, not GC-MS. Nothing named until a reading is here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-border">
      <h2 className="font-display text-2xl italic">Profiles</h2>
      {take.reading.claim === "simulation" ? (
        <p className="mt-2 text-sm text-muted">simulation / synthetic — not clinical accuracy.</p>
      ) : null}
      {take.scalarOnly ? (
        <p className="mt-3 text-sm text-muted">One voltage. I will not name benzene.</p>
      ) : take.hits.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No profile above threshold. Screening-support, not a diagnosis.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3" data-testid="smell-hits">
          {take.hits.map((hit) => (
            <li key={hit.profileKey} className="rounded-lg bg-raised p-3 shadow-border">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-fg">{hit.condition}</p>
                <p className={cn("font-mono text-xs tabular-nums", hit.alert ? "text-fg" : "text-muted")}>
                  {hit.confidence.toFixed(2)}
                  {hit.alert ? " · alert" : ""}
                </p>
              </div>
              <p className="mt-1 font-mono text-[0.625rem] tracking-[0.14em] text-subtle uppercase">
                {hit.category} · proxy
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs leading-relaxed text-subtle">{take.honesty.rule}</p>
    </section>
  );
}
