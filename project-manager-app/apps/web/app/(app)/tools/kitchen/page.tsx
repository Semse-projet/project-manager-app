import { KitchenToolClient } from "./kitchen-tool-client";

export const metadata = {
  title: "Kitchen Remodel Tool · SEMSE",
  description: "Kitchen remodel estimator with scope, risk, milestones and evidence — connected to SEMSE BuildOps.",
};

export default function KitchenToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <KitchenToolClient />
      </div>
    </main>
  );
}
