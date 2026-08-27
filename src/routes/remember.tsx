import { createFileRoute } from "@tanstack/react-router";
import { OrganFrame } from "@/components/family/organ-frame";
import { Chamber } from "@/modules/memory/chamber";

export const Route = createFileRoute("/remember")({
  component: RememberPage,
  head: () => ({ meta: [{ title: "Memory — remember" }] }),
});

function RememberPage() {
  return (
    <OrganFrame active="remember">
      <Chamber />
    </OrganFrame>
  );
}
