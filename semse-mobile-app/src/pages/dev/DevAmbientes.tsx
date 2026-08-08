import { CheckCircle, Clock, AlertCircle, ArrowRight } from 'lucide-react';

const envs = [
  { name: 'Producción', url: 'https://api.semseproject.com', status: 'active', lastDeploy: '22 Abr 2026, 09:15', color: 'text-emerald-400' },
  { name: 'Staging', url: 'https://staging-api.semseproject.com', status: 'syncing', lastDeploy: '22 Abr 2026, 08:40', color: 'text-amber-400' },
  { name: 'Desarrollo', url: 'https://dev-api.semseproject.local', status: 'active', lastDeploy: '21 Abr 2026, 17:12', color: 'text-emerald-400' },
  { name: 'QA', url: 'https://qa-api.semseproject.com', status: 'active', lastDeploy: '21 Abr 2026, 16:30', color: 'text-emerald-400' },
  { name: 'Sandbox', url: 'https://sandbox-api.semseproject.com', status: 'active', lastDeploy: '21 Abr 2026, 15:05', color: 'text-emerald-400' },
];

export default function DevAmbientes() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Ambientes</h1>
            <p className="text-sm text-slate-400 mt-1">Gestiona los ambientes de despliegue.</p>
          </div>
          <button className="px-3 py-2 bg-[#14A0A0] text-white text-xs font-semibold rounded-lg">+ Nuevo ambiente</button>
        </div>
      </div>

      <div className="space-y-3">
        {envs.map((env, idx) => (
          <div key={idx} className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {env.status === 'active' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> :
                 env.status === 'syncing' ? <Clock className="w-5 h-5 text-amber-400" /> :
                 <AlertCircle className="w-5 h-5 text-red-400" />}
                <div>
                  <h3 className="text-sm font-semibold text-white">{env.name}</h3>
                  <code className="text-[10px] text-slate-400 font-mono">{env.url}</code>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-medium ${env.color}`}>
                  {env.status === 'active' ? 'Activo' : env.status === 'syncing' ? 'Sincronizando' : 'En pausa'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
              <span className="text-[10px] text-slate-500">Último despliegue: {env.lastDeploy}</span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
