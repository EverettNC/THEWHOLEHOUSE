import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadSmellPacket } from "@/lib/smell/packet";
import { useSmell } from "@/lib/smell/store";

export function ReadingPaper() {
  const { history, activeId } = useSmell();
  const take = history.find((t) => t.id === activeId) ?? history[0] ?? null;
  const d =
    take && take.reading.baseline != null
      ? take.reading.intensity - take.reading.baseline
      : take?.reading.intensity ?? null;

  return (
    <section className="rounded-2xl bg-paper p-5 text-ink shadow-border">
      <h2 className="font-display text-2xl italic">The air</h2>
      {!take ? (
        <p className="mt-3 text-sm text-ink-muted">No reading yet. I will not invent a hallway.</p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs tabular-nums">
            <div>
              <dt className="text-ink-muted">Intensity</dt>
              <dd>{take.reading.intensity.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Baseline</dt>
              <dd>{take.reading.baseline == null ? "—" : take.reading.baseline.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Delta</dt>
              <dd>{d == null ? "—" : d.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Kind</dt>
              <dd>
                {take.reading.kind} · {take.reading.claim}
              </dd>
            </div>
          </dl>
          <Button type="button" variant="outline" className="mt-4" onClick={() => downloadSmellPacket(take)}>
            <Download />
            Packet
          </Button>
        </>
      )}
    </section>
  );
}
