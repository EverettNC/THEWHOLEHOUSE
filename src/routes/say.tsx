import { createFileRoute } from "@tanstack/react-router";
import { OrganFrame } from "@/components/family/organ-frame";
import { PorchOrgan } from "@/components/porch/porch-organ";

export const Route = createFileRoute("/say")({
  component: SayPage,
  head: () => ({ meta: [{ title: "Porch — words" }] }),
});

function SayPage() {
  return (
    <OrganFrame active="say">
      <PorchOrgan />
    </OrganFrame>
  );
}
