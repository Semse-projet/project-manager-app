import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, DollarSign, Users } from 'lucide-react';
import { useClientJobs } from '@/hooks/useClientJobs';

type FilterType = 'todos' | 'active' | 'published' | 'completed';

const filters: { id: FilterType; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'published', label: 'Publicados' },
  { id: 'completed', label: 'Completados' },
];

export default function ClientMisTrabajos() {
  const navigate = useNavigate();
  const { jobs: clientJobs } = useClientJobs();
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');

  const filtered = clientJobs.filter((j) => {
    if (activeFilter === 'todos') return true;
    return j.status === activeFilter;
  });

  const statusConfig = {
    active: { label: 'Activo', bg: 'bg-[#0D7377]/10 text-[#0D7377]' },
    published: { label: 'Publicado', bg: 'bg-blue-50 text-blue-600' },
    completed: { label: 'Completado', bg: 'bg-emerald-50 text-emerald-600' },
  };

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Filter Tabs */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                activeFilter === f.id ? 'bg-[#0D7377] text-white' : 'bg-white text-[#5A6B7D] border border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="px-4 py-2 space-y-3">
        {filtered.map((job, idx) => {
          const st = statusConfig[job.status];
          return (
            <button
              key={job.id}
              onClick={() => navigate('/cliente/detalle-job')}
              className={`w-full bg-white rounded-xl shadow-sm overflow-hidden text-left active:scale-[0.98] transition-transform stagger-${idx + 1}`}
            >
              <img src={job.image} alt={job.title} className="w-full h-28 object-cover" />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg}`}>{st.label}</span>
                  <span className="text-[10px] text-[#8B9DAB]">{job.date}</span>
                </div>
                <h3 className="text-sm font-semibold text-[#1A2B3C]">{job.title}</h3>
                <p className="text-xs text-[#5A6B7D] mt-1 line-clamp-2">{job.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-[10px] text-[#8B9DAB]">
                    <MapPin className="w-3 h-3" /> {job.location}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-[#8B9DAB]">
                    <DollarSign className="w-3 h-3" /> {job.budget}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                  <span className="flex items-center gap-1 text-[10px] text-[#0D7377] font-medium">
                    <Users className="w-3 h-3" />
                    {job.proposals} propuestas
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/cliente/publicar')}
        className="fixed right-4 bottom-20 w-14 h-14 bg-[#0D7377] rounded-full shadow-lg shadow-[#0D7377]/30 flex items-center justify-center active:scale-90 transition-transform z-40"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
