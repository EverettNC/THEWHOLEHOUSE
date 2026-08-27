import { Check, Copy, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { handOffPorch, isFramed, porchUrl } from "@/lib/family/handoff";

export function Handoff() {
  const [url, setUrl] = useState("");
  const [framed, setFramed] = useState(false);
  const [status, setStatus] = useState<"idle" | "copied" | "shared" | "blocked">("idle");

  useEffect(() => {
    setUrl(porchUrl());
    setFramed(isFramed());
  }, []);

  async function onHandOff() {
    const next = url || porchUrl();
    const result = await handOffPorch(next);
    setStatus(result);
  }

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-border">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-raised shadow-border">
          <Link2 className="size-4" strokeWidth={1.6} />
        </span>
        <div>
          <p className="font-display text-xl italic leading-tight text-fg">Hand this to the computer</p>
          <p className="font-mono text-[0.625rem] tracking-[0.18em] text-subtle uppercase">
            Phone is not the only window
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        {framed
          ? "This preview is a frame. The phone share sheet will not open from here. The porch link is sitting in the box. Copy it. Open it on the computer. Then put the phone down."
          : "Copy the porch link, or use the share sheet. Open it on the computer. The phone can rest."}
      </p>
      <label htmlFor="porch-link" className="sr-only">
        Porch link
      </label>
      <input
        id="porch-link"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        data-testid="handoff-url"
        suppressHydrationWarning
        className="mt-4 h-11 w-full min-w-0 rounded-md bg-raised px-3 font-mono text-xs text-fg shadow-border outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void onHandOff()} data-testid="handoff-copy">
          {status === "copied" || status === "shared" ? <Check /> : <Copy />}
          {status === "shared" ? "Sent" : status === "copied" ? "Copied" : "Copy porch link"}
        </Button>
      </div>
      {status === "blocked" ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          This frame blocked the copy too. Long-press the link and copy it yourself.
        </p>
      ) : null}
    </section>
  );
}
