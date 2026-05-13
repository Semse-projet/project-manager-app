import { BathroomToolClient } from "./bathroom-tool-client";

export const metadata = {
  title: "Bathroom Remodel Tool · SEMSE",
  description: "Bathroom remodel estimator with scope, risk, milestones and evidence — connected to SEMSE BuildOps.",
};

export default function BathroomToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <BathroomToolClient />
      </div>
    </main>
  );
}
