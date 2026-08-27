import { createFileRoute } from "@tanstack/react-router";
import { EyeWindow } from "@/components/cornea/EyeWindow";

export const Route = createFileRoute("/see")({
  component: EyeWindow,
  head: () => ({ meta: [{ title: "Lucent — live sight" }] }),
});
