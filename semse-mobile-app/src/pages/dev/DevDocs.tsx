import { FileText, Video, Code, ChevronRight, Search } from 'lucide-react';

const modules = [
  { id: 'auth', label: 'Autenticación', desc: 'OAuth2, JWT, refresh tokens' },
  { id: 'projects', label: 'Proyectos', desc: 'CRUD, milestones, estados' },
  { id: 'trabajos', label: 'Trabajos', desc: 'Gestión de tareas y asignaciones' },
  { id: 'pagos', label: 'Pagos', desc: 'Escrow, pagos, disputas' },
  { id: 'evidencias', label: 'Evidencias', desc: 'Upload, storage, checklist' },
  { id: 'viajes', label: 'Viajes', desc: 'Logística y reembolsos' },
  { id: 'fieldops', label: 'Field Ops', desc: 'Operaciones de campo' },
  { id: 'agentes', label: 'Agentes y Autonomía', desc: 'Agentes operativos' },
];

const tutorials = [
  { title: 'Primeros pasos', desc: 'Configura tu entorno de desarrollo' },
  { title: 'Autenticación', desc: 'Implementa OAuth2 en tu app' },
  { title: 'Integración web', desc: 'Conecta tu frontend' },
  { title: 'Integración móvil', desc: 'SDK para iOS y Android' },
  { title: 'Buenas prácticas', desc: 'Optimiza tus integraciones' },
];

export default function DevDocs() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Documentación</h1>
        <p className="text-sm text-slate-400 mt-1">Todo lo que necesitas para integrar SEMSEproject.</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar en la documentación..."
          className="w-full h-11 pl-10 pr-4 bg-[#0F1D32] rounded-xl text-sm text-slate-200 placeholder:text-slate-500 border border-white/5 focus:outline-none focus:border-[#14A0A0]/30"
        />
      </div>

      {/* Guides + Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Guías</h3>
          <div className="space-y-2">
            {['Introducción', 'Autenticación', 'Manejo de errores', 'Paginación', 'Filtros avanzados'].map((g) => (
              <button key={g} className="w-full flex items-center gap-2 py-1.5 text-xs text-slate-300 hover:text-[#14A0A0] transition-colors text-left">
                <ChevronRight className="w-3 h-3" />
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Recursos</h3>
          <div className="space-y-2">
            {['Endpoints', 'Webhooks', 'Modelos', 'Códigos de error', 'Changelog'].map((r) => (
              <button key={r} className="w-full flex items-center gap-2 py-1.5 text-xs text-slate-300 hover:text-[#14A0A0] transition-colors text-left">
                <FileText className="w-3 h-3" />
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-white mb-3">Módulos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {modules.map((m) => (
            <button key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#0B1628] hover:bg-white/5 transition-colors text-left">
              <Code className="w-4 h-4 text-[#14A0A0]" />
              <div>
                <p className="text-xs font-medium text-slate-200">{m.label}</p>
                <p className="text-[10px] text-slate-500">{m.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tutorials */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Tutoriales</h3>
        <div className="space-y-2">
          {tutorials.map((t, i) => (
            <button key={i} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left">
              <div className="w-8 h-8 rounded-lg bg-[#14A0A0]/10 flex items-center justify-center flex-shrink-0">
                <Video className="w-4 h-4 text-[#14A0A0]" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-200">{t.title}</p>
                <p className="text-[10px] text-slate-500">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <button className="mt-4 w-full py-3 bg-[#14A0A0]/10 text-[#14A0A0] text-sm font-medium rounded-xl border border-[#14A0A0]/20 hover:bg-[#14A0A0]/20 transition-colors">
        Ver documentación completa →
      </button>
    </div>
  );
}
