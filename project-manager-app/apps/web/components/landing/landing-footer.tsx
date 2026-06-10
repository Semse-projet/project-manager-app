import Link from "next/link";

const FOOTER_COLS = [
  {
    title: "Servicios",
    links: [
      { label: "Construcción y Remodelación", href: "#servicios" },
      { label: "Mantenimiento", href: "#servicios" },
      { label: "Servicios Administrativos", href: "#servicios" },
      { label: "Prometeo IA", href: "#prometeo" },
    ],
  },
  {
    title: "Plataforma",
    links: [
      { label: "Cómo funciona", href: "#como-funciona" },
      { label: "Publicar proyecto", href: "/client/jobs/new" },
      { label: "Unirse como profesional", href: "/login?from=/worker/dashboard" },
      { label: "Panel Admin", href: "/login?from=/admin/dashboard" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre SEMSE Project", href: "#" },
      { label: "Profesionales verificados", href: "#profesionales" },
      { label: "Privacidad", href: "/privacy" },
      { label: "Términos de servicio", href: "/terms" },
      { label: "Eliminación de datos", href: "/data-deletion" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-slate-400">
      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
                S
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight text-white leading-none">
                  SEMSE Project
                </span>
                <span className="text-[9px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">
                  Plataforma Operativa
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              Ecosistema digital para conectar clientes, profesionales y contratistas en proyectos de construcción, remodelación, mantenimiento y servicios especializados.
            </p>
            <div>
              <Link
                href="/client/jobs/new"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-150 shadow-md shadow-blue-900/20"
              >
                Publicar proyecto →
              </Link>
            </div>
          </div>

          {/* Links Cols */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title} className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-300 tracking-wider uppercase">
                {col.title}
              </h3>
              <ul className="space-y-2.5 list-none p-0 m-0">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors duration-150 no-underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            © 2026 SEMSE Project · Marketplace operativo con IA, escrow y evidencias verificadas.
          </p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sistema activo
            </span>
            <span className="text-xs text-slate-500">Prometeo IA conectado</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

