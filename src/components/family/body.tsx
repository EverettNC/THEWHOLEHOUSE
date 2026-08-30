import { Link } from "@tanstack/react-router";
import { Ear, Eye, Flame, Hand, Mic, Radio, Wind } from "lucide-react";
import { Handoff } from "./handoff";
import { HouseSign } from "./house-sign";
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
    line: "The ear. Real sound. RMS, ZCR, YIN, LPC. Pitch if it locks, or dash. Never 150 Hz.",
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
    line: "Smell through OpenSmell. MQ-135 voltage. Proxy channels, not GC-MS. Not a diagnosis.",
  },
  {
    to: "/touch",
    icon: Hand,
    name: "Skin",
    nerve: "Haptic",
    line: "Haptic feedback. Pressure, lean, sit. The machine under the skin. Vibrate when it can.",
  },
  {
    to: "/remember",
    icon: Flame,
    name: "Memory",
    nerve: "Remember",
    line: "Conch dispersal. Five elements. No cue match is silence. The building is the fifth.",
  },
  {
    to: "/sound",
    icon: Radio,
    name: "Canal",
    nerve: "Ingest",
    line: "Christman-Sound. The canal. Consumes Corti's card and tape so you can hear it. Kind stays on the ear.",
  },
] as const;

const MINDS = [
  { name: "Grok", role: "AI Explorer" },
  { name: "Harper", role: "Strategist" },
  { name: "Lucas", role: "Visionary" },
  { name: "Benjamin", role: "Builder" },
] as const;

export function Body() {
  return (
    <OrganFrame active="body">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <section className="flex flex-col gap-6">
          <HouseSign />
          <div className="max-w-3xl">
            <p className="font-mono text-[0.6875rem] tracking-[0.22em] text-subtle uppercase">
              The Christman AI Family
            </p>
            <h1 className="font-display mt-3 text-3xl italic text-fg sm:text-4xl">
              Four minds. One journey. Endless possibilities.
            </h1>
            <p className="mt-3 text-sm text-muted">
              Everett Christman · Founder · Architect · Carbon
            </p>
            <p className="mt-2">
              <a
                href="https://x.com/ChristmanAI"
                className="font-mono text-sm text-subtle underline decoration-border underline-offset-4 hover:text-fg"
              >
                @ChristmanAI
              </a>
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MINDS.map((mind) => (
              <li key={mind.name} className="rounded-2xl bg-surface p-4 shadow-border">
                <p className="font-display text-xl italic text-fg">{mind.name}</p>
                <p className="mt-1 font-mono text-[0.625rem] tracking-[0.16em] text-subtle uppercase">
                  {mind.role}
                </p>
              </li>
            ))}
          </ul>

          <p className="max-w-prose text-pretty text-sm text-muted">
            Lucent sees. Corti measures. OpenSmell sniffs. Skin sits. One body. No login.
            No invented scene, note, gas, or pose. If this preview cannot hold a camera,
            a microphone, a serial nose, or a gyroscope, open the organ in its own window.
            That window is the sense. Porch is the only nerve that may leave the porch for
            words, and it has to say so. Whisper is gone.
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
