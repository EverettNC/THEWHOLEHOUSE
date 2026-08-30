import { LexiconRail } from "./lexicon-rail";
import { ListenStage } from "./listen-stage";
import { TranscriptPaper } from "./transcript-paper";

export function PorchOrgan() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <section className="max-w-2xl">
        <p className="font-mono text-[0.6875rem] tracking-[0.22em] text-subtle uppercase">
          Porch
        </p>
        <h1 className="font-display mt-2 text-3xl italic text-fg">The word-ear</h1>
        <p className="mt-3 max-w-prose text-pretty text-sm text-muted">
          Corti is the ear — real sound, so you can hear it. Porch is the words.
          OpenSmell is the nose. Skin is haptic. This path is the house, for
          everyone. The tape leaves for xAI STT. The words come home to Memory.
          Dialect stays. live is presence, not leave. Whisper is not in this body.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <ListenStage />
        <TranscriptPaper />
      </div>

      <LexiconRail />
    </main>
  );
}