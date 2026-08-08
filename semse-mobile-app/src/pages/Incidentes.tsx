import { useState } from 'react';
import { Plus, Clock } from 'lucide-react';
import { useWorkerIncidents } from '@/hooks/useWorkerIncidents';

type FilterType = 'todos' | 'open' | 'resolved';

const filters: { id: FilterType; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'open', label: 'Abiertos' },
  { id: 'resolved', label: 'Resueltos' },
];

export default function Incidentes() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const { incidents } = useWorkerIncidents();

  const filtered = incidents.filter((i) => {
    if (activeFilter === 'todos') return true;
    return i.status === activeFilter;
  });

  const severityConfig = {
    high: { border: 'border-l-red-500', badge: 'bg-red-50 text-red-500', label: 'Alto' },
    medium: { border: 'border-l-amber-500', badge: 'bg-amber-50 text-amber-500', label: 'Medio' },
    low: { border: 'border-l-blue-500', badge: 'bg-blue-50 text-blue-500', label: 'Bajo' },
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

      {/* Incidents List */}
      <div className="px-4 py-2 space-y-2.5">
        {filtered.map((incident, idx) => {
          const sev = severityConfig[incident.severity];
          return (
            <div key={incident.id} className={`bg-white rounded-xl shadow-sm border-l-4 ${sev.border} p-4 stagger-${idx + 1}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sev.badge}`}>
                  {sev.label}
                </span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  incident.status === 'open' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {incident.status === 'open' ? 'Abierto' : 'Resuelto'}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[#1A2B3C]">{incident.title}</h3>
              <p className="text-xs text-[#5A6B7D] mt-1 line-clamp-2">{incident.description}</p>
              <div className="flex items-center gap-1 mt-2.5">
                <Clock className="w-3 h-3 text-[#8B9DAB]" />
                <span className="text-[10px] text-[#8B9DAB]">{incident.date}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAB */}
      <button className="fixed right-4 bottom-20 w-14 h-14 bg-red-500 rounded-full shadow-lg shadow-red-500/30 flex items-center justify-center active:scale-90 transition-transform z-40">
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
