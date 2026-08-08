import { Plus, Bug, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';

const issues = [
  { title: 'Intermitencia en PaymentService', severity: 'critical', type: 'bug', status: 'open', date: '22 Abr 2026' },
  { title: 'Timeout en subida de evidencias >50MB', severity: 'high', type: 'bug', status: 'open', date: '21 Abr 2026' },
  { title: 'Memory leak en Autonomy Server', severity: 'medium', type: 'task', status: 'in_progress', date: '20 Abr 2026' },
  { title: 'Rate limiting no funciona en /auth', severity: 'high', type: 'bug', status: 'resolved', date: '19 Abr 2026' },
  { title: 'Documentación desactualizada SDK Python', severity: 'low', type: 'task', status: 'resolved', date: '18 Abr 2026' },
];

const sevColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export default function DevIncidencias() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Panel de Incidencias</h1>
            <p className="text-sm text-slate-400 mt-1">Issues, bugs y tareas técnicas.</p>
          </div>
          <button className="px-3 py-2 bg-[#14A0A0] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5">
            <Plus className="w-3 h-3" />
            Nueva incidencia
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {issues.map((issue, idx) => (
          <div key={idx} className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
            <div className="flex items-start gap-3">
              {issue.type === 'bug' ? <Bug className="w-4 h-4 text-red-400 mt-0.5" /> : <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5" />}
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-white">{issue.title}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sevColors[issue.severity]}`}>
                    {issue.severity}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className={`inline-flex items-center gap-1 text-[10px] ${
                    issue.status === 'open' ? 'text-red-400' : issue.status === 'in_progress' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {issue.status === 'resolved' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {issue.status === 'open' ? 'Abierto' : issue.status === 'in_progress' ? 'En progreso' : 'Resuelto'}
                  </span>
                  <span className="text-[10px] text-slate-500">{issue.date}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
