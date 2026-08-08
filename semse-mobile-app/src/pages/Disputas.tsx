import { useState } from 'react';
import { Plus, CheckCircle, XCircle, Clock, ShieldAlert } from 'lucide-react';
import { useWorkerDisputes } from '@/hooks/useWorkerDisputes';

type FilterType = 'todos' | 'open' | 'resolved';

const filters: { id: FilterType; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'open', label: 'Abiertas' },
  { id: 'resolved', label: 'Resueltas' },
];

export default function Disputas() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const { disputes } = useWorkerDisputes();

  const filtered = disputes.filter((d) => {
    if (activeFilter === 'todos') return true;
    if (activeFilter === 'open') return d.status === 'open';
    return d.status !== 'open';
  });

  const statusConfig = {
    open: { icon: Clock, color: 'bg-amber-50 text-amber-600', label: 'Abierta - En revisión' },
    resolved_favor: { icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600', label: 'Resuelta - A mi favor' },
    resolved_against: { icon: XCircle, color: 'bg-red-50 text-red-600', label: 'Resuelta - En contra' },
  };

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Filter Tabs */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                activeFilter === filter.id
                  ? 'bg-[#0D7377] text-white'
                  : 'bg-white text-[#5A6B7D] border border-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Disputes List */}
      <div className="px-4 py-2 space-y-2.5">
        {filtered.map((dispute, idx) => {
          const config = statusConfig[dispute.status as keyof typeof statusConfig] || statusConfig.open;
          const StatusIcon = config.icon;
          return (
            <div key={dispute.id} className={`bg-white rounded-xl p-4 shadow-sm stagger-${idx + 1}`}>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 flex-shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.color} flex items-center gap-1`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#1A2B3C]">{dispute.title}</h3>
                  <p className="text-xs text-[#5A6B7D] mt-1 line-clamp-2">{dispute.description}</p>
                  <p className="text-[10px] text-[#8B9DAB] mt-2">{dispute.date}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Button */}
      <div className="px-4 py-4">
        <button className="w-full py-3.5 bg-white border-2 border-dashed border-gray-200 text-[#1A2B3C] font-medium text-sm rounded-xl flex items-center justify-center gap-2 active:bg-gray-50">
          <Plus className="w-4 h-4" />
          Nueva disputa
        </button>
      </div>
    </div>
  );
}
