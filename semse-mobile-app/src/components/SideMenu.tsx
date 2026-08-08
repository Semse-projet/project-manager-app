import { useNavigate } from 'react-router-dom';
import { Briefcase, Flag, Link2, MapPin, DollarSign, TrendingUp, X, Hexagon } from 'lucide-react';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { id: 'trabaja', label: 'Trabaja', icon: Briefcase, path: '/trabajos' },
  { id: 'reporta', label: 'Reporta', icon: Flag, path: '/incidentes' },
  { id: 'conecta', label: 'Conecta', icon: Link2, path: '/mensajes' },
  { id: 'visita', label: 'Visita', icon: MapPin, path: '/viajes' },
  { id: 'gana', label: 'Gana', icon: DollarSign, path: '/pagos' },
  { id: 'crece', label: 'Crece', icon: TrendingUp, path: '/perfil' },
];

export default function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Menu Panel */}
      <div className="absolute top-0 left-0 bottom-0 w-[85%] max-w-[360px] bg-[#1A2B3C] animate-slideInRight">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#0D7377]/20">
              <Hexagon className="w-6 h-6 text-[#14A0A0]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">SEMSEproject</p>
              <p className="text-xs text-white/60">Área del Profesional</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 active:bg-white/20"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* User Info */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src="https://i.pravatar.cc/150?img=12"
              alt="Carlos López"
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-white">Carlos López</p>
              <p className="text-xs text-white/60">Técnico Electricista</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onClose();
                  navigate(item.path);
                }}
                className="flex items-center gap-4 w-full px-5 py-3.5 text-white/80 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            Conectamos trabajo,<br />personas y oportunidades.
          </p>
          <div className="flex justify-center mt-3">
            <div className="flex items-center gap-2">
              <Hexagon className="w-4 h-4 text-[#14A0A0]" />
              <span className="text-xs text-white/60 font-medium">SEMSEproject</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Need to add slide-in from left animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInLeft {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }
  .animate-slideInRight {
    animation: slideInLeft 0.3s ease-out;
  }
`;
document.head.appendChild(style);
