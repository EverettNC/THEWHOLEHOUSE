import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[0.6875rem] font-medium tracking-wide uppercase tabular-nums",
  {
    variants: {
      variant: {
        default: "bg-raised text-muted shadow-border",
        solid: "bg-accent text-accent-fg",
        high: "bg-raised text-fg shadow-border",
        low: "bg-bg text-faint shadow-border",
        lock: "bg-in-tune/15 text-in-tune",
        open: "bg-accent/10 text-accent",
        warn: "bg-danger/15 text-danger",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
