import { useState } from 'react';
import { Play, Copy, Check } from 'lucide-react';

const methods = ['GET', 'POST', 'PUT', 'DELETE'];

export default function DevExplorer() {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('/projects/123');
  const [response] = useState(`{\n  "id": "prj_123456",\n  "name": "Remodelación Cocina Centro Comercial",\n  "status": "in_progress",\n  "progress": 65,\n  "created_at": "2026-04-19T10:30:00Z"\n}`);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">API Explorer</h1>
        <p className="text-sm text-slate-400 mt-1">Prueba los endpoints de la API en tiempo real.</p>
      </div>

      {/* Request Builder */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl p-4 mb-4">
        <div className="flex gap-2 mb-4">
          {methods.map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                method === m
                  ? m === 'GET' ? 'bg-blue-500/20 text-blue-400' :
                    m === 'POST' ? 'bg-emerald-500/20 text-emerald-400' :
                    m === 'PUT' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 h-10 px-3 bg-[#0B1628] rounded-lg text-xs text-slate-300 font-mono border border-white/5 focus:outline-none focus:border-[#14A0A0]/30"
          />
          <button className="px-4 h-10 bg-[#14A0A0] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-[#14A0A0]/80 transition-colors">
            <Play className="w-3 h-3" />
            Enviar
          </button>
        </div>
      </div>

      {/* Params & Headers */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl overflow-hidden mb-4">
        <div className="flex border-b border-white/5">
          {['Parámetros', 'Headers (2)', 'Respuesta'].map((tab, i) => (
            <button key={tab} className={`px-4 py-2.5 text-xs font-medium transition-colors ${
              i === 2 ? 'text-[#14A0A0] border-b-2 border-[#14A0A0]' : 'text-slate-400 hover:text-slate-200'
            }`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">id</label>
              <input type="text" defaultValue="prj_123456" className="w-full h-8 px-2 bg-[#0B1628] rounded text-xs text-slate-300 font-mono border border-white/5" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">lang</label>
              <input type="text" defaultValue="es" className="w-full h-8 px-2 bg-[#0B1628] rounded text-xs text-slate-300 font-mono border border-white/5" />
            </div>
          </div>

          {/* Headers */}
          <div className="mb-4 space-y-2">
            <div className="flex gap-2">
              <span className="text-[10px] text-slate-400 w-28">Authorization</span>
              <span className="text-xs text-amber-400 font-mono">Bearer ********</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[10px] text-slate-400 w-28">Content-Type</span>
              <span className="text-xs text-slate-300 font-mono">application/json</span>
            </div>
          </div>
        </div>
      </div>

      {/* Response */}
      <div className="bg-[#0F1D32] border border-white/5 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">200 OK</span>
          </div>
          <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-[#14A0A0] transition-colors">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <pre className="p-4 text-xs text-slate-300 font-mono overflow-x-auto">
          <code>{response}</code>
        </pre>
        <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Tiempo: 142ms</span>
          <span className="text-[10px] text-slate-500">Tamaño: 1.2 KB</span>
        </div>
      </div>
    </div>
  );
}
