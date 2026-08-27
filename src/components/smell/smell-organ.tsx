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
          One MQ-135 voltage. Channel names are proxy labels, not GC-MS. Not a
          diagnosis. Sample air is not the house. Live smell is serial, sniffing.
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <NoseStage />
        <div className="flex flex-col gap-4">
          <ReadingPaper />
          <ProfileRail />
        </div>
      </div>
    </main>
  );
}
