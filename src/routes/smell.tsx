import { createFileRoute } from "@tanstack/react-router";
import { OrganFrame } from "@/components/family/organ-frame";
import { SmellOrgan } from "@/components/smell/smell-organ";

export const Route = createFileRoute("/smell")({
  component: SmellPage,
  head: () => ({ meta: [{ title: "OpenSmell — smell" }] }),
});

function SmellPage() {
  return (
    <OrganFrame active="smell">
      <SmellOrgan />
    </OrganFrame>
  );
}
