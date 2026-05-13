import { CleaningToolClient } from "./cleaning-tool-client";

export const metadata = {
  title: "Cleaning Service Tool · SEMSE",
  description: "Cleaning service estimator with scope, risk, crew sizing and milestones — connected to SEMSE BuildOps.",
};

export default function CleaningToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <CleaningToolClient />
      </div>
    </main>
  );
}
