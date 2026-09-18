import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useHearing } from "@/components/corti/hearing-context";
import { CanalStage, TapeStrip } from "@/components/family/canal-stage";
import { OrganFrame } from "@/components/family/organ-frame";
import { Button } from "@/components/ui/button";
import type { CanalRecord } from "@/lib/sound/canal";
import { ringToSound, type SoundCard } from "@/lib/sound/packet";
import { downloadText } from "@/lib/utils";

type CanalBody = {
  measured?: boolean;
  card?: SoundCard | null;
  tape?: CanalRecord | null;
};

export function SoundOrgan() {
  const { events } = useHearing();
  const liveCards = ringToSound(events);
  const [rackCard, setRackCard] = useState<SoundCard | null>(null);
  const [archive, setArchive] = useState<CanalRecord | null>(null);
  const cards = liveCards.length > 0 ? liveCards : rackCard ? [rackCard] : [];
  const lastPosted = useRef<number | null>(null);

  useEffect(() => {
    let live = true;
    const pull = () => {
      void fetch("/api/sound/latest")
        .then((res) => (res.ok ? res.json() : null))
        .then((body: CanalBody | null) => {
          if (!live || !body) return;
          if (body.tape && body.tape.frameCount > 0) setArchive(body.tape);
          if (body.card) setRackCard(body.card);
        })
        .catch(() => {
          /* Absence is not a tape. */
        });
    };
    pull();
    const id = window.setInterval(pull, 1000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const card = liveCards[liveCards.length - 1];
    if (!card || card.id === lastPosted.current) return;
    lastPosted.current = card.id;
    void fetch("/api/sound/latest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    }).catch(() => {
      /* Brockston pulls the canal. An empty canal stays empty. */
    });
  }, [liveCards]);

  function download() {
    downloadText(
      "christman-sound-ingest.json",
      JSON.stringify({ family: "christman-sound", tape: archive, cards }, null, 2),
      "application/json",
    );
  }

  return (
    <OrganFrame active="sound">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
        <section className="max-w-2xl">
          <p className="font-mono text-[0.6875rem] tracking-[0.22em] text-subtle uppercase">
            Christman-Sound
          </p>
          <h1 className="font-display mt-2 text-3xl italic text-fg">The canal</h1>
          <p className="mt-3 max-w-prose text-pretty text-sm text-muted">
            Corti is the ear. The canal keeps the measured signal while Listen is
            on — RMS, ZCR, F0. Kind — grunt, tick, groan, hiss — stays on the Corti
            client. Null F0 is a hole, not a zero. Cards are closed utterances on
            top of the tape.
          </p>
        </section>

        <CanalStage cards={cards} archive={archive} />

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link to="/hear">Open Corti</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={download}
            disabled={cards.length === 0 && !(archive && archive.frameCount > 0)}
          >
            <Download />
            Ingest JSON
          </Button>
        </div>

        {cards.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {cards.map((card, i) => (
              <TapeStrip key={card.id} card={card} index={i} />
            ))}
          </ul>
        ) : null}

        <figure className="mx-auto w-full max-w-3xl">
          <img
            src="/house/opus.jpg"
            alt="Opus. Written in light across the dark."
            width={1600}
            height={874}
            className="w-full rounded-sm shadow-border"
          />
          <figcaption className="mt-3 font-display text-xl italic text-fg">
            collaboration is the future
          </figcaption>
        </figure>
      </main>
    </OrganFrame>
  );
}
