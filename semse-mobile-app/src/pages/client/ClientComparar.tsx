import { useNavigate } from 'react-router-dom';
import { Star, DollarSign, Clock, ShieldCheck } from 'lucide-react';
import { useClientProposals } from '@/hooks/useClientProposals';

export default function ClientComparar() {
  const navigate = useNavigate();
  const { proposals } = useClientProposals();

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold text-[#1A2B3C]">Comparar profesionales</h2>
        <p className="text-sm text-[#8B9DAB] mt-1">Selecciona hasta 3 para comparar</p>
      </div>

      {/* Comparison Cards */}
      <div className="px-4 py-2 space-y-3">
        {proposals.slice(0, 3).map((prop, idx) => (
          <div key={prop.id} className={`bg-white rounded-xl p-4 shadow-sm stagger-${idx + 1}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-[#0D7377]/10 flex items-center justify-center">
                <span className="text-base font-bold text-[#0D7377]">{prop.avatar}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#1A2B3C]">{prop.professionalName}</p>
                  {prop.verified && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                </div>
                <p className="text-xs text-[#5A6B7D]">{prop.company}</p>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-medium">{prop.rating}</span>
                  <span className="text-xs text-[#8B9DAB]">({prop.reviews})</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-[#F5F7FA] rounded-lg p-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <DollarSign className="w-3 h-3 text-[#0D7377]" />
                  <span className="text-sm font-bold text-[#1A2B3C]">${prop.price.toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-[#8B9DAB]">Precio total</p>
              </div>
              <div className="text-center border-x border-gray-200">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-blue-500" />
                  <span className="text-sm font-bold text-[#1A2B3C]">{prop.deliveryDays}</span>
                </div>
                <p className="text-[10px] text-[#8B9DAB]">Días</p>
              </div>
              <div className="text-center">
                <span className="text-sm font-bold text-[#1A2B3C]">12</span>
                <p className="text-[10px] text-[#8B9DAB]">Garantía (meses)</p>
              </div>
            </div>

            <p className="text-xs text-[#5A6B7D] mt-3 line-clamp-2">{prop.message}</p>

            <button
              onClick={() => navigate('/cliente/match')}
              className="mt-3 w-full py-2.5 bg-[#0D7377] text-white text-xs font-semibold rounded-lg active:scale-[0.98] transition-transform"
            >
              Seleccionar profesional
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
