import { Download } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { usePorch } from "@/lib/porch/store";
import { PORCH_FAMILY, PORCH_ORGAN, type PorchPacket } from "@/lib/porch/types";
import { cn, downloadText } from "@/lib/utils";

type View = "said" | "family" | "raw";

const VIEWS: { id: View; label: string }[] = [
  { id: "said", label: "As said" },
  { id: "family", label: "For the family" },
  { id: "raw", label: "Raw ear" },
];

export function TranscriptPaper() {
  const { history, activeId, teachLexicon } = usePorch();
  const take = history.find((t) => t.id === activeId) ?? history[0] ?? null;

  const [view, setView] = useState<View>("said");
  const [said, setSaid] = useState("");
  const [keep, setKeep] = useState("");

  const body = take
    ? view === "said"
      ? take.asSaid
      : view === "family"
        ? take.forTheFamily
        : take.rawEar
    : null;

  function downloadPacket() {
    if (!take) return;
    const packet: PorchPacket = {
      organ: PORCH_ORGAN,
      family: PORCH_FAMILY,
      kind: "utterance",
      take,
    };
    downloadText("porch-utterance.json", JSON.stringify(packet, null, 2), "application/json");
  }

  function onTeach(e: FormEvent) {
    e.preventDefault();
    const from = said.trim();
    const to = keep.trim();
    if (!from || !to) return;
    teachLexicon(from, to, "taught on the porch.");
    setSaid("");
    setKeep("");
  }

  return (
    <section className="min-w-0 rounded-2xl bg-paper p-5 text-ink shadow-border">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl italic">Heard on the porch</h2>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {VIEWS.map((v) => {
          const on = view === v.id;
          return (
            <Button
              key={v.id}
              type="button"
              size="md"
              variant="ghost"
              aria-pressed={on}
              onClick={() => setView(v.id)}
              className={cn(
                "text-ink hover:bg-ink/10 hover:text-ink",
                on ? "bg-ink text-paper hover:bg-ink hover:text-paper" : "ring-1 ring-ink/15",
              )}
            >
              {v.label}
            </Button>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          disabled={!take}
          onClick={downloadPacket}
          className="text-ink ring-1 ring-ink/15 hover:bg-ink/10 hover:text-ink"
        >
          <Download />
          MCP packet
        </Button>
      </div>

      {take && body != null ? (
        <>
          <p
            className={cn(
              "mt-5 text-pretty break-words text-base leading-relaxed",
              view === "said" && "font-display italic",
              view === "raw" && "font-mono text-sm",
            )}
          >
            {body}
          </p>
          {take.corrections.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1 font-mono text-xs text-ink-muted">
              {take.corrections.map((c, i) => (
                <li key={`${c.from}-${c.to}-${i}`}>
                  {c.from} → {c.to} — {c.why}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">
            The tape went to xAI STT. The words went to grok-4.5, then into
            Memory — the rounded room for the family to pull. This house does
            not keep the audio. The packet names the cloud. I will not hide it.
          </p>
        </>
      ) : (
        <p className="mt-5 text-sm leading-relaxed text-ink-muted">
          No utterance yet. Hold the orb, or drop a clip, or try the porch clip.
        </p>
      )}

      <form onSubmit={onTeach} className="mt-6 border-t border-ink/10 pt-4">
        <p className="font-mono text-[0.6875rem] tracking-[0.22em] text-ink-muted uppercase">
          Teach the ear
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">said</span>
            <input
              value={said}
              onChange={(e) => setSaid(e.target.value)}
              placeholder="said"
              className="h-11 w-full rounded-md bg-paper px-3 font-mono text-sm text-ink ring-1 ring-ink/20 outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-ink/40"
            />
          </label>
          <label className="min-w-0 flex-1">
            <span className="sr-only">keep</span>
            <input
              value={keep}
              onChange={(e) => setKeep(e.target.value)}
              placeholder="keep"
              className="h-11 w-full rounded-md bg-paper px-3 font-mono text-sm text-ink ring-1 ring-ink/20 outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-ink/40"
            />
          </label>
          <Button type="submit" className="h-11 bg-ink text-paper hover:opacity-90">
            Teach
          </Button>
        </div>
      </form>
    </section>
  );
}
