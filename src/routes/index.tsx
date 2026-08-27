import { createFileRoute } from "@tanstack/react-router";
import { Body } from "@/components/family/body";

export const Route = createFileRoute("/")({ component: Body });
