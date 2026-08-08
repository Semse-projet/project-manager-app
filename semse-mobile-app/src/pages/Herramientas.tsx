import { QrCode, Calculator, ArrowRightLeft, ClipboardCheck, StickyNote, Timer, WifiOff, RefreshCw, ChevronRight } from 'lucide-react';

const tools = [
  { id: 'qr', label: 'Escanear QR', description: 'Verificar activos', icon: QrCode, color: 'bg-[#0D7377]' },
  { id: 'calc', label: 'Calculadora', description: 'Herramienta', icon: Calculator, color: 'bg-blue-500' },
  { id: 'convert', label: 'Convertidor', description: 'Unidades', icon: ArrowRightLeft, color: 'bg-purple-500' },
  { id: 'checklist', label: 'Checklist', description: 'Plantillas', icon: ClipboardCheck, color: 'bg-amber-500' },
  { id: 'notes', label: 'Notas', description: 'Mis notas', icon: StickyNote, color: 'bg-emerald-500' },
  { id: 'timer', label: 'Cronómetro', description: 'Tiempo', icon: Timer, color: 'bg-red-500' },
  { id: 'offline', label: 'Offline', description: 'Modo sin conexión', icon: WifiOff, color: 'bg-gray-500' },
  { id: 'sync', label: 'Sincronizar', description: 'Último: hoy 9:41 AM', icon: RefreshCw, color: 'bg-cyan-500' },
];

export default function Herramientas() {
  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Tools Grid */}
      <div className="px-4 pt-4 pb-2">
        <div className="grid grid-cols-2 gap-2.5">
          {tools.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                className={`bg-white rounded-xl p-5 shadow-sm flex flex-col items-center text-center gap-2 active:scale-[0.97] transition-transform stagger-${idx + 1}`}
              >
                <div className={`w-12 h-12 rounded-xl ${tool.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A2B3C]">{tool.label}</p>
                  <p className="text-[10px] text-[#8B9DAB] mt-0.5">{tool.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Additional Info */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1A2B3C]">Última sincronización</p>
                <p className="text-xs text-[#8B9DAB]">Hoy, 9:41 AM</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#CBD5E1]" />
          </div>
        </div>
      </div>
    </div>
  );
}
