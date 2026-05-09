import { InsulationToolClient } from "./insulation-tool-client";

export const metadata = {
  title: "Insulation Tool · SEMSE",
  description: "Insulation calculator connected to the SEMSE tools API.",
};

export default function InsulationToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <InsulationToolClient />
      </div>
    </main>
  );
}
