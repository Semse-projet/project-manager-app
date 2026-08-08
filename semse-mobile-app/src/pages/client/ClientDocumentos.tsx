import { FileText, Download, Plus } from 'lucide-react';
import { useClientDocuments } from '@/hooks/useClientDocuments';

export default function ClientDocumentos() {
  const { documents: contractDocs } = useClientDocuments();

  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold text-[#1A2B3C]">Documentos del proyecto</h2>
        <p className="text-sm text-[#8B9DAB] mt-1">Contratos y documentos relacionados</p>
      </div>

      {/* Docs List */}
      <div className="px-4 py-2 space-y-2">
        {contractDocs.map((doc, idx) => (
          <div key={doc.id} className={`bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 stagger-${idx + 1}`}>
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A2B3C] truncate">{doc.name}</p>
              <p className="text-xs text-[#8B9DAB]">{doc.type} • {doc.size}</p>
            </div>
            <button className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center active:bg-gray-100">
              <Download className="w-4 h-4 text-[#5A6B7D]" />
            </button>
          </div>
        ))}
      </div>

      {/* Upload Button */}
      <div className="px-4 py-4">
        <button className="w-full py-3.5 border-2 border-dashed border-gray-200 text-[#0D7377] font-medium text-sm rounded-xl flex items-center justify-center gap-2 active:bg-gray-50">
          <Plus className="w-4 h-4" />
          Subir documento
        </button>
      </div>
    </div>
  );
}
