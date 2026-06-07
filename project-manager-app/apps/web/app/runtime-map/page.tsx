import { RuntimeMapClient } from "./runtime-map-client";
import { HtmlInCanvasPanel } from "@semse/ui";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Runtime Map · SEMSE"
};

export default function RuntimeMapPage() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8">
      <HtmlInCanvasPanel as="section" className="grid gap-2" canvasClassName="rounded-2xl" minHeight={110}>
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted">Operational Domain</span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">SEMSE Runtime Knowledge Domain</h1>
        <p className="max-w-3xl text-sm text-muted">
          Topologia viva de servicios, dependencias y estado operativo del ecosistema inteligente.
        </p>
      </HtmlInCanvasPanel>
      <RuntimeMapClient />
    </main>
  );
}
