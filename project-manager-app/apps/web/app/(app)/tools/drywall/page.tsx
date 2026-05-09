import { DrywallToolClient } from "./drywall-tool-client";

export const metadata = {
  title: "Drywall Tool · SEMSE",
  description: "Drywall calculator connected to the SEMSE tools API.",
};

export default function DrywallToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <DrywallToolClient />
      </div>
    </main>
  );
}
