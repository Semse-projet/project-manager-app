import { Mail, Globe, Calendar, ShieldCheck, Activity, Layers } from 'lucide-react';

const profile = {
  name: 'Carlos Rodríguez',
  email: 'carlos.rodriguez@semse.dev',
  role: 'Lead Developer',
  org: 'SEMSE Tech',
  since: '2024',
  token: 'sk_live_********************************',
  endpoints: '12',
  projects: '24',
};

export default function DevPerfil() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Perfil de Desarrollador</h1>
        <p className="text-sm text-slate-400 mt-1">Configuración de tu cuenta de desarrollo.</p>
      </div>

      {/* Profile Card */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-6 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#14A0A0]/10 flex items-center justify-center">
            <span className="text-xl font-bold text-[#14A0A0]">CR</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{profile.name}</h2>
            <p className="text-sm text-slate-400">{profile.role}</p>
            <div className="flex items-center gap-2 mt-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Cuenta verificada</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex items-center gap-3">
          <Mail className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-300">{profile.email}</span>
        </div>
        <div className="flex items-center gap-3">
          <Globe className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-300">{profile.org}</span>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-300">Miembro desde {profile.since}</span>
        </div>
      </div>

      {/* API Key */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4 mb-4">
        <h3 className="text-sm font-semibold text-white mb-2">API Key</h3>
        <code className="block px-3 py-2 bg-[#0B1628] rounded-lg text-xs text-amber-400 font-mono border border-amber-500/20">
          {profile.token}
        </code>
        <button className="mt-2 text-[10px] text-[#14A0A0] hover:underline">Regenerar API Key</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4 text-center">
          <Activity className="w-5 h-5 text-[#14A0A0] mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{profile.endpoints}</p>
          <p className="text-[10px] text-slate-400">Endpoints</p>
        </div>
        <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4 text-center">
          <Layers className="w-5 h-5 text-[#14A0A0] mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{profile.projects}</p>
          <p className="text-[10px] text-slate-400">Proyectos</p>
        </div>
      </div>
    </div>
  );
}
