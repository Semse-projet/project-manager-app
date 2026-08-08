import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Phone, MessageCircle, Calendar, Building2, FileText, ClipboardList, Camera, CreditCard, ChevronRight } from 'lucide-react';
import { useWorkerJobDetail } from '@/hooks/useWorkerJobDetail';

type TabType = 'info' | 'tareas' | 'evidencias' | 'pagos';

const tabs: { id: TabType; label: string; icon: typeof MapPin }[] = [
  { id: 'info', label: 'Información', icon: FileText },
  { id: 'tareas', label: 'Tareas', icon: ClipboardList },
  { id: 'evidencias', label: 'Evidencias', icon: Camera },
  { id: 'pagos', label: 'Pagos', icon: CreditCard },
];

export default function DetalleTrabajo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const { job } = useWorkerJobDetail(id);

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-[#8B9DAB]">Trabajo no encontrado</p>
      </div>
    );
  }

  const statusConfig = {
    active: { label: 'En progreso', color: 'bg-[#0D7377]/10 text-[#0D7377]', bg: 'bg-[#0D7377]' },
    scheduled: { label: 'Programado', color: 'bg-blue-50 text-blue-600', bg: 'bg-blue-500' },
    completed: { label: 'Completado', color: 'bg-emerald-50 text-emerald-600', bg: 'bg-emerald-500' },
    pending: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600', bg: 'bg-amber-500' },
    cancelled: { label: 'Cancelado', color: 'bg-red-50 text-red-600', bg: 'bg-red-500' },
  };

  const config = statusConfig[job.status] || statusConfig.pending;

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Job Title Card */}
      <div className="bg-white px-4 pt-3 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${config.color}`}>
            {config.label}
          </span>
        </div>
        <h2 className="text-lg font-bold text-[#1A2B3C]">{job.title}</h2>
        <p className="text-sm text-[#5A6B7D] mt-1">{job.location}</p>

        {job.status === 'active' && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#8B9DAB]">Progreso del trabajo</span>
              <span className="text-xs font-semibold text-[#0D7377]">{job.progress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0D7377] rounded-full transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Info Grid */}
      {activeTab === 'info' && (
        <div className="px-4 py-3 space-y-2.5">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-50 mt-0.5">
                  <Building2 className="w-4 h-4 text-[#0D7377]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#8B9DAB] uppercase tracking-wide">Cliente</p>
                  <p className="text-sm font-medium text-[#1A2B3C] mt-0.5">{job.client}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 mt-0.5">
                  <MapPin className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] text-[#8B9DAB] uppercase tracking-wide">Ubicación</p>
                  <p className="text-sm font-medium text-[#1A2B3C] mt-0.5">{job.location}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50 mt-0.5">
                  <Calendar className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] text-[#8B9DAB] uppercase tracking-wide">Fecha y hora</p>
                  <p className="text-sm font-medium text-[#1A2B3C] mt-0.5">{job.date}</p>
                  <p className="text-xs text-[#5A6B7D]">{job.time}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[10px] text-[#8B9DAB] uppercase tracking-wide mb-1.5">Descripción</p>
              <p className="text-sm text-[#1A2B3C] leading-relaxed">{job.description}</p>
            </div>
          </div>

          {/* Supervisor Card */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-[10px] text-[#8B9DAB] uppercase tracking-wide mb-3">Supervisor</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#0D7377]/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-[#0D7377]">{job.supervisor.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A2B3C]">{job.supervisor.name}</p>
                  <p className="text-xs text-[#5A6B7D]">Supervisor de obra</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center justify-center w-9 h-9 rounded-full bg-teal-50 active:bg-teal-100">
                  <Phone className="w-4 h-4 text-[#0D7377]" />
                </button>
                <button className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 active:bg-blue-100">
                  <MessageCircle className="w-4 h-4 text-blue-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => navigate('/tareas')}
              className="flex items-center justify-between w-full p-4 text-left border-b border-gray-50 active:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50">
                  <ClipboardList className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A2B3C]">Tareas</p>
                  <p className="text-xs text-[#8B9DAB]">{job.tasks.length} tareas</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8B9DAB]" />
            </button>
            <button
              onClick={() => navigate('/evidencias')}
              className="flex items-center justify-between w-full p-4 text-left border-b border-gray-50 active:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-50">
                  <Camera className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A2B3C]">Evidencias</p>
                  <p className="text-xs text-[#8B9DAB]">{job.evidences.length} archivos</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8B9DAB]" />
            </button>
            <button
              onClick={() => navigate('/materiales')}
              className="flex items-center justify-between w-full p-4 text-left active:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50">
                  <FileText className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A2B3C]">Materiales</p>
                  <p className="text-xs text-[#8B9DAB]">{job.materials.length} items</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8B9DAB]" />
            </button>
          </div>

          {/* Complete Button */}
          {job.status === 'active' && (
            <button className="w-full py-4 bg-[#0D7377] text-white font-semibold text-sm rounded-xl shadow-md active:scale-[0.98] transition-transform">
              Marcar como completado
            </button>
          )}
        </div>
      )}

      {/* Tareas Tab */}
      {activeTab === 'tareas' && (
        <div className="px-4 py-3 space-y-2.5">
          {job.tasks.map((task, idx) => (
            <div key={task.id} className={`bg-white rounded-xl p-4 shadow-sm stagger-${idx + 1}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  task.completed
                    ? 'bg-[#0D7377] border-[#0D7377]'
                    : 'border-gray-300'
                }`}>
                  {task.completed && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm ${task.completed ? 'text-[#8B9DAB] line-through' : 'text-[#1A2B3C] font-medium'}`}>
                    {task.title}
                  </p>
                  <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    task.priority === 'high' ? 'bg-red-50 text-red-500' :
                    task.priority === 'medium' ? 'bg-amber-50 text-amber-500' :
                    'bg-emerald-50 text-emerald-500'
                  }`}>
                    {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Evidencias Tab */}
      {activeTab === 'evidencias' && (
        <div className="px-4 py-3">
          {job.evidences.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {job.evidences.map((ev, idx) => (
                <button
                  key={ev.id}
                  onClick={() => navigate('/evidencias')}
                  className={`relative aspect-square rounded-xl overflow-hidden active:scale-95 transition-transform stagger-${idx + 1}`}
                >
                  <img src={ev.url} alt={ev.description} className="w-full h-full object-cover" />
                  {ev.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                        <div className="w-0 h-0 border-t-6 border-b-6 border-l-8 border-transparent border-l-[#1A2B3C] ml-1" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-[10px] text-white font-medium truncate">{ev.description}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12">
              <Camera className="w-12 h-12 text-[#CBD5E1] mb-3" />
              <p className="text-sm text-[#8B9DAB]">Sin evidencias aún</p>
            </div>
          )}
        </div>
      )}

      {/* Pagos Tab */}
      {activeTab === 'pagos' && (
        <div className="px-4 py-3">
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <p className="text-xs text-[#8B9DAB] mb-1">Pago estimado</p>
            <p className="text-2xl font-bold text-[#1A2B3C]">$850.00</p>
            <p className="text-xs text-[#8B9DAB] mt-1">Al completar el trabajo</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
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
                {active && <div className="w-1 h-1 rounded-full bg-[#0D7377] mt-1" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
