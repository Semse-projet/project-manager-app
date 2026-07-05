import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Hash, 
  FileText, 
  Copy, 
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FolderOpen,
  XCircle
} from 'lucide-react';

interface FileEntry {
  id: string;
  name: string;
  hash: string;
  timestamp: number;
}

export function HashGenerator() {
  const [filename, setFilename] = useState('');
  const [generatedHash, setGeneratedHash] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [showCollisionWarning, setShowCollisionWarning] = useState(false);

  // Generar hash simple (simulando SHA256)
  const generateHash = (input: string) => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    // Convertir a hex positivo de 12 caracteres
    const hexHash = Math.abs(hash).toString(16).padStart(12, '0').slice(0, 12);
    return hexHash;
  };

  const handleGenerate = () => {
    if (!filename.trim()) return;
    
    const hash = generateHash(filename + Date.now());
    setGeneratedHash(hash);
    
    // Verificar colisión
    const collision = files.find(f => f.name === filename);
    if (collision) {
      setShowCollisionWarning(true);
    } else {
      setShowCollisionWarning(false);
      const newFile: FileEntry = {
        id: Date.now().toString(),
        name: filename,
        hash,
        timestamp: Date.now(),
      };
      setFiles(prev => [newFile, ...prev].slice(0, 10));
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`temp_${filename.replace(/\s+/g, '_')}_${generatedHash}.pdf`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearFiles = () => {
    setFiles([]);
    setGeneratedHash('');
    setFilename('');
    setShowCollisionWarning(false);
  };

  const generateSafeName = (name: string, hash: string) => {
    const safeName = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    return `temp_${safeName}_${hash}.pdf`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Generador de Hash Único</h2>
        <p className="text-muted-foreground">
          Crea nombres de archivo únicos usando hash SHA256 para evitar colisiones
        </p>
      </div>

      {/* Problem Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <XCircle className="w-4 h-4" />
              Problema: temp.pdf fijo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Usar <code className="bg-red-500/20 px-1 rounded text-red-300">"temp.pdf"</code> como 
              nombre fijo causa colisiones cuando múltiples usuarios suben archivos simultáneamente.
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              Solución: Hash único
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Usar <code className="bg-green-500/20 px-1 rounded text-green-300">hashlib.sha256</code> 
              genera un identificador único por archivo, eliminando colisiones.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Hash Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="w-5 h-5" />
            Generar Nombre de Archivo
          </CardTitle>
          <CardDescription>
            Ingresa el nombre original del PDF para generar un nombre único
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="mi_documento.pdf"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleGenerate} disabled={!filename.trim()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Generar
            </Button>
          </div>

          {generatedHash && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground mb-1">Nombre generado:</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-lg font-mono text-green-400 break-all">
                    {generateSafeName(filename, generatedHash)}
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <p className="text-xs text-blue-400 mb-1">Hash (12 chars)</p>
                  <code className="font-mono text-white">{generatedHash}</code>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <p className="text-xs text-purple-400 mb-1">Nombre seguro</p>
                  <code className="font-mono text-white">{filename.replace(/\s+/g, '_')}</code>
                </div>
              </div>

              {showCollisionWarning && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-300">
                      ¡Colisión detectada!
                    </p>
                    <p className="text-xs text-yellow-300/70 mt-1">
                      Este nombre de archivo ya existe. El hash único evita que se sobrescriba.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* File History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Archivos Generados
            </CardTitle>
            <CardDescription>
              Historial de nombres únicos generados
            </CardDescription>
          </div>
          {files.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearFiles}>
              <XCircle className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay archivos generados aún</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div 
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 animate-slide-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-500/20">
                      <FileText className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <code className="text-sm text-white">
                        {generateSafeName(file.name, file.hash)}
                      </code>
                      <p className="text-xs text-muted-foreground">
                        Original: {file.name}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {new Date(file.timestamp).toLocaleTimeString()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Code Example */}
      <Card className="border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-sm">Código Python</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm font-mono text-muted-foreground overflow-x-auto">
            <code>{`import hashlib
from pathlib import Path

def save_temp_pdf(file_bytes: bytes, original_name: str) -> str:
    """Guarda el PDF en un archivo temporal único."""
    safe_name = Path(original_name).stem.replace(" ", "_")
    digest = hashlib.sha256(file_bytes).hexdigest()[:12]
    
    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=f"_{safe_name}_{digest}.pdf"
    ) as tmp:
        tmp.write(file_bytes)
        return tmp.name`}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
