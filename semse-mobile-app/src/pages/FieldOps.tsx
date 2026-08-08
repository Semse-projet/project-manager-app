import { Truck, User, Plus, ClipboardList, ChevronRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useWorkerFieldOps } from '@/hooks/useWorkerFieldOps';

export default function FieldOps() {
  const { units: fieldUnits, checklists } = useWorkerFieldOps();
  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Units Section */}
      <div className="px-4 pt-3 pb-2">
        <h3 className="text-sm font-semibold text-[#1A2B3C] mb-2">Unidades asignadas</h3>
        <div className="space-y-2">
          {fieldUnits.map((unit) => (
            <div key={unit.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#0D7377]/10 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-6 h-6 text-[#0D7377]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#1A2B3C]">{unit.name}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                      Activo
                    </span>
                  </div>
                  <p className="text-xs text-[#5A6B7D] mt-0.5">{unit.type}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <User className="w-3 h-3 text-[#8B9DAB]" />
                    <span className="text-xs text-[#8B9DAB]">Conductor: {unit.driver}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Checklists Section */}
      <div className="px-4 py-2">
        <h3 className="text-sm font-semibold text-[#1A2B3C] mb-2">Checklists</h3>
        <div className="space-y-2">
          {checklists.map((checklist, idx) => {
            const statusConfig = {
              in_progress: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', label: 'En progreso' },
              pending: { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-50', label: 'Pendiente' },
              completed: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Completado' },
            };
            const config = statusConfig[checklist.status];

            return (
              <div key={checklist.id} className={`bg-white rounded-xl p-4 shadow-sm stagger-${idx + 1}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <ClipboardList className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#1A2B3C]">{checklist.title}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    {checklist.status === 'in_progress' && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-[#8B9DAB]">Progreso</span>
                          <span className="text-[10px] font-medium text-amber-500">{checklist.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${checklist.progress}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#CBD5E1] flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Checklist Button */}
      <div className="px-4 py-4">
        <button className="w-full py-3.5 bg-[#0D7377] text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md">
          <Plus className="w-4 h-4" />
          Nuevo checklist
        </button>
      </div>
    </div>
  );
}
