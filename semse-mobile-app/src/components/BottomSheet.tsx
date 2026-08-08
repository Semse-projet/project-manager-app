import { useNavigate } from 'react-router-dom';
import { ClipboardList, Camera, AlertTriangle, MapPin, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const options = [
  { id: 'trabajo', label: 'Nuevo trabajo', description: 'Crear un nuevo trabajo', icon: ClipboardList, color: 'bg-[#0D7377]', path: '/trabajos' },
  { id: 'evidencia', label: 'Registrar evidencia', description: 'Subir foto, video o documento', icon: Camera, color: 'bg-blue-500', path: '/evidencias' },
  { id: 'incidente', label: 'Reportar incidente', description: 'Reportar un problema', icon: AlertTriangle, color: 'bg-red-500', path: '/incidentes' },
  { id: 'viaje', label: 'Iniciar viaje', description: 'Comenzar un nuevo viaje', icon: MapPin, color: 'bg-amber-500', path: '/viajes' },
];

export default function BottomSheet({ isOpen, onClose }: BottomSheetProps) {
  const navigate = useNavigate();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 animate-fadeIn" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl animate-slideUp"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4">
          <h3 className="text-lg font-semibold text-[#1A2B3C]">Crear nuevo</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 active:bg-gray-200"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Options */}
        <div className="px-5 pb-8 space-y-3">
          {options.map((option, index) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() => {
                  onClose();
                  navigate(option.path);
                }}
                className={`flex items-center gap-4 w-full p-4 rounded-xl bg-gray-50 active:bg-gray-100 transition-colors stagger-${index + 1}`}
              >
                <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${option.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-[#1A2B3C]">{option.label}</p>
                  <p className="text-xs text-[#8B9DAB]">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
