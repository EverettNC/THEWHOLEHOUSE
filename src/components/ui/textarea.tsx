import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full resize-y rounded-md bg-raised px-3 py-2.5 text-sm leading-normal text-fg shadow-border outline-none transition-[box-shadow,background-color] duration-150 ease-out placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
