import { SidingToolClient } from "./siding-tool-client";

export const metadata = {
  title: "Siding Installation Tool · SEMSE",
  description: "Exterior siding estimator with hidden damage detection, inspection gates, risk scoring and evidence-based milestones.",
};

export default function SidingToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <SidingToolClient />
      </div>
    </main>
  );
}
