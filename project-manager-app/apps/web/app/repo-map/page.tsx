import { RepoMapClient } from "./repo-map-client";
import { HtmlInCanvasPanel } from "@semse/ui";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Repo Map · SEMSE"
};

export default function RepoMapPage() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8">
      <HtmlInCanvasPanel as="section" className="grid gap-2" canvasClassName="rounded-2xl" minHeight={110}>
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted">Knowledge Domain</span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">SEMSE Repo Knowledge Domain</h1>
        <p className="max-w-3xl text-sm text-muted">
          Vertical slice del dominio estructural del repositorio: árbol navegable, detalle de nodo,
          relaciones y búsqueda de workspaces canónicos.
        </p>
      </HtmlInCanvasPanel>
      <RepoMapClient />
    </main>
  );
}
