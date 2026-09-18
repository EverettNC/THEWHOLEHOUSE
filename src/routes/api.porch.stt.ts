import { createFileRoute } from "@tanstack/react-router";
import { runPorchStt, type TranscribeInput } from "@/lib/porch/transcribe";

export const Route = createFileRoute("/api/porch/stt")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          ok: true,
          organ: "porch",
          house: "http://127.0.0.1:9785/say",
          keyless: true,
          ear: "porch",
        });
      },
      POST: async ({ request }) => {
        let body: TranscribeInput;
        try {
          body = (await request.json()) as TranscribeInput;
        } catch {
          return Response.json(
            { ok: false, error: "The word-ear could not read that body." },
            { status: 400 },
          );
        }
        const result = await runPorchStt({
          audioBase64: String(body.audioBase64 || ""),
          mime: String(body.mime || "audio/wav"),
          filename: body.filename,
          extraLexicon: body.extraLexicon,
          source: body.source === "file" || body.source === "sample" ? body.source : "mic",
        });
        return Response.json(result, { status: result.ok ? 200 : 503 });
      },
    },
  },
});
