import type { Metadata } from "next";
import { WorkspaceLayout } from "./components/WorkspaceLayout";

export const metadata: Metadata = {
  title: "Sense Workspace · SEMSE OS",
  description: "Espacio de trabajo unificado de tres paneles para operar misiones.",
};

export default function WorkspacePage() {
  return <WorkspaceLayout />;
}
