import { TrendingUp, Activity, Users, Boxes, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const stats = [
  { label: 'Proyectos activos', value: '24', change: '+12%', up: true, icon: Boxes },
  { label: 'Servicios', value: '12', change: '+3%', up: true, icon: Zap },
  { label: 'Componentes', value: '5', change: '0%', up: true, icon: Activity },
  { label: 'Módulos', value: '18', change: '+2', up: true, icon: Users },
];

const apiUsage = [
  { day: 'Lun', requests: 2800 },
  { day: 'Mar', requests: 4500 },
  { day: 'Mié', requests: 3200 },
  { day: 'Jue', requests: 5100 },
  { day: 'Vie', requests: 3800 },
  { day: 'Sáb', requests: 2100 },
  { day: 'Dom', requests: 1800 },
];

const services = [
  { name: 'API Gateway', status: 'online', latency: '12ms' },
  { name: 'Auth Service', status: 'online', latency: '8ms' },
  { name: 'Project Service', status: 'degraded', latency: '245ms' },
  { name: 'Payment Service', status: 'online', latency: '18ms' },
  { name: 'Evidence Service', status: 'online', latency: '6ms' },
  { name: 'Autonomy Server', status: 'online', latency: '32ms' },
];

const recentAccess = [
  { doc: 'Documentación', date: 'Hace 2h', icon: 'D' },
  { doc: 'API Explorer', date: 'Hace 4h', icon: 'E' },
  { doc: 'Ambientes', date: 'Hace 6h', icon: 'A' },
  { doc: 'Webhooks', date: 'Ayer', icon: 'W' },
];

export default function DevDashboard() {
  const maxRequests = Math.max(...apiUsage.map((d) => d.requests));

  return (
    <div>
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">¡Hola, Desarrollador! 👋</h1>
        <p className="text-sm text-slate-400 mt-1">Bienvenido a tu centro de desarrollo.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-5 h-5 text-[#14A0A0]" />
                <span className={`flex items-center gap-0.5 text-[10px] font-medium ${stat.up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* API Usage Chart */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Uso de API (30 días)</h3>
            <div className="flex items-center gap-2 mt-1">
              <TrendingUp className="w-4 h-4 text-[#14A0A0]" />
              <span className="text-lg font-bold text-white">42,521</span>
              <span className="text-[10px] text-slate-400">Requests</span>
            </div>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">+12.5% vs mes anterior</span>
        </div>
        <div className="flex items-end gap-2 h-32">
          {apiUsage.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-[#14A0A0]/40 rounded-t-sm transition-all hover:bg-[#14A0A0]"
                style={{ height: `${(d.requests / maxRequests) * 100}%` }}
              />
              <span className="text-[10px] text-slate-400">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Services + Recent Access */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Service Status */}
        <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Estado de servicios</h3>
          <div className="space-y-2">
            {services.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    svc.status === 'online' ? 'bg-emerald-400' : svc.status === 'degraded' ? 'bg-amber-400' : 'bg-red-400'
                  }`} />
                  <span className="text-xs text-slate-300">{svc.name}</span>
                </div>
                <span className={`text-[10px] font-medium ${
                  svc.status === 'online' ? 'text-emerald-400' : svc.status === 'degraded' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {svc.latency}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Access */}
        <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Accesos rápidos</h3>
          <div className="space-y-2">
            {recentAccess.map((acc) => (
              <button key={acc.doc} className="w-full flex items-center gap-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg px-2 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#14A0A0]/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-[#14A0A0]">{acc.icon}</span>
                </div>
                <div className="text-left flex-1">
                  <p className="text-xs text-slate-300">{acc.doc}</p>
                  <p className="text-[10px] text-slate-500">{acc.date}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Quick Links Grid */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {['SDKs', 'Changelog', 'Ambientes', 'Webhooks'].map((label) => (
              <div key={label} className="bg-[#0B1628] rounded-lg p-3 flex flex-col items-center gap-1">
                <Boxes className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] text-slate-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
