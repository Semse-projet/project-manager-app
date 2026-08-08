import { useState } from 'react';
import { Camera, MapPin, Calendar } from 'lucide-react';

type EvidenceType = 'foto' | 'video' | 'documento';

export default function NuevaEvidencia() {
  const [type, setType] = useState<EvidenceType>('foto');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Centro Comercial Plaza Norte');

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Type Selector */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex bg-[#EDF1F7] rounded-xl p-1">
          {(['foto', 'video', 'documento'] as EvidenceType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                type === t
                  ? 'bg-white text-[#1A2B3C] shadow-sm'
                  : 'text-[#8B9DAB]'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Media Capture Area */}
      <div className="px-4 py-3">
        <div className="relative flex flex-col items-center justify-center bg-[#EDF1F7] border-2 border-dashed border-[#CBD5E1] rounded-2xl aspect-video">
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm">
              <Camera className="w-7 h-7 text-[#8B9DAB]" />
            </div>
            <p className="text-sm text-[#8B9DAB]">Toca para capturar o seleccionar</p>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="px-4 py-2 space-y-4">
        <div>
          <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Descripción *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe la evidencia..."
            rows={4}
            className="w-full p-4 bg-white rounded-xl text-sm text-[#1A2B3C] placeholder:text-[#CBD5E1] border border-gray-100 focus:outline-none focus:border-[#0D7377] focus:ring-2 focus:ring-[#0D7377]/10 resize-none transition-all"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Ubicación</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9DAB]" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-12 pl-10 pr-4 bg-white rounded-xl text-sm text-[#1A2B3C] border border-gray-100 focus:outline-none focus:border-[#0D7377] focus:ring-2 focus:ring-[#0D7377]/10 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Fecha y hora</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9DAB]" />
            <input
              type="text"
              value="22 Abr 2026, 10:30 AM"
              readOnly
              className="w-full h-12 pl-10 pr-4 bg-gray-50 rounded-xl text-sm text-[#1A2B3C] border border-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="px-4 py-6 pb-8">
        <button className="w-full py-4 bg-[#0D7377] text-white font-semibold text-sm rounded-xl shadow-md active:scale-[0.98] transition-transform">
          Guardar evidencia
        </button>
      </div>
    </div>
  );
}
