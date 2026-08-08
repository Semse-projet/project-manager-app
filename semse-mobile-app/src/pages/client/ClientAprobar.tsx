import { CheckCircle, XCircle } from 'lucide-react';

export default function ClientAprobar() {
  const milestone = {
    title: 'Hito 2 - Instalación eléctrica',
    status: 'En revisión',
    progress: 100,
    checks: [
      'Todo se completó según lo acordado',
      'Calidad del trabajo es buena',
      'Cumple con las especificaciones',
      'Comentarios opcionales',
    ],
  };

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 pt-3 pb-4">
        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
          {milestone.status}
        </span>
        <h2 className="text-lg font-bold text-[#1A2B3C] mt-2">{milestone.title}</h2>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#8B9DAB]">Progreso del hito</span>
            <span className="text-xs font-semibold text-[#0D7377]">{milestone.progress}%</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#0D7377] rounded-full" style={{ width: `${milestone.progress}%` }} />
          </div>
        </div>
      </div>

      {/* Evidence Preview */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-[#1A2B3C] mb-2">Evidencias del trabajo</h3>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-200">
              <img src={`https://picsum.photos/400/400?random=${30 + idx}`} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      {/* Checklist */}
      <div className="px-4 py-2">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#1A2B3C] mb-3">Verificación de calidad</h3>
          <div className="space-y-3">
            {milestone.checks.map((check, idx) => (
              <label key={idx} className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-300 text-[#0D7377] focus:ring-[#0D7377]" />
                <span className="text-sm text-[#1A2B3C]">{check}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Comment */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Comentarios (opcional)</label>
        <textarea
          placeholder="Excelente trabajo, todo en orden..."
          rows={3}
          className="w-full p-4 bg-white rounded-xl text-sm text-[#1A2B3C] placeholder:text-[#CBD5E1] border border-gray-100 focus:outline-none focus:border-[#0D7377] focus:ring-2 focus:ring-[#0D7377]/10 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="px-4 py-4 pb-8 space-y-2">
        <button className="w-full py-4 bg-[#0D7377] text-white font-semibold text-sm rounded-xl shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Aprobar hito
        </button>
        <button className="w-full py-3.5 border-2 border-red-200 text-red-500 font-medium text-sm rounded-xl flex items-center justify-center gap-2">
          <XCircle className="w-4 h-4" />
          Rechazar
        </button>
      </div>
    </div>
  );
}
