import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, DollarSign, ChevronRight, Star, Users, CheckCircle } from 'lucide-react';
import { useClientJobs } from '@/hooks/useClientJobs';
import { useClientProposals } from '@/hooks/useClientProposals';

type TabType = 'detalle' | 'propuestas';

export default function ClientDetalleJob() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('detalle');
  const { jobs: clientJobs } = useClientJobs();
  const { proposals } = useClientProposals();
  const job = clientJobs[0];

  if (!job) {
    return (
      <div className="bg-[#F5F7FA] min-h-screen px-4 py-10">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#1A2B3C]">No hay trabajo seleccionado</p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'detalle', label: 'Detalle' },
    { id: 'propuestas', label: `Propuestas (${proposals.length})` },
  ];

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Job Header */}
      <div className="bg-white px-4 pt-3 pb-4">
        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0D7377]/10 text-[#0D7377]">
          Activo
        </span>
        <h2 className="text-lg font-bold text-[#1A2B3C] mt-2">{job.title}</h2>
        <p className="text-sm text-[#5A6B7D] mt-1">Publicado el {job.date}</p>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#8B9DAB]" />
            <span className="text-xs text-[#5A6B7D]">{job.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#8B9DAB]" />
            <span className="text-xs text-[#5A6B7D]">{job.budget}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#0D7377] text-[#0D7377]'
                  : 'border-transparent text-[#8B9DAB]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Detalle Tab */}
      {activeTab === 'detalle' && (
        <div className="px-4 py-3 space-y-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[#1A2B3C] mb-2">Descripción</h3>
            <p className="text-sm text-[#5A6B7D] leading-relaxed">{job.description}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[#1A2B3C] mb-2">Alcance del trabajo</h3>
            <div className="grid grid-cols-2 gap-2">
              {['Demolición', 'Carpintería', 'Instalación eléctrica', 'Fontanería', 'Acabados', 'Pintura'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#0D7377]" />
                  <span className="text-xs text-[#5A6B7D]">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate('/cliente/comparar')}
            className="w-full py-4 bg-[#0D7377] text-white font-semibold text-sm rounded-xl shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" />
            Comparar profesionistas ({proposals.length})
          </button>
        </div>
      )}

      {/* Propuestas Tab */}
      {activeTab === 'propuestas' && (
        <div className="px-4 py-3 space-y-2.5">
          {proposals.map((prop, idx) => (
            <button
              key={prop.id}
              onClick={() => navigate('/cliente/match')}
              className={`w-full bg-white rounded-xl p-4 shadow-sm text-left active:scale-[0.98] transition-transform stagger-${idx + 1}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-[#0D7377]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-[#0D7377]">{prop.avatar}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#1A2B3C]">{prop.professionalName}</p>
                    {prop.verified && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                        Verificado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5A6B7D]">{prop.company}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-medium text-[#1A2B3C]">{prop.rating}</span>
                    <span className="text-xs text-[#8B9DAB]">({prop.reviews} reseñas)</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                    <span className="text-sm font-bold text-[#0D7377]">${prop.price.toLocaleString()} USD</span>
                    <span className="text-xs text-[#8B9DAB]">{prop.deliveryDays} días</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#CBD5E1] flex-shrink-0 mt-2" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
