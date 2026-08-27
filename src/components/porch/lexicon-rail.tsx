import { Badge } from "@/components/ui/badge";
import { DIALECT_KEEP, FAMILY_NAMES, MOUTH_COOPERATION } from "@/lib/porch/lexicon";
import { taughtLexicon, usePorch } from "@/lib/porch/store";

const MOUTH_KEYS = new Set(["live", "lived", "read", "misread"]);

export function LexiconRail() {
  const { lexicon } = usePorch();
  const taught = taughtLexicon(lexicon);
  const mouth = MOUTH_COOPERATION.filter((e) => MOUTH_KEYS.has(e.said.toLowerCase()));
  const extraMouth = MOUTH_COOPERATION.filter((e) => !MOUTH_KEYS.has(e.said.toLowerCase()));

  return (
    <aside className="min-w-0 rounded-2xl bg-surface p-5 shadow-border">
      <p className="font-mono text-[0.6875rem] tracking-[0.22em] text-subtle uppercase">
        The ear's bias
      </p>

      <h3 className="font-display mt-4 text-xl italic text-fg">Mouth-cooperation</h3>
      <ul className="mt-3 flex flex-col gap-3">
        {mouth.map((e) => (
          <li key={e.said}>
            <p className="font-display text-lg italic leading-tight text-fg">{e.said}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">{e.note}</p>
          </li>
        ))}
      </ul>
      {extraMouth.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {extraMouth.map((e) => (
            <li key={e.said} className="text-sm text-muted">
              <span className="font-mono text-fg">{e.said}</span>
              <span className="text-subtle"> — {e.note}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="font-display mt-6 text-xl italic text-fg">Dialect</h3>
      <ul className="mt-3 flex flex-col gap-1.5">
        {DIALECT_KEEP.map((e) => (
          <li key={e.said} className="font-mono text-xs text-muted">
            <span className="text-fg">{e.said}</span>
            {e.keep !== e.said ? <span> → {e.keep}</span> : null}
            <span className="text-subtle"> — {e.note}</span>
          </li>
        ))}
      </ul>

      {taught.length > 0 && (
        <>
          <h3 className="font-display mt-6 text-xl italic text-fg">Taught</h3>
          <ul className="mt-3 flex flex-col gap-1.5">
            {taught.map((e) => (
              <li key={e.said} className="font-mono text-xs text-muted">
                <span className="text-fg">{e.said}</span>
                <span> → {e.keep}</span>
                {e.note ? <span className="text-subtle"> — {e.note}</span> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="font-display mt-6 text-xl italic text-fg">Family names</h3>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FAMILY_NAMES.map((name) => (
          <Badge key={name} variant="default">
            {name}
          </Badge>
        ))}
      </div>
    </aside>
  );
}
