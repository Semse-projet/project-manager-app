import { FlooringToolClient } from "./flooring-tool-client";

export const metadata = {
  title: "Flooring Tool · SEMSE",
  description: "Flooring calculator connected to the SEMSE tools API.",
};

export default function FlooringToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <FlooringToolClient />
      </div>
    </main>
  );
}
