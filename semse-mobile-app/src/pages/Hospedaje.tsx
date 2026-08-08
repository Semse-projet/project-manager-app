import { Hotel, MapPin, Calendar, ChevronRight, Plus, CheckCircle, Clock } from 'lucide-react';
import { useWorkerTravel } from '@/hooks/useWorkerTravel';

export default function Hospedaje() {
  const { reservations: hotelReservations } = useWorkerTravel();
  const current = hotelReservations.find((r) => r.status === 'confirmed');
  const others = hotelReservations.filter((r) => r.id !== current?.id);

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Current Reservation */}
      {current && (
        <div className="px-4 pt-3 pb-2">
          <h3 className="text-sm font-semibold text-[#1A2B3C] mb-2">Reserva actual</h3>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-xl bg-[#0D7377]/10 flex items-center justify-center flex-shrink-0">
                <Hotel className="w-7 h-7 text-[#0D7377]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#1A2B3C]">{current.hotelName}</h4>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Confirmada
                  </span>
                </div>
                <p className="text-xs text-[#5A6B7D] mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {current.address}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1 text-xs text-[#5A6B7D]">
                    <Calendar className="w-3 h-3" />
                    <span>{current.checkIn} - {current.checkOut}</span>
                  </div>
                </div>
                <p className="text-[10px] text-[#8B9DAB] mt-1.5">Confirmación: {current.confirmationCode}</p>
              </div>
            </div>
            <button className="mt-3 w-full py-2.5 bg-[#0D7377] text-white text-xs font-semibold rounded-lg active:scale-[0.98] transition-transform">
              Ver detalle
            </button>
          </div>
        </div>
      )}

      {/* My Reservations */}
      <div className="px-4 py-2">
        <h3 className="text-sm font-semibold text-[#1A2B3C] mb-2">Mis reservas</h3>
        <div className="space-y-2">
          {others.map((res) => (
            <div key={res.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Hotel className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A2B3C] truncate">{res.hotelName}</p>
                <p className="text-xs text-[#5A6B7D]">{res.checkIn} - {res.checkOut}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0 ${
                res.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {res.status === 'confirmed' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {res.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
              </span>
              <ChevronRight className="w-4 h-4 text-[#CBD5E1] flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* New Button */}
      <div className="px-4 py-4">
        <button className="w-full py-3.5 bg-[#0D7377] text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md">
          <Plus className="w-4 h-4" />
          Nueva reserva
        </button>
      </div>
    </div>
  );
}
