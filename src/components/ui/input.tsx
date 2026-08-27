import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md bg-raised px-3 font-mono text-sm text-fg tabular-nums shadow-border outline-none transition-[box-shadow,background-color] duration-150 ease-out placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
