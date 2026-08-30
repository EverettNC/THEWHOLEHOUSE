import { createFileRoute } from "@tanstack/react-router";
import { SoundOrgan } from "@/components/family/sound-organ";

export const Route = createFileRoute("/sound")({
  component: SoundOrgan,
  head: () => ({ meta: [{ title: "Canal — Christman-Sound" }] }),
});
