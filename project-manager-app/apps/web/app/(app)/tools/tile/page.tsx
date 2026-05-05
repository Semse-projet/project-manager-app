import { TileToolClient } from "./tile-tool-client";

export const metadata = {
  title: "Tile Tool · SEMSE",
  description: "Tile calculator connected to the SEMSE tools API.",
};

export default function TileToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <TileToolClient />
      </div>
    </main>
  );
}
