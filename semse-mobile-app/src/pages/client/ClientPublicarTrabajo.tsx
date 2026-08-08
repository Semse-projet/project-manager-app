import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Hammer, Plug, Paintbrush, Wrench, MoreHorizontal } from 'lucide-react';

const jobTypes = [
  { id: 'construccion', label: 'Construcción', icon: Building2, description: 'Obras nuevas, ampliaciones' },
  { id: 'remodelacion', label: 'Remodelación', icon: Hammer, description: 'Renovaciones, reformas' },
  { id: 'instalaciones', label: 'Instalaciones', icon: Plug, description: 'Eléctricas, fontanería' },
  { id: 'acabados', label: 'Acabados', icon: Paintbrush, description: 'Pintura, pisos, drywall' },
  { id: 'mantenimiento', label: 'Mantenimiento', icon: Wrench, description: 'Reparaciones, servicios' },
  { id: 'otros', label: 'Otros servicios', icon: MoreHorizontal, description: 'Consultoría, diseño' },
];

export default function ClientPublicarTrabajo() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold text-[#1A2B3C]">Publicar trabajo</h2>
        <p className="text-sm text-[#8B9DAB] mt-1">¿Qué tipo de trabajo necesitas realizar?</p>
      </div>

      {/* Job Type Grid */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-2 gap-2.5">
          {jobTypes.map((type, idx) => {
            const Icon = type.icon;
            const selected = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`bg-white rounded-xl p-4 shadow-sm flex flex-col items-center text-center gap-2 transition-all stagger-${idx + 1} ${
                  selected ? 'ring-2 ring-[#0D7377] ring-offset-1' : ''
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  selected ? 'bg-[#0D7377]' : 'bg-[#EDF1F7]'
                }`}>
                  <Icon className={`w-6 h-6 ${selected ? 'text-white' : 'text-[#5A6B7D]'}`} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${selected ? 'text-[#0D7377]' : 'text-[#1A2B3C]'}`}>{type.label}</p>
                  <p className="text-[10px] text-[#8B9DAB] mt-0.5">{type.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Publications */}
      <div className="px-4 py-2">
        <h3 className="text-sm font-semibold text-[#1A2B3C] mb-2">Publicaciones recientes</h3>
        <div className="space-y-2">
          {['Remodelación de baño', 'Pintura interior'].map((title, idx) => (
            <div key={idx} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#8B9DAB]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#1A2B3C]">{title}</p>
                <p className="text-xs text-[#8B9DAB]">Publicado: 15/04/2024</p>
              </div>
              <span className="text-[10px] font-semibold text-[#0D7377]">{idx === 0 ? '3 propuestas' : '2 propuestas'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Next Button */}
      <div className="px-4 py-4 pb-8">
        <button
          onClick={() => selectedType && navigate('/cliente/publicar-detalle')}
          disabled={!selectedType}
          className={`w-full py-4 font-semibold text-sm rounded-xl transition-all ${
            selectedType
              ? 'bg-[#0D7377] text-white shadow-md active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
