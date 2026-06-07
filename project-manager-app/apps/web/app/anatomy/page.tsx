import { AnatomyClient } from "./anatomy-client";
import { HtmlInCanvasPanel } from "@semse/ui";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Anatomy · SEMSE"
};

export default function AnatomyPage() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8">
      <HtmlInCanvasPanel as="section" className="grid gap-2" canvasClassName="rounded-2xl" minHeight={110}>
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted">Knowledge Domain</span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">SEMSE Anatomy Knowledge Domain</h1>
        <p className="max-w-3xl text-sm text-muted">
          Vertical slice del dominio anatómico: árbol navegable, detalle de nodo, relaciones y tutor anatómico
          usando conocimiento estructurado y agentes especializados.
        </p>
      </HtmlInCanvasPanel>
      <AnatomyClient />
    </main>
  );
}
