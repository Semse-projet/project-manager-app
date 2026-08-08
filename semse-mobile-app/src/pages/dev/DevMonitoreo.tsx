import { TrendingUp, TrendingDown } from 'lucide-react';

const metrics = [
  { label: 'Requests', value: '42,521', change: '+12.5%', up: true },
  { label: 'Errores', value: '1.2%', change: '-0.3%', up: false },
  { label: 'Latencia P95', value: '245ms', change: '+8ms', up: true },
];

const timeData = [
  { time: '00:00', value: 20 },
  { time: '04:00', value: 15 },
  { time: '08:00', value: 45 },
  { time: '12:00', value: 85 },
  { time: '16:00', value: 65 },
  { time: '20:00', value: 40 },
  { time: '24:00', value: 25 },
];

export default function DevMonitoreo() {
  const maxVal = Math.max(...timeData.map((d) => d.value));

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Monitoreo</h1>
            <p className="text-sm text-slate-400 mt-1">Métricas de rendimiento del sistema.</p>
          </div>
          <select className="h-8 px-3 bg-[#0F1D32] rounded-lg text-xs text-slate-300 border border-white/5">
            <option>Últimas 24 horas</option>
            <option>Última semana</option>
            <option>Último mes</option>
          </select>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {metrics.map((m) => (
          <div key={m.label} className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{m.label}</p>
            <p className="text-lg font-bold text-white mt-1">{m.value}</p>
            <span className={`flex items-center gap-0.5 text-[10px] font-medium mt-1 ${m.up ? 'text-emerald-400' : 'text-red-400'}`}>
              {m.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {m.change}
            </span>
          </div>
        ))}
      </div>

      {/* Requests per minute chart */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Requests por minuto</h3>
        <svg viewBox="0 0 600 150" className="w-full h-32">
          <polyline
            fill="none"
            stroke="#14A0A0"
            strokeWidth="2"
            points={timeData.map((d, i) => `${i * 100},${150 - (d.value / maxVal) * 130}`).join(' ')}
          />
          {timeData.map((d, i) => (
            <circle key={i} cx={i * 100} cy={150 - (d.value / maxVal) * 130} r="4" fill="#14A0A0" />
          ))}
          {timeData.map((d, i) => (
            <text key={`t-${i}`} x={i * 100} y="145" textAnchor="middle" fill="#64748b" fontSize="10">{d.time}</text>
          ))}
        </svg>
      </div>

      <button className="w-full py-3 bg-[#14A0A0]/10 text-[#14A0A0] text-sm font-medium rounded-xl border border-[#14A0A0]/20">
        Ver métricas detalladas
      </button>
    </div>
  );
}
