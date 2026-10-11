import { createFileRoute } from "@tanstack/react-router";

/**
 * The bytes of one saved Lucent frame. file= is the path relative to the sight
 * folder, exactly as the tape index gives it. Nothing outside that folder is served.
 */
export const Route = createFileRoute("/api/lucent/frame")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const rel = new URL(request.url).searchParams.get("file") || "";
        if (!rel || rel.includes("..") || rel.startsWith("/")) {
          return new Response("No such frame.", { status: 400 });
        }
        const { readFile } = await import("node:fs/promises");
        const { join, normalize } = await import("node:path");
        const { SIGHT_DIR } = await import("@/lib/sound/lucent-disk");
        const path = normalize(join(SIGHT_DIR, rel));
        if (!path.startsWith(SIGHT_DIR)) {
          return new Response("Outside the sight folder.", { status: 400 });
        }
        try {
          const bytes = await readFile(path);
          return new Response(new Uint8Array(bytes), {
            headers: { "content-type": "image/jpeg", "cache-control": "no-store" },
          });
        } catch {
          return new Response("No such frame.", { status: 404 });
        }
      },
    },
  },
});
