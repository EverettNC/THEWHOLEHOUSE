import { createFileRoute } from "@tanstack/react-router";
import { LucentApp } from "@/components/cornea/LucentApp";
import { OrganFrame } from "@/components/family/organ-frame";

export const Route = createFileRoute("/lucent")({
  component: LucentPage,
  head: () => ({ meta: [{ title: "Lucent — sight" }] }),
});

function LucentPage() {
  return (
    <OrganFrame active="lucent">
      <div className="relative h-[calc(100dvh-3.5rem)] min-h-[32rem]">
        <LucentApp />
      </div>
    </OrganFrame>
  );
}
