import { CHANNELS, CHANNEL_COPY, type Channel, type Channels } from "@/modules/memory/model";
import { cn } from "@/lib/utils";

export function Doors({
  channels,
  active,
  emptyHint,
}: {
  channels: Channels;
  active?: Channel[];
  emptyHint?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {CHANNELS.map((ch) => {
        const on = active?.includes(ch);
        const body = channels[ch];
        return (
          <article
            key={ch}
            className={cn(
              "bg-raised rounded-lg p-3 shadow-border sm:p-4",
              on && "shadow-border-hover",
              ch === "place" && "sm:col-span-2",
            )}
          >
            <p className="text-faint text-xs font-medium tracking-wide uppercase">
              {CHANNEL_COPY[ch].title}
              {on ? " · cue" : ""}
            </p>
            {body ? (
              <p className="text-fg mt-2 text-sm leading-normal text-pretty">
                {body}
              </p>
            ) : (
              <p className="text-faint mt-2 text-sm leading-normal">
                {emptyHint ? CHANNEL_COPY[ch].hint : "Door empty. Still a door."}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
