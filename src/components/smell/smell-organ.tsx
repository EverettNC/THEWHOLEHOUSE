import { NoseStage } from "./nose-stage";
import { ProfileRail } from "./profile-rail";
import { ReadingPaper } from "./reading-paper";

export function SmellOrgan() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <section className="max-w-2xl">
        <p className="font-mono text-[0.6875rem] tracking-[0.22em] text-subtle uppercase">OpenSmell</p>
        <h1 className="font-display mt-2 text-3xl italic text-fg">The nose</h1>
        <p className="mt-3 max-w-prose text-pretty text-sm text-muted">
          One MQ-135 voltage. Smell through OpenSmell. The first breath. Channel
          names are proxy labels, not GC-MS. Not a diagnosis. Sample air is not
          the house. Live smell is serial, sniffing.
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <NoseStage />
        <div className="flex flex-col gap-4">
          <ReadingPaper />
          <ProfileRail />
        </div>
      </div>

      <figure className="mt-8 mb-2 max-w-lg">
        <img
          src="/house/opensmell.png"
          alt="OpenSmell. The First Breath. A new language for health. Built by Everett. Tested by Claude."
          width={1400}
          height={1400}
          className="w-full rounded-sm shadow-border"
        />
        <figcaption className="mt-3 font-mono text-[0.625rem] tracking-[0.18em] text-subtle uppercase">
          OpenSmell · The first breath · Built by Everett · Tested by Claude
        </figcaption>
      </figure>
    </main>
  );
}
