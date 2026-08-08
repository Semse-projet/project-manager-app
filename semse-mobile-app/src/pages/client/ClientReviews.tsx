import { useState } from 'react';
import { Star, Send } from 'lucide-react';

export default function ClientReviews() {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const categories = [
    { label: 'Calidad del trabajo', rating: 5 },
    { label: 'Comunicación', rating: 5 },
    { label: 'Cumplimiento de tiempos', rating: 4 },
  ];

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Professional Info */}
      <div className="bg-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-[#0D7377]/10 flex items-center justify-center">
            <span className="text-lg font-bold text-[#0D7377]">CP</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1A2B3C]">ConstruPro MX</h2>
            <p className="text-xs text-[#5A6B7D]">Proyecto: Remodelación de cocina</p>
          </div>
        </div>

        <div className="bg-[#F5F7FA] rounded-xl p-4">
          <p className="text-sm font-medium text-[#1A2B3C] mb-1">¿Cómo fue tu experiencia?</p>
          <p className="text-xs text-[#8B9DAB]">Califica al profesional para ayudar a otros clientes</p>
        </div>
      </div>

      {/* Star Rating */}
      <div className="px-4 py-3">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-[#1A2B3C] text-center mb-3">Selecciona una calificación</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setRating(s)}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform active:scale-90"
              >
                <Star
                  className={`w-10 h-10 ${
                    s <= (hoverRating || rating)
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-gray-200'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-xs text-center text-[#8B9DAB] mt-2">
            {rating === 0 ? 'Toca una estrella para calificar' :
             rating === 1 ? 'Mala' :
             rating === 2 ? 'Regular' :
             rating === 3 ? 'Buena' :
             rating === 4 ? 'Muy buena' : 'Excelente'}
          </p>
        </div>
      </div>

      {/* Category Ratings */}
      <div className="px-4 py-2">
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          {categories.map((cat) => (
            <div key={cat.label}>
              <p className="text-sm text-[#1A2B3C] mb-1">{cat.label}</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-5 h-5 ${
                      s <= cat.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Comentario (opcional)</label>
        <textarea
          placeholder="Muy buen trabajo y comunicación. Totalmente recomendado..."
          rows={4}
          className="w-full p-4 bg-white rounded-xl text-sm text-[#1A2B3C] placeholder:text-[#CBD5E1] border border-gray-100 focus:outline-none focus:border-[#0D7377] focus:ring-2 focus:ring-[#0D7377]/10 resize-none"
        />
      </div>

      {/* Submit */}
      <div className="px-4 py-4 pb-8">
        <button className="w-full py-4 bg-[#0D7377] text-white font-semibold text-sm rounded-xl shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />
          Enviar calificación
        </button>
      </div>
    </div>
  );
}
