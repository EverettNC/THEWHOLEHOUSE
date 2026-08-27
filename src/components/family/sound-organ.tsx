import { Download } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useHearing } from "@/components/corti/hearing-context";
import { OrganFrame } from "@/components/family/organ-frame";
import { Button } from "@/components/ui/button";
import { ringToSound } from "@/lib/sound/packet";
import { downloadText, formatClock } from "@/lib/utils";

export function SoundOrgan() {
  const { events } = useHearing();
  const cards = ringToSound(events);

  function download() {
    downloadText(
      "christman-sound-ingest.json",
      JSON.stringify({ family: "christman-sound", cards }, null, 2),
      "application/json",
    );
  }

  return (
    <OrganFrame active="sound">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="max-w-2xl">
          <p className="font-mono text-[0.6875rem] tracking-[0.22em] text-subtle uppercase">
            Christman-Sound
          </p>
          <h1 className="font-display mt-2 text-3xl italic text-fg">The canal</h1>
          <p className="mt-3 max-w-prose text-pretty text-sm text-muted">
            Corti is the ear. Sound consumes the card and the tape. Kind — grunt, tick,
            groan, hiss — stays on the Corti client. Null F0 is a hole, not a zero. The
            tape cap drops the tail.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={download} disabled={cards.length === 0}>
            <Download />
            Ingest JSON
          </Button>
        </div>

        {cards.length === 0 ? (
          <p className="rounded-2xl bg-surface p-5 text-sm text-muted shadow-border">
            No uttered card yet.{" "}
            <Link to="/hear" className="text-fg underline decoration-border underline-offset-4">
              Open Corti
            </Link>
            , press Listen, and let an utterance close. I will not invent a tape.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {cards.map((card, i) => (
              <li key={card.id} className="rounded-2xl bg-surface p-4 shadow-border sm:p-5">
                <p className="font-mono text-xs text-subtle uppercase">
                  Card {i + 1}
                  {card.truncated ? " · tail dropped" : ""}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs tabular-nums sm:grid-cols-4">
                  <div>
                    <dt className="text-subtle">Duration</dt>
                    <dd className="text-fg">{formatClock(card.durationMs / 1000)}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">F0</dt>
                    <dd className="text-fg">{card.f0 == null ? "—" : `${Math.round(card.f0)} Hz`}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Peak RMS</dt>
                    <dd className="text-fg">{card.peakRms.toFixed(3)}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">ZCR</dt>
                    <dd className="text-fg">{card.zcr.toFixed(3)}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">F1</dt>
                    <dd className="text-fg">{card.f1 ? `${Math.round(card.f1)}` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">F2</dt>
                    <dd className="text-fg">{card.f2 ? `${Math.round(card.f2)}` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Voiced</dt>
                    <dd className="text-fg">{card.voiced ? "yes" : "no"}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Tape</dt>
                    <dd className="text-fg">{card.tape.length} frames</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </main>
    </OrganFrame>
  );
}
