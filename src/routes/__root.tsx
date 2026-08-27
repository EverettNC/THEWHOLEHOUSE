import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { HearingProvider } from "@/components/corti/hearing-context";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Christman Sound";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Lucent sees. Corti measures. OpenSmell sniffs. Skin sits. Porch hears the words. Memory keeps the building.",
      },
      { name: "theme-color", content: "#090a0b" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Instrument+Serif:ital@0;1&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <HearingProvider>
          <TooltipProvider delayDuration={200}>
            <Outlet />
            <Toaster
              theme="dark"
              position="top-center"
              duration={2200}
              toastOptions={{
                className: "!bg-surface !text-fg !border-border",
              }}
            />
          </TooltipProvider>
        </HearingProvider>
        <Scripts />
      </body>
    </html>
  ),
});
