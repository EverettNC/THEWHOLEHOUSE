import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CHANNELS, CHANNEL_COPY } from "@/modules/memory/model";
import { useMemory } from "@/modules/memory/store";

function Mark({
  checked,
  onChange,
  title,
  body,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  body: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="border-line bg-raised mt-1 size-4 rounded-sm"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm leading-normal">
        <span className="text-fg font-medium">{title}</span>
        <span className="text-muted mt-0.5 block">{body}</span>
      </span>
    </label>
  );
}

export function EncodeForm() {
  const draft = useMemory((s) => s.draft);
  const draftTitle = useMemory((s) => s.draftTitle);
  const leftHomeostasis = useMemory((s) => s.leftHomeostasis);
  const procedure = useMemory((s) => s.procedure);
  const claim = useMemory((s) => s.claim);
  const setDraftTitle = useMemory((s) => s.setDraftTitle);
  const setDraftChannel = useMemory((s) => s.setDraftChannel);
  const setLeftHomeostasis = useMemory((s) => s.setLeftHomeostasis);
  const setProcedure = useMemory((s) => s.setProcedure);
  const setClaim = useMemory((s) => s.setClaim);
  const writeScene = useMemory((s) => s.writeScene);
  const cancelWrite = useMemory((s) => s.cancelWrite);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        writeScene();
      }}
    >
      <div>
        <p className="text-muted text-xs font-medium tracking-wide uppercase">
          Write a room
        </p>
        <p className="text-fg mt-1 max-w-prose text-sm leading-normal text-pretty">
          Capture inclusively. Do not decide which door will matter later. Place
          already holds the building.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="A name for the shelf"
        />
      </div>

      {CHANNELS.map((ch) => (
        <div key={ch} className="flex flex-col gap-1.5">
          <Label htmlFor={ch}>{CHANNEL_COPY[ch].title}</Label>
          <Textarea
            id={ch}
            value={draft[ch]}
            onChange={(e) => setDraftChannel(ch, e.target.value)}
            placeholder={CHANNEL_COPY[ch].hint}
            className={ch === "place" ? "min-h-28" : "min-h-20"}
          />
        </div>
      ))}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-muted text-xs font-medium tracking-wide uppercase">
          What it does
        </legend>
        <Mark
          checked={leftHomeostasis}
          onChange={setLeftHomeostasis}
          title="Left homeostasis"
          body="Either direction. A hug and a wall are the same job. Nothing compresses out."
        />
        <Mark
          checked={procedure}
          onChange={setProcedure}
          title="Procedure"
          body="Education, operations, how-to. Night will fold it small."
        />
        <Mark
          checked={claim === "living"}
          onChange={(v) => setClaim(v ? "living" : "record")}
          title="Living-state"
          body="True as of this writing. Not true-now. Records stay dated."
        />
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">Write the room</Button>
        <Button type="button" variant="ghost" onClick={cancelWrite}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
