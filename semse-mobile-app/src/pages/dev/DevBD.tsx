import { Table, ArrowRight } from 'lucide-react';

const schemas = [
  { name: 'projects', desc: 'Proyectos y obras', rows: '2,450' },
  { name: 'users', desc: 'Usuarios del sistema', rows: '8,120' },
  { name: 'payments', desc: 'Transacciones y escrow', rows: '15,300' },
  { name: 'evidence', desc: 'Evidencias fotográficas', rows: '45,200' },
  { name: 'jobs', desc: 'Trabajos y tareas', rows: '12,800' },
  { name: 'milestones', desc: 'Hitos de proyectos', rows: '6,400' },
];

export default function DevBD() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Base de Datos</h1>
        <p className="text-sm text-slate-400 mt-1">Esquemas y tablas del sistema.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {schemas.map((s) => (
          <div key={s.name} className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Table className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white font-mono">{s.name}</h3>
                <p className="text-[10px] text-slate-400">{s.desc}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
              <span className="text-[10px] text-slate-500">{s.rows} registros</span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </div>
          </div>
        ))}
      </div>

      {/* Schema Preview */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Esquema SQL Preview</h3>
          <span className="text-[10px] text-slate-500">projects</span>
        </div>
        <pre className="p-4 text-[10px] text-slate-300 font-mono overflow-x-auto leading-relaxed">
{`CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  progress INTEGER DEFAULT 0,
  budget DECIMAL(12,2),
  client_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);`}
        </pre>
      </div>
    </div>
  );
}
