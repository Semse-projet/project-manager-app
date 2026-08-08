import { Play, Lock } from 'lucide-react';

const endpoints = [
  { method: 'POST', path: '/auth/login', name: 'Iniciar sesión', category: 'Auth', protected: false },
  { method: 'POST', path: '/auth/register', name: 'Crear cuenta', category: 'Auth', protected: false },
  { method: 'GET', path: '/projects', name: 'Listar proyectos', category: 'Proyectos', protected: true },
  { method: 'POST', path: '/projects', name: 'Crear proyecto', category: 'Proyectos', protected: true },
  { method: 'GET', path: '/projects/{id}', name: 'Obtener proyecto', category: 'Proyectos', protected: true },
  { method: 'PUT', path: '/projects/{id}', name: 'Actualizar proyecto', category: 'Proyectos', protected: true },
  { method: 'DELETE', path: '/projects/{id}', name: 'Eliminar proyecto', category: 'Proyectos', protected: true },
  { method: 'GET', path: '/payments', name: 'Listar pagos', category: 'Pagos', protected: true },
  { method: 'GET', path: '/evidence', name: 'Obtener evidencias', category: 'Evidencias', protected: true },
  { method: 'POST', path: '/evidence/upload', name: 'Subir evidencia', category: 'Evidencias', protected: true },
];

const methodColors: Record<string, string> = {
  GET: 'bg-blue-500/10 text-blue-400',
  POST: 'bg-emerald-500/10 text-emerald-400',
  PUT: 'bg-amber-500/10 text-amber-400',
  DELETE: 'bg-red-500/10 text-red-400',
  PATCH: 'bg-purple-500/10 text-purple-400',
};

export default function DevAPIs() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">APIs y Endpoints</h1>
        <p className="text-sm text-slate-400 mt-1">Explora todos los endpoints disponibles de la plataforma.</p>
      </div>

      {/* Base URL */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Base URL</p>
            <code className="text-sm text-[#14A0A0] font-mono mt-1 block">https://api.semseproject.com/v1</code>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">v1.8.2</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {['Todos', 'Auth', 'Proyectos', 'Pagos', 'Evidencias', 'Usuarios'].map((tab, i) => (
          <button key={tab} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            i === 0 ? 'bg-[#14A0A0]/10 text-[#14A0A0] border border-[#14A0A0]/20' : 'bg-[#0F1D32] text-slate-400 border border-white/5 hover:text-slate-200'
          }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Endpoints List */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl overflow-hidden">
        {endpoints.map((ep, idx) => (
          <div key={idx} className="flex items-center gap-4 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${methodColors[ep.method]}`}>{ep.method}</span>
            <code className="text-xs text-slate-300 font-mono flex-1">{ep.path}</code>
            <span className="text-xs text-slate-400 hidden sm:block">{ep.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400">{ep.category}</span>
            <div className="flex items-center gap-2">
              {ep.protected && <Lock className="w-3 h-3 text-amber-400" />}
              <button className="w-7 h-7 rounded-lg bg-[#14A0A0]/10 flex items-center justify-center hover:bg-[#14A0A0]/20">
                <Play className="w-3 h-3 text-[#14A0A0]" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-4 w-full py-3 bg-[#14A0A0]/10 text-[#14A0A0] text-sm font-medium rounded-xl border border-[#14A0A0]/20 hover:bg-[#14A0A0]/20 transition-colors">
        Ver toda la documentación
      </button>
    </div>
  );
}
