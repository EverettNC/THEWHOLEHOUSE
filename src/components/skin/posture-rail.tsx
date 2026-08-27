import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadSkinPacket } from "@/lib/skin/packet";
import { useSkin } from "@/lib/skin/store";

export function PostureRail() {
  const { frame, takes, activeId } = useSkin();
  const take = takes.find((t) => t.id === activeId) ?? takes[0] ?? null;

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-border">
      <h2 className="font-display text-2xl italic">Fit · lean · sit</h2>
      <dl
        className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs tabular-nums"
        data-testid="skin-posture"
      >
        <div>
          <dt className="text-subtle">Contact</dt>
          <dd className="text-fg">{frame?.contacting ? "yes" : "—"}</dd>
        </div>
        <div>
          <dt className="text-subtle">Pressure</dt>
          <dd className="text-fg">{frame?.pressure == null ? "—" : frame.pressure.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-subtle">Beta</dt>
          <dd className="text-fg">{frame?.beta == null ? "—" : `${Math.round(frame.beta)}°`}</dd>
        </div>
        <div>
          <dt className="text-subtle">Gamma</dt>
          <dd className="text-fg">{frame?.gamma == null ? "—" : `${Math.round(frame.gamma)}°`}</dd>
        </div>
        <div>
          <dt className="text-subtle">Accel</dt>
          <dd className="text-fg">{frame?.accel == null ? "—" : frame.accel.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-subtle">Posture</dt>
          <dd className="text-fg">{frame?.posture ?? "—"}</dd>
        </div>
      </dl>
      {take ? (
        <Button type="button" variant="outline" className="mt-4" onClick={() => downloadSkinPacket(take)}>
          <Download />
          Packet
        </Button>
      ) : (
        <p className="mt-4 text-sm text-muted">No contact yet. I will not invent a pose.</p>
      )}
    </section>
  );
}
