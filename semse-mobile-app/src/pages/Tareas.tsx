import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useWorkerTasks } from '@/hooks/useWorkerTasks';

type FilterType = 'pending' | 'in_progress' | 'completed';

const filters: { id: FilterType; label: string }[] = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'in_progress', label: 'En progreso' },
  { id: 'completed', label: 'Completadas' },
];

export default function Tareas() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('pending');
  const { tasks: taskList, toggleTask } = useWorkerTasks();

  const filteredTasks = taskList.filter((t) => {
    if (activeFilter === 'pending') return !t.completed && t.status === 'pending';
    if (activeFilter === 'in_progress') return t.status === 'in_progress';
    if (activeFilter === 'completed') return t.completed;
    return true;
  });

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Filter Tabs */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2">
          {filters.map((filter) => {
            const count = taskList.filter((t) => {
              if (filter.id === 'pending') return !t.completed && t.status === 'pending';
              if (filter.id === 'in_progress') return t.status === 'in_progress';
              if (filter.id === 'completed') return t.completed;
              return true;
            }).length;
            return (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                  activeFilter === filter.id
                    ? 'bg-[#0D7377] text-white'
                    : 'bg-white text-[#5A6B7D] border border-gray-200'
                }`}
              >
                {filter.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeFilter === filter.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-[#8B9DAB]'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tasks List */}
      <div className="px-4 py-2 space-y-2">
        {filteredTasks.map((task, idx) => (
          <div
            key={task.id}
            className={`bg-white rounded-xl p-4 shadow-sm stagger-${idx + 1}`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => toggleTask(task.id)}
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  task.completed
                    ? 'bg-[#0D7377] border-[#0D7377]'
                    : 'border-gray-300 active:border-[#0D7377]'
                }`}
              >
                {task.completed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${task.completed ? 'text-[#8B9DAB] line-through' : 'text-[#1A2B3C] font-medium'}`}>
                  {task.title}
                </p>
                <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  task.priority === 'high' ? 'bg-red-50 text-red-500' :
                  task.priority === 'medium' ? 'bg-amber-50 text-amber-500' :
                  'bg-emerald-50 text-emerald-500'
                }`}>
                  {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTasks.length === 0 && (
        <div className="flex flex-col items-center py-16">
          <p className="text-sm text-[#8B9DAB]">No hay tareas {activeFilter === 'completed' ? 'completadas' : activeFilter === 'in_progress' ? 'en progreso' : 'pendientes'}</p>
        </div>
      )}

      {/* Add Button */}
      <div className="px-4 py-4">
        <button className="w-full py-3.5 bg-white border-2 border-dashed border-gray-200 text-[#0D7377] font-medium text-sm rounded-xl flex items-center justify-center gap-2 active:bg-gray-50 transition-colors">
          <Plus className="w-4 h-4" />
          Nueva tarea
        </button>
      </div>
    </div>
  );
}
