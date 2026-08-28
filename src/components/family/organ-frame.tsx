import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const ORGANS = [
  { to: "/", label: "Body", match: "exact" as const },
  { to: "/lucent", label: "Lucent", match: "prefix" as const },
  { to: "/hear", label: "Corti", match: "prefix" as const },
  { to: "/say", label: "Porch", match: "prefix" as const },
  { to: "/smell", label: "OpenSmell", match: "prefix" as const },
  { to: "/touch", label: "Skin", match: "prefix" as const },
  { to: "/remember", label: "Memory", match: "prefix" as const },
  { to: "/sound", label: "Sound", match: "prefix" as const },
];

export type OrganActive =
  | "body"
  | "lucent"
  | "hear"
  | "say"
  | "smell"
  | "touch"
  | "remember"
  | "sound";

export function OrganFrame({
  children,
  active,
}: {
  children: ReactNode;
  active: OrganActive;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src="/house/sign-mark.jpg"
              alt=""
              width={80}
              height={37}
              className="h-11 w-auto rounded-sm shadow-border"
            />
            <span className="min-w-0">
              <p className="font-mono text-[0.625rem] tracking-[0.28em] text-subtle uppercase">
                The Christman AI Family
              </p>
              <p className="font-display text-lg italic leading-tight text-fg">The whole house</p>
            </span>
          </Link>
          <nav className="flex flex-wrap gap-1" aria-label="Organs">
            {ORGANS.map((o) => {
              const on =
                (o.match === "exact" && active === "body") ||
                (o.to === "/lucent" && active === "lucent") ||
                (o.to === "/hear" && active === "hear") ||
                (o.to === "/say" && active === "say") ||
                (o.to === "/smell" && active === "smell") ||
                (o.to === "/touch" && active === "touch") ||
                (o.to === "/remember" && active === "remember") ||
                (o.to === "/sound" && active === "sound");
              return (
                <Link
                  key={o.to}
                  to={o.to}
                  className={cn(
                    "inline-flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors duration-[var(--motion-quick)]",
                    on ? "bg-raised text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {o.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}
