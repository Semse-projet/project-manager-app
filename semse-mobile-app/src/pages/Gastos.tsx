import { useState } from 'react';
import { Utensils, Bus, Bed, Fuel, Plus } from 'lucide-react';
import { useWorkerTravel } from '@/hooks/useWorkerTravel';

type FilterType = 'todos' | 'pending' | 'approved';

const filters: { id: FilterType; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'approved', label: 'Aprobados' },
];

const categoryIcons: Record<string, typeof Fuel> = {
  comida: Utensils,
  transporte: Bus,
  hospedaje: Bed,
  combustible: Fuel,
};

const categoryColors: Record<string, string> = {
  comida: 'bg-orange-50 text-orange-500',
  transporte: 'bg-blue-50 text-blue-500',
  hospedaje: 'bg-purple-50 text-purple-500',
  combustible: 'bg-red-50 text-red-500',
};

export default function Gastos() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const { expenses } = useWorkerTravel();

  const filtered = expenses.filter((e) => {
    if (activeFilter === 'todos') return true;
    return e.status === activeFilter;
  });

  const totalGastado = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPendiente = expenses.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Totals Card */}
      <div className="px-4 pt-3 pb-2">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center border-r border-gray-100">
              <p className="text-[10px] text-[#8B9DAB] uppercase tracking-wide mb-1">Total gastado</p>
              <p className="text-xl font-bold text-[#1A2B3C]">${totalGastado.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-[#8B9DAB] uppercase tracking-wide mb-1">Pendiente reembolso</p>
              <p className="text-xl font-bold text-amber-500">${totalPendiente.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2">
        <div className="flex gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                activeFilter === filter.id
                  ? 'bg-[#0D7377] text-white'
                  : 'bg-white text-[#5A6B7D] border border-gray-200'
              }`}
            >
              {filter.label}
              <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                activeFilter === filter.id ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {filter.id === 'todos' ? expenses.length : expenses.filter((e) => e.status === filter.id).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Expenses List */}
      <div className="px-4 py-2 space-y-2">
        {filtered.map((expense, idx) => {
          const Icon = categoryIcons[expense.category] || Fuel;
          const colorClass = categoryColors[expense.category] || 'bg-gray-50 text-gray-500';
          return (
            <div key={expense.id} className={`bg-white rounded-xl p-3.5 shadow-sm flex items-center gap-3 stagger-${idx + 1}`}>
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${colorClass} flex-shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A2B3C]">{expense.concept}</p>
                <p className="text-xs text-[#8B9DAB]">{expense.date}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-[#1A2B3C]">${expense.amount.toFixed(2)}</p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  expense.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {expense.status === 'approved' ? 'Aprobado' : 'Pendiente'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Button */}
      <div className="px-4 py-4">
        <button className="w-full py-3.5 bg-[#0D7377] text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md">
          <Plus className="w-4 h-4" />
          Nuevo gasto
        </button>
      </div>
    </div>
  );
}
