import { CheckCircle, Clock, Lock, ArrowRight } from 'lucide-react';
import { useClientPayments } from '@/hooks/useClientPayments';

export default function ClientPagos() {
  const { payments: escrowPayments } = useClientPayments();
  const total = escrowPayments.reduce((s, p) => s + p.amount, 0);
  const released = escrowPayments.filter((p) => p.status === 'released').reduce((s, p) => s + p.amount, 0);
  const funded = escrowPayments.filter((p) => p.status === 'funded').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Escrow Summary */}
      <div className="px-4 pt-3 pb-2">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-5 h-5 text-[#0D7377]" />
            <h3 className="text-sm font-semibold text-[#1A2B3C]">Fondo en garantía</h3>
          </div>
          <p className="text-2xl font-bold text-[#1A2B3C]">${total.toLocaleString()} USD</p>
          <p className="text-xs text-[#8B9DAB] mt-1">Pagado el 15/04/2024</p>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold text-emerald-500">${released}</p>
            <p className="text-[10px] text-[#8B9DAB]">Liberado</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold text-amber-500">${funded}</p>
            <p className="text-[10px] text-[#8B9DAB]">En escrow</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold text-[#1A2B3C]">${total - released - funded}</p>
            <p className="text-[10px] text-[#8B9DAB]">Pendiente</p>
          </div>
        </div>
      </div>

      {/* Payments List */}
      <div className="px-4 py-2">
        <h3 className="text-sm font-semibold text-[#1A2B3C] mb-2">Pagos del proyecto</h3>
        <div className="space-y-2">
          {escrowPayments.map((payment, idx) => (
            <div key={payment.id} className={`bg-white rounded-xl p-4 shadow-sm stagger-${idx + 1}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    payment.status === 'released' ? 'bg-emerald-50' :
                    payment.status === 'funded' ? 'bg-amber-50' : 'bg-gray-50'
                  }`}>
                    {payment.status === 'released' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> :
                     payment.status === 'funded' ? <Lock className="w-5 h-5 text-amber-500" /> :
                     <Clock className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A2B3C]">{payment.concept}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      payment.status === 'released' ? 'bg-emerald-50 text-emerald-600' :
                      payment.status === 'funded' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {payment.status === 'released' ? 'Liberado' : payment.status === 'funded' ? 'En escrow' : 'Pendiente'}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-[#1A2B3C]">${payment.amount}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        <button className="w-full py-3.5 border-2 border-gray-200 text-[#5A6B7D] font-medium text-sm rounded-xl flex items-center justify-center gap-2">
          Ver historial de pagos
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
