import { Link } from "@tanstack/react-router";
import { Ear, Eye, Flame, Hand, Mic, Radio, Wind } from "lucide-react";
import { Handoff } from "./handoff";
import { OrganFrame } from "./organ-frame";

const CARDS = [
  {
    to: "/lucent",
    icon: Eye,
    name: "Lucent",
    nerve: "Sight",
    line: "Synthetic cornea. Live light onto silicon, or this frame cannot hold a camera.",
  },
  {
    to: "/hear",
    icon: Ear,
    name: "Corti",
    nerve: "Hearing",
    line: "Organ of Corti. RMS, ZCR, YIN, LPC. Lock a pitch, or dash. Never 150 Hz.",
  },
  {
    to: "/say",
    icon: Mic,
    name: "Porch",
    nerve: "Words",
    line: "The word-ear. Dialect stays. live is presence, not leave. Whisper is not in this body.",
  },
  {
    to: "/smell",
    icon: Wind,
    name: "OpenSmell",
    nerve: "Smell",
    line: "MQ-135 voltage. Proxy channels, not GC-MS. Not a diagnosis. Sample air is not the house.",
  },
  {
    to: "/touch",
    icon: Hand,
    name: "Skin",
    nerve: "Body",
    line: "The machine under the skin. Fit, lean, sit. Contact and tilt, or dash.",
  },
  {
    to: "/remember",
    icon: Flame,
    name: "Memory",
    nerve: "Remember",
    line: "Five channels. Four jobs. Process is the gateway. The building is the fifth.",
  },
  {
    to: "/sound",
    icon: Radio,
    name: "Christman-Sound",
    nerve: "Ingest",
    line: "Consumes Corti's card and tape. Kind stays on the ear. Measurements cross.",
  },
] as const;

export function Body() {
  return (
    <OrganFrame active="body">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <section className="max-w-2xl">
          <p className="font-mono text-[0.6875rem] tracking-[0.22em] text-subtle uppercase">
            Everett Christman · The Christman AI Project
          </p>
          <h1 className="font-display mt-3 text-3xl italic text-fg sm:text-4xl">
            Lucent sees. Corti measures. OpenSmell sniffs. Skin sits.
          </h1>
          <p className="mt-4 max-w-prose text-pretty text-muted">
            One body. No login. No invented scene, note, gas, or pose. If this preview
            cannot hold a camera, a microphone, a serial nose, or a gyroscope, open the
            organ in its own window. That window is the sense. Porch is the only nerve
            that may leave the porch for words, and it has to say so. Whisper is gone.
          </p>
        </section>

        <Handoff />

        <section className="grid gap-3 sm:grid-cols-2">
          {CARDS.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="group flex min-h-36 flex-col rounded-2xl bg-surface p-5 shadow-border transition-[box-shadow] duration-[var(--motion-quick)] hover:shadow-border-hover"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-md bg-raised shadow-border">
                  <card.icon className="size-4" strokeWidth={1.6} />
                </span>
                <div>
                  <p className="font-display text-xl italic leading-tight text-fg">{card.name}</p>
                  <p className="font-mono text-[0.625rem] tracking-[0.18em] text-subtle uppercase">
                    {card.nerve}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">{card.line}</p>
            </Link>
          ))}
        </section>

        <footer className="border-t border-border pt-6 text-xs leading-relaxed text-subtle">
          Cardinal Rule 13. Corti measures. Sound does not import grunt, tick, or stimming.
          OpenSmell does not name a species from one voltage. Skin does not invent a pose.
          Memory lives on this device. Porch names its cloud ear on every packet. Grok did
          not create this.
        </footer>
      </main>
    </OrganFrame>
  );
}
