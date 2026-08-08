import { useState } from 'react';
import { MapPin, DollarSign, Calendar, Users, ChevronDown } from 'lucide-react';

export default function ClientPublicarDetalle() {
  const [formData, setFormData] = useState({
    title: 'Remodelación de cocina',
    description: '',
    skills: '',
    collaborators: '3',
    modality: 'Remoto',
    budget: '',
    location: 'Ciudad de México, CDMX',
  });

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold text-[#1A2B3C]">Detalles del trabajo</h2>
        <p className="text-sm text-[#8B9DAB] mt-1">Cuéntanos más sobre tu proyecto</p>
      </div>

      <div className="px-4 py-2 space-y-4">
        {/* Title */}
        <div>
          <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Título del trabajo</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full h-12 px-4 bg-white rounded-xl text-sm text-[#1A2B3C] border border-gray-100 focus:outline-none focus:border-[#0D7377] focus:ring-2 focus:ring-[#0D7377]/10"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Categoría</label>
          <div className="relative">
            <select className="w-full h-12 px-4 bg-white rounded-xl text-sm text-[#1A2B3C] border border-gray-100 appearance-none focus:outline-none focus:border-[#0D7377]">
              <option>Selecciona una categoría</option>
              <option>Construcción</option>
              <option>Remodelación</option>
              <option>Instalaciones eléctricas</option>
              <option>Acabados</option>
              <option>Mantenimiento</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9DAB] pointer-events-none" />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Descripción</label>
          <textarea
            placeholder="Describe tu proyecto, alcance, materiales necesarios, etc."
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-4 bg-white rounded-xl text-sm text-[#1A2B3C] placeholder:text-[#CBD5E1] border border-gray-100 focus:outline-none focus:border-[#0D7377] focus:ring-2 focus:ring-[#0D7377]/10 resize-none"
          />
          <div className="text-right">
            <span className="text-[10px] text-[#8B9DAB]">{formData.description.length}/500</span>
          </div>
        </div>

        {/* Alcance del trabajo */}
        <div>
          <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Alcance del trabajo</label>
          <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-2">
            {['Demolición', 'Instalación eléctrica', 'Carpintería', 'Fontanería', 'Acabados', 'Pintura'].map((item) => (
              <label key={item} className="flex items-center gap-3">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-[#0D7377] focus:ring-[#0D7377]" />
                <span className="text-sm text-[#1A2B3C]">{item}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Presupuesto estimado</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9DAB]" />
            <input
              type="text"
              placeholder="$2,500 - $3,500 USD"
              className="w-full h-12 pl-10 pr-4 bg-white rounded-xl text-sm text-[#1A2B3C] placeholder:text-[#CBD5E1] border border-gray-100 focus:outline-none focus:border-[#0D7377] focus:ring-2 focus:ring-[#0D7377]/10"
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Ubicación del trabajo</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9DAB]" />
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full h-12 pl-10 pr-4 bg-white rounded-xl text-sm text-[#1A2B3C] border border-gray-100 focus:outline-none focus:border-[#0D7377] focus:ring-2 focus:ring-[#0D7377]/10"
            />
          </div>
        </div>

        {/* Collaborators */}
        <div>
          <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Número de colaboradores</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9DAB]" />
            <select className="w-full h-12 pl-10 pr-4 bg-white rounded-xl text-sm text-[#1A2B3C] border border-gray-100 appearance-none focus:outline-none focus:border-[#0D7377]">
              <option>1 colaborador</option>
              <option>2 colaboradores</option>
              <option selected>3 colaboradores</option>
              <option>4+ colaboradores</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9DAB] pointer-events-none" />
          </div>
        </div>

        {/* Delivery Date */}
        <div>
          <label className="text-xs font-medium text-[#1A2B3C] mb-1.5 block">Fecha límite (opcional)</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9DAB]" />
            <input
              type="text"
              placeholder="Selecciona fecha"
              className="w-full h-12 pl-10 pr-4 bg-white rounded-xl text-sm text-[#1A2B3C] placeholder:text-[#CBD5E1] border border-gray-100 focus:outline-none focus:border-[#0D7377] focus:ring-2 focus:ring-[#0D7377]/10"
            />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="px-4 py-4 pb-8 space-y-2">
        <button className="w-full py-4 bg-[#0D7377] text-white font-semibold text-sm rounded-xl shadow-md active:scale-[0.98] transition-transform">
          Publicar trabajo
        </button>
        <button className="w-full py-3.5 border-2 border-gray-200 text-[#5A6B7D] font-medium text-sm rounded-xl">
          Guardar borrador
        </button>
      </div>
    </div>
  );
}
