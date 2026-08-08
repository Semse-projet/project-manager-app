import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Play, Plus } from 'lucide-react';
import { useWorkerEvidence } from '@/hooks/useWorkerEvidence';

type FilterType = 'todos' | 'fotos' | 'videos' | 'documentos';

export default function Evidencias() {
  const navigate = useNavigate();
  const { evidences: allEvidences } = useWorkerEvidence();
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');

  const filters: { id: FilterType; label: string; count: number }[] = [
    { id: 'todos', label: 'Todos', count: allEvidences.length },
    { id: 'fotos', label: 'Fotos', count: allEvidences.filter((ev) => ev.type === 'photo').length },
    { id: 'videos', label: 'Videos', count: allEvidences.filter((ev) => ev.type === 'video').length },
    { id: 'documentos', label: 'Documentos', count: allEvidences.filter((ev) => ev.type === 'document').length },
  ];

  const filteredEvidences = allEvidences.filter((ev) => {
    if (activeFilter === 'todos') return true;
    if (activeFilter === 'fotos') return ev.type === 'photo';
    if (activeFilter === 'videos') return ev.type === 'video';
    if (activeFilter === 'documentos') return ev.type === 'document';
    return true;
  });

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Filter Tabs */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`flex items-center gap-2 flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                activeFilter === filter.id
                  ? 'bg-[#0D7377] text-white'
                  : 'bg-white text-[#5A6B7D] border border-gray-200'
              }`}
            >
              {filter.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeFilter === filter.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-[#8B9DAB]'
              }`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Media Grid */}
      <div className="px-4 py-2">
        {filteredEvidences.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredEvidences.map((ev, idx) => (
              <button
                key={ev.id}
                className={`relative aspect-square rounded-xl overflow-hidden active:scale-95 transition-transform stagger-${idx + 1}`}
              >
                <img src={ev.url} alt={ev.description} className="w-full h-full object-cover" />
                {ev.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-5 h-5 text-[#1A2B3C] ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
                    {ev.type === 'photo' ? 'Foto' : ev.type === 'video' ? 'Video' : 'Doc'}
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-[11px] text-white font-medium truncate">{ev.description}</p>
                  <p className="text-[10px] text-white/70">{ev.date}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-16">
            <Camera className="w-14 h-14 text-[#CBD5E1] mb-3" />
            <p className="text-sm font-medium text-[#8B9DAB]">Sin evidencias</p>
            <p className="text-xs text-[#CBD5E1] mt-1">Toca el botón + para agregar</p>
          </div>
        )}
      </div>

      {/* Add Button */}
      <button
        onClick={() => navigate('/nueva-evidencia')}
        className="fixed right-4 bottom-20 w-14 h-14 bg-[#0D7377] rounded-full shadow-lg shadow-[#0D7377]/30 flex items-center justify-center active:scale-90 transition-transform z-40"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
