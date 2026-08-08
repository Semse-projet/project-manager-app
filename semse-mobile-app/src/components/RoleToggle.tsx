import { useNavigate, useLocation } from 'react-router-dom';
import { useRoleStore } from '@/hooks/useRoleStore';
import { Briefcase, User, Code } from 'lucide-react';

export default function RoleToggle() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, setRole } = useRoleStore();

  // Hide toggle on dev portal routes
  if (location.pathname.startsWith('/dev')) return null;

  const handleRoleChange = (newRole: 'professional' | 'client') => {
    setRole(newRole);
    if (newRole === 'client' && !location.pathname.startsWith('/cliente') && location.pathname !== '/mensajes') {
      navigate('/cliente');
    } else if (newRole === 'professional' && location.pathname.startsWith('/cliente')) {
      navigate('/');
    }
  };

  return (
    <div className="fixed top-16 right-4 z-[55] flex flex-col gap-2 items-end">
      {/* Dev Portal Quick Link */}
      <button
        onClick={() => navigate('/dev')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#0F1D32] text-[#14A0A0] border border-[#14A0A0]/30 hover:bg-[#14A0A0]/10 transition-all shadow-md"
      >
        <Code className="w-3.5 h-3.5" />
        Dev Portal
      </button>

      {/* Role Switcher */}
      <div className="bg-white rounded-full shadow-lg border border-gray-100 p-1 flex gap-1">
        <button
          onClick={() => handleRoleChange('professional')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            role === 'professional'
              ? 'bg-[#0D7377] text-white shadow-sm'
              : 'text-[#8B9DAB] hover:text-[#5A6B7D]'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Profesional
        </button>
        <button
          onClick={() => handleRoleChange('client')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            role === 'client'
              ? 'bg-[#0D7377] text-white shadow-sm'
              : 'text-[#8B9DAB] hover:text-[#5A6B7D]'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Cliente
        </button>
      </div>
    </div>
  );
}
