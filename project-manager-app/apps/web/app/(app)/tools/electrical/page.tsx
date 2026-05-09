import { ElectricalToolClient } from "./electrical-tool-client";

export const metadata = {
  title: "Electrical Tool · SEMSE",
  description: "Electrical calculator connected to the SEMSE tools API.",
};

export default function ElectricalToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <ElectricalToolClient />
      </div>
    </main>
  );
}
