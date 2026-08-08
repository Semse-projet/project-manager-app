import { Filter, AlertTriangle, Info } from 'lucide-react';

const logs = [
  { time: '22/04/2026 10:30:15', level: 'info', message: 'GET /projects/123', status: '200', duration: '142ms' },
  { time: '22/04/2026 10:30:14', level: 'info', message: 'POST /auth/login', status: '200', duration: '98ms' },
  { time: '22/04/2026 10:30:12', level: 'warn', message: 'PUT /projects/123', status: '422', duration: '312ms' },
  { time: '22/04/2026 10:30:10', level: 'error', message: 'POST /payments', status: '500', duration: '1.2s' },
  { time: '22/04/2026 10:30:08', level: 'info', message: 'GET /users/me', status: '200', duration: '15ms' },
  { time: '22/04/2026 10:30:05', level: 'info', message: 'GET /jobs', status: '200', duration: '203ms' },
  { time: '22/04/2026 10:29:59', level: 'info', message: 'POST /evidence', status: '201', duration: '412ms' },
];

const levelConfig = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  warn: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  error: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
};

export default function DevLogs() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Logs</h1>
            <p className="text-sm text-slate-400 mt-1">Registros del sistema en tiempo real.</p>
          </div>
          <button className="px-3 py-2 bg-[#0F1D32] text-slate-300 text-xs font-medium rounded-lg border border-white/5 flex items-center gap-1.5">
            <Filter className="w-3 h-3" />
            Filtrar
          </button>
        </div>
      </div>

      <div className="bg-[#0F1D32] border border-white/5 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-white/5 text-[10px] text-slate-500 uppercase tracking-wide">
          <div className="col-span-3">Fecha/Hora</div>
          <div className="col-span-1">Nivel</div>
          <div className="col-span-4">Mensaje</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1">Duración</div>
        </div>

        {/* Rows */}
        {logs.map((log, idx) => {
          const config = levelConfig[log.level as keyof typeof levelConfig];
          const Icon = config.icon;
          return (
            <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors items-center">
              <div className="col-span-3 text-[10px] text-slate-400 font-mono">{log.time}</div>
              <div className="col-span-1">
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                  <Icon className="w-2.5 h-2.5" />
                  {log.level.toUpperCase()}
                </span>
              </div>
              <div className="col-span-4 text-xs text-slate-300 font-mono truncate">{log.message}</div>
              <div className="col-span-1">
                <span className={`text-[10px] font-medium ${
                  parseInt(log.status) < 300 ? 'text-emerald-400' : parseInt(log.status) < 500 ? 'text-amber-400' : 'text-red-400'
                }`}>{log.status}</span>
              </div>
              <div className="col-span-1 text-[10px] text-slate-400">{log.duration}</div>
            </div>
          );
        })}
      </div>

      <button className="mt-4 w-full py-3 bg-[#14A0A0]/10 text-[#14A0A0] text-sm font-medium rounded-xl border border-[#14A0A0]/20">
        Ver logs completos
      </button>
    </div>
  );
}
