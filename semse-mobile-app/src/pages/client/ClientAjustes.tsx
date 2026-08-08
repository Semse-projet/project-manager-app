import { useState } from 'react';
import { Bell, Shield, CreditCard, MapPin, Globe, Palette, LogOut, ChevronRight, User, HelpCircle } from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: typeof Bell;
  value?: string;
  action?: boolean;
  toggle?: boolean;
  danger?: boolean;
  state?: boolean;
  setState?: (v: boolean) => void;
}

export default function ClientAjustes() {
  const [notifications, setNotifications] = useState(true);

  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'General',
      items: [
        { id: 'personal', label: 'Información personal', icon: User, action: true },
        { id: 'seguridad', label: 'Seguridad', icon: Shield, action: true },
        { id: 'notificaciones', label: 'Notificaciones', icon: Bell, toggle: true, state: notifications, setState: setNotifications },
        { id: 'privacidad', label: 'Privacidad', icon: Shield, action: true },
      ],
    },
    {
      title: 'Preferencias',
      items: [
        { id: 'idioma', label: 'Idioma', icon: Globe, value: 'Español', action: true },
        { id: 'tema', label: 'Tema', icon: Palette, value: 'Claro', action: true },
        { id: 'pagos', label: 'Métodos de pago', icon: CreditCard, action: true },
        { id: 'direcciones', label: 'Direcciones guardadas', icon: MapPin, action: true },
      ],
    },
    {
      title: 'Soporte',
      items: [
        { id: 'ayuda', label: 'Centro de ayuda', icon: HelpCircle, action: true },
        { id: 'cerrar', label: 'Cerrar sesión', icon: LogOut, danger: true },
      ],
    },
  ];

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {sections.map((section) => (
        <div key={section.title} className="px-4 py-3">
          <h3 className="text-xs font-semibold text-[#8B9DAB] uppercase tracking-wide mb-2">{section.title}</h3>
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`w-full p-4 flex items-center justify-between text-left active:bg-gray-50 ${
                    item.danger ? 'text-red-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      item.danger ? 'bg-red-50' : 'bg-gray-50'
                    }`}>
                      <Icon className={`w-4 h-4 ${item.danger ? 'text-red-500' : 'text-[#5A6B7D]'}`} />
                    </div>
                    <span className={`text-sm font-medium ${item.danger ? 'text-red-500' : 'text-[#1A2B3C]'}`}>
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.value && <span className="text-xs text-[#8B9DAB]">{item.value}</span>}
                    {item.toggle && item.setState && (
                      <button
                        onClick={(e) => { e.stopPropagation(); item.setState?.(!item.state); }}
                        className={`w-11 h-6 rounded-full transition-colors ${
                          item.state ? 'bg-[#0D7377]' : 'bg-gray-300'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
                          item.state ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    )}
                    {item.action && <ChevronRight className="w-4 h-4 text-[#CBD5E1]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="px-4 py-4 text-center">
        <p className="text-[10px] text-[#CBD5E1]">SEMSEproject v2.1.0</p>
      </div>
    </div>
  );
}
