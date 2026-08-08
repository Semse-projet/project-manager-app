import { useNavigate } from 'react-router-dom';
import { Star, ShieldCheck, DollarSign, Clock, Award, MessageCircle, CheckCircle } from 'lucide-react';

export default function ClientMatch() {
  const navigate = useNavigate();

  const proposal = {
    name: 'ConstruPro MX',
    company: 'Constructora',
    rating: 4.9,
    reviews: 128,
    verified: true,
    price: 2850,
    deliveryDays: 7,
    warranty: 12,
    materials: true,
    message: 'Ofrecemos garantía de 12 meses en todos nuestros trabajos. Incluye materiales de primera calidad y mano de obra especializada.',
  };

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Professional Header */}
      <div className="bg-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#0D7377]/10 flex items-center justify-center">
            <span className="text-xl font-bold text-[#0D7377]">CP</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#1A2B3C]">{proposal.name}</h2>
              {proposal.verified && <ShieldCheck className="w-5 h-5 text-emerald-500" />}
            </div>
            <p className="text-sm text-[#5A6B7D]">{proposal.company}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-sm font-medium">{proposal.rating}</span>
              <span className="text-xs text-[#8B9DAB]">({proposal.reviews} reseñas)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Proposal Summary */}
      <div className="px-4 py-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#1A2B3C] mb-3">Resumen de la propuesta</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F5F7FA] rounded-lg p-3">
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-[#0D7377]" />
                <span className="text-lg font-bold text-[#1A2B3C]">${proposal.price.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-[#8B9DAB]">Precio total USD</p>
            </div>
            <div className="bg-[#F5F7FA] rounded-lg p-3">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-lg font-bold text-[#1A2B3C]">{proposal.deliveryDays}</span>
              </div>
              <p className="text-[10px] text-[#8B9DAB]">Días estimados</p>
            </div>
            <div className="bg-[#F5F7FA] rounded-lg p-3">
              <div className="flex items-center gap-1">
                <Award className="w-4 h-4 text-amber-500" />
                <span className="text-lg font-bold text-[#1A2B3C]">{proposal.warranty}</span>
              </div>
              <p className="text-[10px] text-[#8B9DAB]">Garantía (meses)</p>
            </div>
            <div className="bg-[#F5F7FA] rounded-lg p-3">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-bold text-[#1A2B3C]">{proposal.materials ? 'Sí' : 'No'}</span>
              </div>
              <p className="text-[10px] text-[#8B9DAB]">Incluye materiales</p>
            </div>
          </div>

          <div className="mt-3 p-3 bg-[#F5F7FA] rounded-lg">
            <p className="text-xs text-[#5A6B7D]">{proposal.message}</p>
          </div>
        </div>
      </div>

      {/* Message */}
      <div className="px-4 py-2">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="text-xs font-medium text-[#1A2B3C] mb-2 block">Mensaje para el profesional (opcional)</label>
          <textarea
            placeholder="Estoy interesado en iniciar el proyecto. Por favor confirme disponibilidad..."
            rows={3}
            className="w-full p-3 bg-[#F5F7FA] rounded-lg text-sm text-[#1A2B3C] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#0D7377]/10 resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-4 pb-8 space-y-2">
        <button
          onClick={() => navigate('/cliente/proyecto-activo')}
          className="w-full py-4 bg-[#0D7377] text-white font-semibold text-sm rounded-xl shadow-md active:scale-[0.98] transition-transform"
        >
          Confirmar selección
        </button>
        <button className="w-full py-3.5 border-2 border-gray-200 text-[#5A6B7D] font-medium text-sm rounded-xl flex items-center justify-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Enviar mensaje
        </button>
      </div>
    </div>
  );
}
