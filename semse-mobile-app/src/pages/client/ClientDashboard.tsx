import { useNavigate } from 'react-router-dom';
import { ClipboardList, Search, FolderOpen, MessageCircle, Bell, DollarSign, CheckCircle, Clock } from 'lucide-react';
import { useClientJobs } from '@/hooks/useClientJobs';
import { useClientProject } from '@/hooks/useClientProject';

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { jobs: clientJobs, recentActivities, profile: clientProfile } = useClientJobs();
  const { project } = useClientProject();
  const activeJobs = clientJobs.filter((j) => j.status === 'active');
  const publishedJobs = clientJobs.filter((j) => j.status === 'published');
  const inReviewCount = project?.milestones.filter((milestone) => milestone.status === 'in_progress').length ?? 0;

  const stats = [
    { label: 'Proyectos activos', value: String(activeJobs.length), icon: FolderOpen, color: 'text-[#0D7377]', bg: 'bg-teal-50' },
    { label: 'Por agendar', value: String(publishedJobs.length), icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'En revisión', value: String(inReviewCount), icon: ClipboardList, color: 'text-blue-500', bg: 'bg-blue-50' },
  ];

  const quickActions = [
    { label: 'Publicar trabajo', icon: ClipboardList, path: '/cliente/publicar', color: 'bg-[#0D7377]' },
    { label: 'Buscar profesionales', icon: Search, path: '/cliente/trabajos', color: 'bg-blue-500' },
    { label: 'Mis proyectos', icon: FolderOpen, path: '/cliente/trabajos', color: 'bg-amber-500' },
    { label: 'Mensajes', icon: MessageCircle, path: '/mensajes', color: 'bg-purple-500' },
  ];

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Greeting */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#8B9DAB]">¡Hola, {clientProfile?.name.split(' ')[0] ?? 'Cliente'}! 👋</p>
            <p className="text-sm font-semibold text-[#1A2B3C] mt-0.5">Bienvenida a tu espacio</p>
          </div>
          <button className="relative w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
            <Bell className="w-5 h-5 text-[#5A6B7D]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-2">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <button key={stat.label} className="bg-white rounded-xl p-3 shadow-sm flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <span className="text-lg font-bold text-[#1A2B3C]">{stat.value}</span>
                <span className="text-[10px] text-[#8B9DAB] text-center leading-tight">{stat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Jobs */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[#1A2B3C]">Actividad reciente</h2>
          <button onClick={() => navigate('/cliente/trabajos')} className="text-xs text-[#0D7377] font-medium">Ver todos</button>
        </div>
        <div className="space-y-2">
          {recentActivities.map((act, idx) => (
            <div key={act.id} className={`bg-white rounded-xl p-3.5 shadow-sm flex items-center gap-3 stagger-${idx + 1}`}>
              <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                {act.icon === 'file' && <ClipboardList className="w-5 h-5 text-[#0D7377]" />}
                {act.icon === 'check' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                {act.icon === 'dollar' && <DollarSign className="w-5 h-5 text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A2B3C]">{act.title}</p>
                <p className="text-xs text-[#8B9DAB]">{act.detail}</p>
              </div>
              <span className="text-[10px] text-[#8B9DAB] flex-shrink-0">{act.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Active Project Card */}
      {activeJobs.length > 0 && (
        <div className="px-4 py-2">
          <h2 className="text-sm font-semibold text-[#1A2B3C] mb-2">Proyecto en curso</h2>
          <button
            onClick={() => navigate('/cliente/proyecto-activo')}
            className="w-full bg-white rounded-xl shadow-sm overflow-hidden text-left active:scale-[0.98] transition-transform"
          >
            <img src={activeJobs[0].image} alt={activeJobs[0].title} className="w-full h-32 object-cover" />
            <div className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0D7377]/10 text-[#0D7377]">En progreso</span>
                <span className="text-xs text-[#8B9DAB]">{project?.progress ?? 0}% completado</span>
              </div>
              <h3 className="text-sm font-semibold text-[#1A2B3C]">{activeJobs[0].title}</h3>
              <div className="mt-2">
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0D7377] rounded-full" style={{ width: `${project?.progress ?? 0}%` }} />
                </div>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 py-3 pb-6">
        <h2 className="text-sm font-semibold text-[#1A2B3C] mb-2">Accesos rápidos</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.97] transition-transform"
              >
                <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-[#1A2B3C]">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
