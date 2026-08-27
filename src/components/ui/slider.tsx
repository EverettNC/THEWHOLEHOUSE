import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Slider({
  className,
  ...props
}: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-11 w-full touch-none items-center select-none", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-px w-full grow overflow-hidden rounded-full bg-fg/15">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-3.5 rounded-full bg-accent shadow-[0_0_0_4px_var(--color-bg),0_0_0_5px_color-mix(in_oklab,var(--color-fg)_22%,transparent)] focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--color-bg),0_0_0_6px_color-mix(in_oklab,var(--color-accent)_55%,transparent)]" />
    </SliderPrimitive.Root>
  );
}
