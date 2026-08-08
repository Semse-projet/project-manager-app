import { MapPin, Navigation, Timer, Route } from 'lucide-react';

export default function Tracker() {
  return (
    <div className="h-screen bg-[#E8EDF2] relative flex flex-col">
      {/* Map Area - Styled blueprint-like */}
      <div className="flex-1 relative overflow-hidden">
        {/* Grid pattern background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(13,115,119,0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(13,115,119,0.08) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Simulated streets */}
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.15 }}>
          <line x1="0" y1="30%" x2="100%" y2="30%" stroke="#0D7377" strokeWidth="8" />
          <line x1="0" y1="60%" x2="100%" y2="60%" stroke="#0D7377" strokeWidth="6" />
          <line x1="25%" y1="0" x2="25%" y2="100%" stroke="#0D7377" strokeWidth="6" />
          <line x1="60%" y1="0" x2="60%" y2="100%" stroke="#0D7377" strokeWidth="8" />
          <line x1="85%" y1="0" x2="85%" y2="100%" stroke="#0D7377" strokeWidth="4" />
        </svg>

        {/* Route line */}
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.6 }}>
          <line x1="25%" y1="60%" x2="60%" y2="30%" stroke="#0D7377" strokeWidth="3" strokeDasharray="8 4" />
        </svg>

        {/* Start marker */}
        <div className="absolute" style={{ left: '22%', top: '58%' }}>
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-[10px] font-semibold text-emerald-600 bg-white/80 px-1.5 py-0.5 rounded">Inicio</span>
          </div>
        </div>

        {/* Current location - pulsing */}
        <div className="absolute" style={{ left: '57%', top: '27%' }}>
          <div className="relative">
            <div className="absolute inset-0 w-10 h-10 rounded-full bg-[#0D7377] animate-pulse-ring" />
            <div className="w-10 h-10 rounded-full bg-[#0D7377] flex items-center justify-center shadow-lg relative z-10">
              <Navigation className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-[10px] font-semibold text-[#0D7377] bg-white/80 px-1.5 py-0.5 rounded">Tú</span>
          </div>
        </div>

        {/* Location label */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-[#1A2B3C]">En trabajo</span>
          </div>
          <p className="text-[10px] text-[#8B9DAB] mt-0.5">Centro Comercial Plaza Norte</p>
        </div>

        {/* Map controls */}
        <div className="absolute right-4 top-4 flex flex-col gap-2">
          <button className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center active:bg-gray-50">
            <span className="text-lg font-bold text-[#1A2B3C]">+</span>
          </button>
          <button className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center active:bg-gray-50">
            <span className="text-lg font-bold text-[#1A2B3C]">−</span>
          </button>
        </div>
      </div>

      {/* Stats Overlay */}
      <div className="bg-white rounded-t-2xl shadow-lg p-4 pb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-[#F5F7FA] rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <Timer className="w-5 h-5 text-[#0D7377]" />
            </div>
            <div>
              <p className="text-[10px] text-[#8B9DAB]">Tiempo en sitio</p>
              <p className="text-lg font-bold text-[#1A2B3C]">02:45:30</p>
            </div>
          </div>
          <div className="bg-[#F5F7FA] rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Route className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] text-[#8B9DAB]">Distancia</p>
              <p className="text-lg font-bold text-[#1A2B3C]">12.4 km</p>
            </div>
          </div>
        </div>

        <button className="w-full py-4 bg-[#0D7377] text-white font-semibold text-sm rounded-xl active:scale-[0.98] transition-transform shadow-md">
          Finalizar tracker
        </button>
      </div>
    </div>
  );
}
