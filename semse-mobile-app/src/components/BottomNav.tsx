import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardList, PlusCircle, MessageCircle, User } from 'lucide-react';
import { useState } from 'react';
import BottomSheet from './BottomSheet';

const tabs = [
  { id: 'inicio', label: 'Inicio', icon: Home, path: '/' },
  { id: 'trabajos', label: 'Trabajos', icon: ClipboardList, path: '/trabajos' },
  { id: 'fab', label: '', icon: PlusCircle, path: '' },
  { id: 'mensajes', label: 'Mensajes', icon: MessageCircle, path: '/mensajes' },
  { id: 'perfil', label: 'Perfil', icon: User, path: '/perfil' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSheet, setShowSheet] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleTabClick = (tab: (typeof tabs)[0]) => {
    if (tab.id === 'fab') {
      setShowSheet(true);
      return;
    }
    navigate(tab.path);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {tabs.map((tab) => {
            if (tab.id === 'fab') {
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className="relative -mt-6 flex items-center justify-center w-14 h-14 bg-[#0D7377] rounded-full shadow-lg shadow-[#0D7377]/30 active:scale-95 transition-transform"
                >
                  <PlusCircle className="w-7 h-7 text-white" />
                </button>
              );
            }

            const active = isActive(tab.path);
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full active:opacity-70 transition-colors ${
                  active ? 'text-[#0D7377]' : 'text-[#8B9DAB]'
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <BottomSheet isOpen={showSheet} onClose={() => setShowSheet(false)} />
    </>
  );
}
