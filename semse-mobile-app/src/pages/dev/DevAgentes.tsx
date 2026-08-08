import { Bot } from 'lucide-react';

const agents = [
  { name: 'QA-Bot', desc: 'Automatización de pruebas de calidad', status: 'running', tasks: 142 },
  { name: 'Deploy-Bot', desc: 'Gestión de despliegues automáticos', status: 'running', tasks: 89 },
  { name: 'Doc-Bot', desc: 'Generación de documentación', status: 'idle', tasks: 34 },
  { name: 'Data-Bot', desc: 'Gestión de seed de datos', status: 'running', tasks: 56 },
  { name: 'Report-Bot', desc: 'Generación de reportes', status: 'idle', tasks: 23 },
];

export default function DevAgentes() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Agentes y Autonomía</h1>
        <p className="text-sm text-slate-400 mt-1">Agentes operativos del sistema.</p>
      </div>

      <div className="space-y-3">
        {agents.map((agent, idx) => (
          <div key={idx} className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#14A0A0]/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-[#14A0A0]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    agent.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                  }`}>
                    {agent.status === 'running' ? 'Ejecutando' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{agent.desc}</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-white">{agent.tasks}</span>
                <p className="text-[10px] text-slate-500">tareas</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
