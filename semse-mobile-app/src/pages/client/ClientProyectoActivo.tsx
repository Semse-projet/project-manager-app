import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, CheckCircle, Clock, AlertCircle, Image, MessageCircle, DollarSign, ChevronRight, Star } from 'lucide-react';
import { useClientPayments } from '@/hooks/useClientPayments';
import { useClientProject } from '@/hooks/useClientProject';

type TabType = 'resumen' | 'hitos' | 'evidencias' | 'pagos' | 'chat';

const tabs: { id: TabType; label: string; icon: typeof TrendingUp }[] = [
  { id: 'resumen', label: 'Resumen', icon: TrendingUp },
  { id: 'hitos', label: 'Hitos', icon: CheckCircle },
  { id: 'evidencias', label: 'Evidencias', icon: Image },
  { id: 'pagos', label: 'Pagos', icon: DollarSign },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
];

export default function ClientProyectoActivo() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('resumen');
  const { project } = useClientProject();
  const { payments } = useClientPayments();

  if (!project) {
    return (
      <div className="bg-[#F5F7FA] min-h-screen px-4 py-10">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#1A2B3C]">No hay proyecto activo</p>
          <p className="text-xs text-[#8B9DAB] mt-1">Cuando exista un proyecto en curso aparecerá aquí.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Project Header */}
      <div className="bg-white px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0D7377]/10 text-[#0D7377]">
            En progreso
          </span>
          <span className="text-xs text-[#8B9DAB]">35% completado</span>
        </div>
        <h2 className="text-lg font-bold text-[#1A2B3C]">{project.title}</h2>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-8 h-8 rounded-full bg-[#0D7377]/10 flex items-center justify-center">
            <span className="text-xs font-bold text-[#0D7377]">{project.avatar}</span>
          </div>
          <div>
            <p className="text-xs font-medium text-[#1A2B3C]">{project.professional}</p>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-[10px] text-[#5A6B7D]">4.9 • Profesional verificado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white px-4 pb-4">
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#0D7377] rounded-full" style={{ width: `${project.progress}%` }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-[#8B9DAB]">Inicio: {project.startDate}</span>
          <span className="text-[10px] text-[#8B9DAB]">Fin estimado: {project.endDate}</span>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'resumen' && (
        <div className="px-4 py-3 space-y-3">
          {/* Budget */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[#8B9DAB]">Presupuesto total</p>
                <p className="text-xl font-bold text-[#1A2B3C]">${project.budget.toLocaleString()} USD</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#8B9DAB]">Restante</p>
                <p className="text-lg font-semibold text-[#0D7377]">$1,995 USD</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[#1A2B3C] mb-3">Actividad reciente</h3>
            <div className="space-y-3">
              {project.activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    act.type === 'milestone' ? 'bg-emerald-50' :
                    act.type === 'evidence' ? 'bg-blue-50' : 'bg-purple-50'
                  }`}>
                    {act.type === 'milestone' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    {act.type === 'evidence' && <Image className="w-4 h-4 text-blue-500" />}
                    {act.type === 'message' && <MessageCircle className="w-4 h-4 text-purple-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1A2B3C]">{act.title}</p>
                    <p className="text-xs text-[#8B9DAB]">{act.description}</p>
                    <p className="text-[10px] text-[#CBD5E1] mt-0.5">{act.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'hitos' && (
        <div className="px-4 py-3 space-y-2.5">
          {project.milestones.map((ms, idx) => {
            const statusConfig = {
              completed: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Completado' },
              in_progress: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', label: 'En progreso' },
              pending: { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-50', label: 'Pendiente' },
            };
            const config = statusConfig[ms.status];
            const Icon = config.icon;
            return (
              <button
                key={ms.id}
                onClick={() => ms.status === 'in_progress' && navigate('/cliente/aprobar')}
                className={`w-full bg-white rounded-xl p-4 shadow-sm text-left active:scale-[0.98] transition-transform stagger-${idx + 1}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#1A2B3C]">{ms.title}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#5A6B7D] mt-0.5">{ms.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-semibold text-[#0D7377]">${ms.amount} USD</span>
                      <span className="text-[10px] text-[#8B9DAB]">{ms.evidenceCount} evidencias</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'evidencias' && (
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className={`aspect-square rounded-xl overflow-hidden bg-gray-200 stagger-${idx + 1}`}>
                <img src={`https://picsum.photos/400/400?random=${20 + idx}`} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <button className="mt-4 w-full py-3 bg-white text-[#0D7377] text-sm font-medium rounded-xl border border-[#0D7377]">
            Ver todas las evidencias
          </button>
        </div>
      )}

      {activeTab === 'pagos' && (
        <div className="px-4 py-3 space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  p.status === 'released' ? 'bg-emerald-50' : p.status === 'funded' ? 'bg-amber-50' : 'bg-gray-50'
                }`}>
                  <DollarSign className={`w-5 h-5 ${
                    p.status === 'released' ? 'text-emerald-500' : p.status === 'funded' ? 'text-amber-500' : 'text-gray-400'
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A2B3C]">{p.concept}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    p.status === 'released' ? 'bg-emerald-50 text-emerald-600' :
                    p.status === 'funded' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {p.status === 'released' ? 'Liberado' : p.status === 'funded' ? 'En escrow' : 'Pendiente'}
                  </span>
                </div>
              </div>
              <span className="text-sm font-semibold text-[#1A2B3C]">${p.amount}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="px-4 py-3">
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0D7377]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-[#0D7377]">CP</span>
              </div>
              <div className="bg-[#F5F7FA] rounded-xl rounded-tl-none px-3 py-2">
                <p className="text-xs text-[#1A2B3C]">Hola María, vi tu proyecto y me interesa participar. ¿Podemos agendar una llamada?</p>
              </div>
            </div>
            <div className="flex items-start gap-2 flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-purple-500">M</span>
              </div>
              <div className="bg-[#0D7377] rounded-xl rounded-tr-none px-3 py-2">
                <p className="text-xs text-white">Sí, he trabajado en varios proyectos similares. ¿Cuándo te queda bien?</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="Escribe un mensaje..."
              className="flex-1 h-11 px-4 bg-white rounded-xl text-sm border border-gray-100 focus:outline-none focus:border-[#0D7377]"
            />
            <button className="w-11 h-11 bg-[#0D7377] rounded-xl flex items-center justify-center">
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Tabs */}
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 pt-1 pb-2 z-30">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-colors ${
                  active ? 'text-[#0D7377]' : 'text-[#8B9DAB]'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
                {active && <div className="w-1 h-1 rounded-full bg-[#0D7377] mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
