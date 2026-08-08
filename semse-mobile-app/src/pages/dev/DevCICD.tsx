import { CheckCircle, AlertCircle } from 'lucide-react';

const deploys = [
  { env: 'Producción', version: 'v1.8.2', commit: 'a3f2d1c', status: 'success', time: '09:15:23', ago: 'hace 1 hora' },
  { env: 'Staging', version: 'v1.8.3-rc1', commit: 'b4e5f6a', status: 'success', time: '08:40:12', ago: 'hace 2 horas' },
  { env: 'QA', version: 'v1.8.1', commit: 'c7d8e9b', status: 'success', time: '07:22:45', ago: 'hace 3 horas' },
  { env: 'Desarrollo', version: 'v1.8.4-dev', commit: 'd0e1f2g', status: 'failed', time: '06:15:00', ago: 'hace 4 horas' },
];

export default function DevCICD() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">CI/CD y Despliegues</h1>
        <p className="text-sm text-slate-400 mt-1">Historial de despliegues automáticos.</p>
      </div>

      <div className="bg-[#0F1D32] border border-white/5 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-white/5 text-[10px] text-slate-500 uppercase tracking-wide">
          <div className="col-span-3">Ambiente</div>
          <div className="col-span-2">Versión</div>
          <div className="col-span-2">Commit</div>
          <div className="col-span-2">Estado</div>
          <div className="col-span-3">Tiempo</div>
        </div>
        {deploys.map((d, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 last:border-0 items-center hover:bg-white/5 transition-colors">
            <div className="col-span-3 text-xs text-white">{d.env}</div>
            <div className="col-span-2 text-xs text-slate-300 font-mono">{d.version}</div>
            <div className="col-span-2 text-[10px] text-slate-400 font-mono">{d.commit}</div>
            <div className="col-span-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                d.status === 'success' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {d.status === 'success' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {d.status === 'success' ? 'Éxito' : 'Fallido'}
              </span>
            </div>
            <div className="col-span-3 text-[10px] text-slate-400">{d.time} • {d.ago}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
