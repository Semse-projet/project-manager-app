import { ElectricalToolClient } from "./electrical-tool-client";

export const metadata = {
  title: "Electrical Tool · SEMSE",
  description: "Electrical operations module with dashboard, estimate, scope, materials, milestones, evidence and load analysis.",
};

export default function ElectricalToolPage() {
  return <ElectricalToolClient section="dashboard" />;
}
