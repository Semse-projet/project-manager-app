import { PaintingToolClient } from "./painting-tool-client";

export const metadata = {
  title: "Painting Tool · SEMSE",
  description: "Painting calculator connected to the SEMSE tools API.",
};

export default function PaintingToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <PaintingToolClient />
      </div>
    </main>
  );
}
