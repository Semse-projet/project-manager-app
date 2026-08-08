import { Search, MessageCircle } from 'lucide-react';

const conversations = [
  { id: '1', name: 'Ana Torres', message: '¿Ya enviaste las evidencias del trabajo?', time: '10:30 AM', unread: 2, avatar: 'AT' },
  { id: '2', name: 'Luis Medina', message: 'El mantenimiento queda confirmado para mañana', time: 'Ayer', unread: 0, avatar: 'LM' },
  { id: '3', name: 'Soporte SEMSE', message: 'Tu solicitud ha sido procesada', time: 'Ayer', unread: 1, avatar: 'SS' },
  { id: '4', name: 'María García', message: 'Por favor revisa el nuevo checklist', time: 'Lun', unread: 0, avatar: 'MG' },
];

export default function Mensajes() {
  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9DAB]" />
          <input
            type="text"
            placeholder="Buscar conversaciones..."
            className="w-full h-11 pl-10 pr-4 bg-white rounded-xl text-sm text-[#1A2B3C] placeholder:text-[#8B9DAB] border border-gray-100 focus:outline-none focus:border-[#0D7377] focus:ring-2 focus:ring-[#0D7377]/10 transition-all"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="px-4 py-2 space-y-2">
        {conversations.map((conv, idx) => (
          <button
            key={conv.id}
            className={`w-full bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 text-left active:scale-[0.98] transition-transform stagger-${idx + 1}`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-[#0D7377]/10 flex items-center justify-center">
                <span className="text-sm font-bold text-[#0D7377]">{conv.avatar}</span>
              </div>
              {conv.unread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-[10px] text-white font-bold">{conv.unread}</span>
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#1A2B3C]">{conv.name}</p>
                <span className="text-[10px] text-[#8B9DAB]">{conv.time}</span>
              </div>
              <p className={`text-xs mt-0.5 truncate ${conv.unread > 0 ? 'text-[#1A2B3C] font-medium' : 'text-[#8B9DAB]'}`}>
                {conv.message}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Empty state if no conversations */}
      {conversations.length === 0 && (
        <div className="flex flex-col items-center py-16">
          <MessageCircle className="w-12 h-12 text-[#CBD5E1] mb-3" />
          <p className="text-sm text-[#8B9DAB]">No hay conversaciones</p>
        </div>
      )}
    </div>
  );
}
