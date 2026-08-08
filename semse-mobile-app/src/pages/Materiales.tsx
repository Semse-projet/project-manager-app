import { useState } from 'react';
import { Search, Package, Plus, ChevronRight } from 'lucide-react';
import { useWorkerJobs } from '@/hooks/useWorkerJobs';

export default function Materiales() {
  const [searchQuery, setSearchQuery] = useState('');
  const { jobs } = useWorkerJobs();
  const materials = jobs[0]?.materials || [];

  const filteredMaterials = materials.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categoryConfig: Record<string, { bg: string; text: string }> = {
    Alta: { bg: 'bg-red-50', text: 'text-red-500' },
    Media: { bg: 'bg-amber-50', text: 'text-amber-500' },
    Baja: { bg: 'bg-emerald-50', text: 'text-emerald-500' },
  };

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9DAB]" />
          <input
            type="text"
            placeholder="Buscar materiales..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-white rounded-xl text-sm text-[#1A2B3C] placeholder:text-[#8B9DAB] border border-gray-100 focus:outline-none focus:border-[#0D7377] focus:ring-2 focus:ring-[#0D7377]/10 transition-all"
          />
        </div>
      </div>

      {/* Materials List */}
      <div className="px-4 py-2 space-y-2">
        {filteredMaterials.map((material, idx) => {
          const cat = categoryConfig[material.category] || categoryConfig.Baja;
          return (
            <div key={material.id} className={`bg-white rounded-xl p-3.5 shadow-sm flex items-center gap-3 stagger-${idx + 1}`}>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 flex-shrink-0">
                <Package className="w-5 h-5 text-[#8B9DAB]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A2B3C] truncate">{material.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cat.bg} ${cat.text}`}>
                    {material.category}
                  </span>
                  <span className="text-xs text-[#8B9DAB]">{material.quantity} {material.unit}</span>
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                material.status === 'delivered' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {material.status === 'delivered' ? 'Entregado' : 'Pendiente'}
              </span>
              <ChevronRight className="w-4 h-4 text-[#CBD5E1] flex-shrink-0" />
            </div>
          );
        })}
      </div>

      {/* Request Button */}
      <div className="px-4 py-4">
        <button className="w-full py-3.5 bg-[#0D7377] text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md">
          <Plus className="w-4 h-4" />
          Solicitar material
        </button>
      </div>
    </div>
  );
}
