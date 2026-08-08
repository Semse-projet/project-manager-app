import { CheckCircle, XCircle } from 'lucide-react';

const tests = [
  { name: 'AuthService.login', type: 'unit', status: 'pass', time: '12ms' },
  { name: 'ProjectService.create', type: 'unit', status: 'pass', time: '18ms' },
  { name: 'PaymentService.escrow', type: 'integration', status: 'pass', time: '45ms' },
  { name: 'EvidenceService.upload', type: 'integration', status: 'fail', time: '120ms' },
  { name: 'API.endpoints.flow', type: 'e2e', status: 'pass', time: '340ms' },
  { name: 'Webhooks.delivery', type: 'e2e', status: 'pass', time: '85ms' },
];

const stats = { passed: 42, failed: 3, skipped: 5, total: 50 };

export default function DevTesting() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Pruebas y Testing</h1>
        <p className="text-sm text-slate-400 mt-1">Estado de las pruebas del sistema.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0F1D32] border border-emerald-500/20 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{stats.passed}</p>
          <p className="text-[10px] text-slate-400">Aprobadas</p>
        </div>
        <div className="bg-[#0F1D32] border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-red-400">{stats.failed}</p>
          <p className="text-[10px] text-slate-400">Fallidas</p>
        </div>
        <div className="bg-[#0F1D32] border border-slate-500/20 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-slate-400">{stats.skipped}</p>
          <p className="text-[10px] text-slate-400">Omitidas</p>
        </div>
        <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-white">{stats.total}</p>
          <p className="text-[10px] text-slate-400">Total</p>
        </div>
      </div>

      {/* Tests */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-white/5 text-[10px] text-slate-500 uppercase tracking-wide">
          <div className="col-span-5">Test</div>
          <div className="col-span-2">Tipo</div>
          <div className="col-span-3">Estado</div>
          <div className="col-span-2">Tiempo</div>
        </div>
        {tests.map((t, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-white/5 last:border-0 items-center hover:bg-white/5 transition-colors">
            <div className="col-span-5 text-xs text-slate-300 font-mono">{t.name}</div>
            <div className="col-span-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                t.type === 'unit' ? 'bg-blue-500/10 text-blue-400' :
                t.type === 'integration' ? 'bg-purple-500/10 text-purple-400' :
                'bg-amber-500/10 text-amber-400'
              }`}>{t.type}</span>
            </div>
            <div className="col-span-3">
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                t.status === 'pass' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {t.status === 'pass' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {t.status === 'pass' ? 'Aprobado' : 'Fallido'}
              </span>
            </div>
            <div className="col-span-2 text-[10px] text-slate-400">{t.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
