import { Key, Webhook, Database, ArrowRight } from 'lucide-react';

const tools = [
  { name: 'Generador de API Tokens', desc: 'Crea tokens para autenticación', icon: Key, path: '/dev/herramientas' },
  { name: 'Simulador de Webhooks', desc: 'Prueba eventos de webhook', icon: Webhook, path: '/dev/herramientas' },
  { name: 'Seed de datos', desc: 'Pobla la base de datos de prueba', icon: Database, path: '/dev/herramientas' },
];

export default function DevHerramientas() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Herramientas</h1>
        <p className="text-sm text-slate-400 mt-1">Utilidades para el desarrollo.</p>
      </div>

      <div className="space-y-3">
        {tools.map((tool, idx) => {
          const Icon = tool.icon;
          return (
            <div key={idx} className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#14A0A0]/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#14A0A0]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white">{tool.name}</h3>
                  <p className="text-xs text-slate-400">{tool.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-[#0F1D32] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Variables de Entorno</h3>
        <div className="space-y-2">
          {[
            { key: 'API_BASE_URL', value: 'https://api.semseproject.com', protected: false },
            { key: 'API_KEY', value: 'sk_live_*******************', protected: true },
            { key: 'WEBHOOK_SECRET', value: 'whsec_*******************', protected: true },
            { key: 'DATABASE_URL', value: 'postgresql://...', protected: false },
          ].map((env) => (
            <div key={env.key} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
              <span className="text-xs text-slate-300 font-mono w-36 truncate">{env.key}</span>
              <span className={`text-xs font-mono ${env.protected ? 'text-amber-400' : 'text-slate-400'}`}>{env.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
