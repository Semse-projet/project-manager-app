import { FileText, ChevronRight, Send, DollarSign, Receipt, AlertCircle } from 'lucide-react';

export default function Liquidacion() {
  const summary = {
    totalGastado: 380.50,
    anticipoUtilizado: 350.00,
    aReembolsar: 30.50,
  };

  const documents = [
    { id: 'd1', name: 'Informe de viaje', type: 'PDF', size: '245 KB' },
    { id: 'd2', name: 'Boletas y facturas', type: 'ZIP', size: '2.4 MB' },
  ];

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Summary Card */}
      <div className="px-4 pt-3 pb-2">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[#1A2B3C] mb-4">Resumen</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-500" />
                <span className="text-sm text-[#5A6B7D]">Total gastado</span>
              </div>
              <span className="text-sm font-semibold text-red-500">${summary.totalGastado.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#0D7377]" />
                <span className="text-sm text-[#5A6B7D]">Anticipo utilizado</span>
              </div>
              <span className="text-sm font-semibold text-[#0D7377]">${summary.anticipoUtilizado.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-[#1A2B3C]">A reembolsar</span>
              </div>
              <span className="text-lg font-bold text-emerald-500">${summary.aReembolsar.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="px-4 py-2">
        <h3 className="text-sm font-semibold text-[#1A2B3C] mb-2">Documentos</h3>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50">
          {documents.map((doc) => (
            <button key={doc.id} className="w-full p-4 flex items-center justify-between text-left active:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A2B3C]">{doc.name}</p>
                  <p className="text-xs text-[#8B9DAB]">{doc.type} • {doc.size}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#CBD5E1]" />
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="px-4 py-6 pb-8">
        <button className="w-full py-4 bg-[#0D7377] text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md">
          <Send className="w-4 h-4" />
          Enviar liquidación
        </button>
      </div>
    </div>
  );
}
