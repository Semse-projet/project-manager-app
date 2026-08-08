import { useState } from 'react';
import { ShieldAlert, Plus, CheckCircle, MessageCircle } from 'lucide-react';

const disputes = [
  {
    id: 'd1',
    title: 'Retraso en instalación eléctrica',
    description: 'Hola María, veo retrasada la instalación eléctrica del hito 2...',
    status: 'active',
    date: '20/03/2024',
    responses: 3,
  },
  {
    id: 'd2',
    title: 'Hito 1 - Demolición',
    description: 'Resuelta: Se acordó compensación por el retraso.',
    status: 'resolved',
    date: '18/03/2024',
    responses: 5,
  },
];

export default function ClientDisputas() {
  const [activeFilter, setActiveFilter] = useState('todos');
  const filters = [
    { id: 'todos', label: 'Todas' },
    { id: 'active', label: 'Activas' },
    { id: 'resolved', label: 'Resueltas' },
  ];

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold text-[#1A2B3C]">Disputas</h2>
        <p className="text-sm text-[#8B9DAB] mt-1">Inicia una disputa y nuestro equipo intervendrá</p>
      </div>

      {/* Filters */}
      <div className="px-4 py-2">
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                activeFilter === f.id ? 'bg-[#0D7377] text-white' : 'bg-white text-[#5A6B7D] border border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Disputes */}
      <div className="px-4 py-2 space-y-2.5">
        {disputes.map((d, idx) => (
          <div key={d.id} className={`bg-white rounded-xl p-4 shadow-sm stagger-${idx + 1}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                d.status === 'active' ? 'bg-amber-50' : 'bg-emerald-50'
              }`}>
                {d.status === 'active' ? <ShieldAlert className="w-5 h-5 text-amber-500" /> : <CheckCircle className="w-5 h-5 text-emerald-500" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    d.status === 'active' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {d.status === 'active' ? 'En revisión' : 'Resuelta'}
                  </span>
                  <span className="text-[10px] text-[#8B9DAB]">{d.date}</span>
                </div>
                <h3 className="text-sm font-semibold text-[#1A2B3C]">{d.title}</h3>
                <p className="text-xs text-[#5A6B7D] mt-1 line-clamp-2">{d.description}</p>
                <div className="flex items-center gap-1 mt-2">
                  <MessageCircle className="w-3 h-3 text-[#8B9DAB]" />
                  <span className="text-[10px] text-[#8B9DAB]">{d.responses} respuestas</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Button */}
      <div className="px-4 py-4">
        <button className="w-full py-3.5 bg-[#0D7377] text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md">
          <Plus className="w-4 h-4" />
          Iniciar nueva disputa
        </button>
      </div>
    </div>
  );
}
