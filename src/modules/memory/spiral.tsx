import { jobLabel, type Scene } from "@/modules/memory/model";
import { cn } from "@/lib/utils";

export function Spiral({
  scenes,
  activeId,
  onOpen,
}: {
  scenes: Scene[];
  activeId?: string;
  onOpen: (id: string) => void;
}) {
  const visible = scenes.filter((s) => s.job !== "throwaway");
  return (
    <aside className="bg-surface shadow-border flex flex-col rounded-2xl p-3 sm:p-4">
      <div className="mb-3">
        <p className="text-muted text-xs font-medium tracking-wide uppercase">
          Spiral
        </p>
        <p className="text-fg mt-0.5 text-sm">Current at the mouth.</p>
      </div>
      <ol className="flex flex-row gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {visible.map((scene, i) => {
          const on = scene.id === activeId;
          const recede = Math.min(i, 6);
          return (
            <li
              key={scene.id}
              className="min-w-44 shrink-0 lg:min-w-0"
              style={{ opacity: 1 - recede * 0.08 }}
            >
              <button
                type="button"
                onClick={() => onOpen(scene.id)}
                className={cn(
                  "flex w-full flex-col items-start rounded-md px-3 py-2.5 text-left transition-[background-color,box-shadow] duration-150 ease-out",
                  on
                    ? "bg-accent text-accent-fg"
                    : "bg-raised text-fg shadow-border hover:shadow-border-hover",
                )}
              >
                <span className="text-sm font-medium text-balance">
                  {scene.title}
                </span>
                <span
                  className={cn(
                    "mt-1 font-mono text-xs tracking-wide uppercase",
                    on ? "text-accent-fg/70" : "text-faint",
                  )}
                >
                  {jobLabel(scene.job)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
