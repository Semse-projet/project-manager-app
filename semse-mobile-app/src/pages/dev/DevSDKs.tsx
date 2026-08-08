import { Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';

const sdks = [
  { name: 'JavaScript / TypeScript', desc: 'SDK oficial para Node.js', install: 'npm install @semse/sdk', icon: 'JS', color: 'bg-yellow-500/10 text-yellow-400' },
  { name: 'Python', desc: 'SDK oficial para Python', install: 'pip install semse-sdk', icon: 'PY', color: 'bg-blue-500/10 text-blue-400' },
  { name: 'PHP', desc: 'SDK oficial para PHP', install: 'composer require semse/sdk', icon: 'PHP', color: 'bg-purple-500/10 text-purple-400' },
  { name: 'Dart (Flutter)', desc: 'SDK para Flutter', install: 'flutter pub add semse_sdk', icon: 'DF', color: 'bg-cyan-500/10 text-cyan-400' },
  { name: 'cURL', desc: 'Ejemplos con cURL', install: 'curl -X GET https://api.semse...', icon: 'CR', color: 'bg-slate-500/10 text-slate-400' },
];

export default function DevSDKs() {
  const [copied, setCopied] = useState<number | null>(null);

  const handleCopy = (idx: number) => {
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">SDKs y Librerías</h1>
        <p className="text-sm text-slate-400 mt-1">Integra SEMSEproject en tu stack tecnológico.</p>
      </div>

      <div className="space-y-3">
        {sdks.map((sdk, idx) => (
          <div key={idx} className="bg-[#0F1D32] border border-white/5 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg ${sdk.color} flex items-center justify-center flex-shrink-0`}>
                <span className="text-xs font-bold">{sdk.icon}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{sdk.name}</h3>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{sdk.desc}</p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-[#0B1628] rounded-lg text-xs text-slate-300 font-mono border border-white/5">{sdk.install}</code>
                  <button onClick={() => handleCopy(idx)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                    {copied === idx ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-4 w-full py-3 bg-[#14A0A0]/10 text-[#14A0A0] text-sm font-medium rounded-xl border border-[#14A0A0]/20 hover:bg-[#14A0A0]/20 transition-colors">
        Ver todos los SDKs →
      </button>
    </div>
  );
}
