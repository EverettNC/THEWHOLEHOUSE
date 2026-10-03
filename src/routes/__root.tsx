import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { HearingProvider } from "@/components/corti/hearing-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "THE WHOLE HOUSE";

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
      { name: "theme-color", content: "#0c0d09" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
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
