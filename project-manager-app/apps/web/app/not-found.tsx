import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-6 text-center">
      <p
        aria-hidden
        className="text-[8rem] font-black tracking-tighter leading-none select-none"
        style={{ color: "rgba(255,255,255,0.04)" }}
      >
        404
      </p>
      <div style={{ marginTop: "-1rem" }}>
        <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-brand mb-2">
          Página no encontrada
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Esta ruta no existe
        </h1>
        <p className="mt-2 text-sm text-muted max-w-xs mx-auto">
          La URL que buscas no corresponde a ninguna página de la plataforma.
        </p>
        <div className="mt-6 flex gap-3 justify-center flex-wrap">
          <Link href="/" className="spike-button">
            Ir a Jobs
          </Link>
          <Link href="/cortex" className="ghost-action-button">
            Cortex
          </Link>
        </div>
      </div>
    </div>
  );
}
