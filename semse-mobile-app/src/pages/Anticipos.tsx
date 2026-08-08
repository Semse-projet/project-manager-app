import { DollarSign, CheckCircle, Clock } from 'lucide-react';
import { useWorkerAdvance } from '@/hooks/useWorkerAdvance';

export default function Anticipos() {
  const { advance } = useWorkerAdvance();

  if (!advance) {
    return (
      <div className="bg-[#F5F7FA] min-h-screen px-4 py-10">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#1A2B3C]">No hay anticipo activo</p>
        </div>
      </div>
    );
  }

  const availableDetail = advance.details.find((detail) => detail.status === 'Disponible');
  const availableAmount = availableDetail?.amount ?? 0;
  const usedAmount = advance.amount - availableAmount;
  const usedPercentage = advance.amount > 0 ? Math.round((usedAmount / advance.amount) * 100) : 0;

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Active Advance Card */}
      <div className="px-4 pt-3 pb-2">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Activo
            </span>
            <span className="text-xs text-[#8B9DAB]">Entregado: {advance.deliveredDate}</span>
          </div>
          <p className="text-[10px] text-[#8B9DAB] uppercase tracking-wide mb-1">Anticipo activo</p>
          <p className="text-3xl font-bold text-[#1A2B3C]">${advance.amount.toFixed(2)}</p>

          {/* Progress */}
          <div className="mt-4">
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#0D7377] rounded-full" style={{ width: `${usedPercentage}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[#8B9DAB]">Utilizado: {usedPercentage}%</span>
              <span className="text-[10px] text-[#0D7377] font-medium">Disponible: ${availableAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detail List */}
      <div className="px-4 py-2">
        <h3 className="text-sm font-semibold text-[#1A2B3C] mb-2">Detalle de uso</h3>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50">
          {advance.details.map((detail) => (
            <div key={`${detail.concept}-${detail.status}`} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {detail.status === 'Utilizado' ? (
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  </div>
                ) : detail.status === 'Pendiente' ? (
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-blue-500" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-[#1A2B3C]">{detail.concept}</p>
                  <span className={`text-[10px] font-semibold ${
                    detail.status === 'Utilizado' ? 'text-emerald-600' :
                    detail.status === 'Pendiente' ? 'text-amber-600' : 'text-blue-600'
                  }`}>
                    {detail.status}
                  </span>
                </div>
              </div>
              <p className={`text-sm font-semibold ${
                detail.status === 'Disponible' ? 'text-blue-600' : 'text-[#1A2B3C]'
              }`}>
                ${detail.amount.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Request Button */}
      <div className="px-4 py-4">
        <button className="w-full py-3.5 bg-[#0D7377] text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md">
          <DollarSign className="w-4 h-4" />
          Solicitar anticipo
        </button>
      </div>
    </div>
  );
}
