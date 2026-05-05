import { DeckToolClient } from "./deck-tool-client";

export default function DeckToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <DeckToolClient />
      </div>
    </main>
  );
}
