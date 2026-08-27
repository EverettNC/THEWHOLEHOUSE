import { Camera } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prepareEyeWindow } from "@/lib/cornea/live-feed";

export function EyeLink({
  className,
  size = "sm",
  label = "Live sight",
}: {
  className?: string;
  size?: "sm" | "md";
  label?: string;
}) {
  return (
    <a
      href="/see"
      target="lucent-see"
      rel="opener"
      className={cn(buttonVariants({ variant: "primary", size }), className)}
      onClick={() => prepareEyeWindow()}
    >
      <Camera />
      {label}
    </a>
  );
}
