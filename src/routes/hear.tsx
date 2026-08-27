import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/corti/app-shell";
import { OrganFrame } from "@/components/family/organ-frame";

export const Route = createFileRoute("/hear")({
  component: HearPage,
  head: () => ({ meta: [{ title: "Corti — hearing" }] }),
});

function HearPage() {
  return (
    <OrganFrame active="hear">
      <AppShell />
    </OrganFrame>
  );
}
