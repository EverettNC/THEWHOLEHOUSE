import { createFileRoute } from "@tanstack/react-router";
import { OrganFrame } from "@/components/family/organ-frame";
import { SkinOrgan } from "@/components/skin/skin-organ";

export const Route = createFileRoute("/touch")({
  component: TouchPage,
  head: () => ({ meta: [{ title: "Skin — body" }] }),
});

function TouchPage() {
  return (
    <OrganFrame active="touch">
      <SkinOrgan />
    </OrganFrame>
  );
}
