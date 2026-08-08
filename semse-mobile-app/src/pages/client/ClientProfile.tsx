import { Phone, Mail, MapPin, Edit3 } from 'lucide-react';
import { useClientProfile } from '@/hooks/useClientProfile';

export default function ClientProfile() {
  const { profile: clientProfile, activeProjects, completedProjects } = useClientProfile();

  if (!clientProfile) {
    return (
      <div className="bg-[#F5F7FA] min-h-screen px-4 py-10">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#1A2B3C]">Perfil no disponible</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Profile Card */}
      <div className="bg-white px-4 pt-5 pb-5">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-[#0D7377]/10 mb-3">
            <img src={clientProfile.avatar} alt={clientProfile.name} className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl font-bold text-[#1A2B3C]">{clientProfile.name}</h2>
          <p className="text-sm text-[#5A6B7D] mt-0.5">Cliente desde {clientProfile.memberSince}</p>

          <div className="flex gap-6 mt-4">
            <div className="text-center">
              <p className="text-lg font-bold text-[#1A2B3C]">{clientProfile.projectsCount}</p>
              <p className="text-[10px] text-[#8B9DAB]">Proyectos</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#1A2B3C]">{activeProjects}</p>
              <p className="text-[10px] text-[#8B9DAB]">En curso</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#1A2B3C]">{completedProjects}</p>
              <p className="text-[10px] text-[#8B9DAB]">Completados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="px-4 py-3">
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50">
          <div className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
              <Mail className="w-4 h-4 text-[#0D7377]" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-[#8B9DAB] uppercase tracking-wide">Email</p>
              <p className="text-sm font-medium text-[#1A2B3C]">{clientProfile.email}</p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Phone className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-[#8B9DAB] uppercase tracking-wide">Teléfono</p>
              <p className="text-sm font-medium text-[#1A2B3C]">{clientProfile.phone}</p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-[#8B9DAB] uppercase tracking-wide">Ciudad</p>
              <p className="text-sm font-medium text-[#1A2B3C]">{clientProfile.location}</p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-purple-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-[#8B9DAB] uppercase tracking-wide">Dirección</p>
              <p className="text-sm font-medium text-[#1A2B3C]">{clientProfile.address}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Button */}
      <div className="px-4 py-2">
        <button className="w-full py-3.5 border-2 border-[#0D7377] text-[#0D7377] font-semibold text-sm rounded-xl flex items-center justify-center gap-2">
          <Edit3 className="w-4 h-4" />
          Editar perfil
        </button>
      </div>
    </div>
  );
}
