import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Plus, Trash2, Search, Save, ArrowLeft, Clock, Loader2, Download, PenLine } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { Streamdown } from "streamdown";

const typeLabels: Record<string, string> = {
  note: "Nota",
  documentation: "Documentación",
  generated: "Generado por IA",
};

const typeColors: Record<string, string> = {
  note: "bg-blue-500/10 text-blue-500",
  documentation: "bg-emerald-500/10 text-emerald-500",
  generated: "bg-violet-500/10 text-violet-500",
};

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", type: "note" as "note" | "documentation" | "generated" });
  const [editContent, setEditContent] = useState("");
  const [showVersions, setShowVersions] = useState(false);

  const utils = trpc.useUtils();
  const { data: docs, isLoading } = trpc.documents.list.useQuery();
  const { data: currentDoc } = trpc.documents.get.useQuery(
    { id: selectedDoc! },
    { enabled: !!selectedDoc }
  );
  const { data: versions } = trpc.documents.versions.useQuery(
    { documentId: selectedDoc! },
    { enabled: !!selectedDoc && showVersions }
  );

  const createMutation = trpc.documents.create.useMutation({
    onSuccess: (doc) => {
      utils.documents.list.invalidate();
      setCreateOpen(false);
      setNewDoc({ title: "", type: "note" });
      if (doc) setSelectedDoc(doc.id);
      toast.success("Documento creado");
    },
  });

  const updateMutation = trpc.documents.update.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
      toast.success("Documento guardado");
    },
  });

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
      setSelectedDoc(null);
      toast.success("Documento eliminado");
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Escribe aquí..." }),
      Highlight,
    ],
    content: "",
    onUpdate: ({ editor }) => {
      setEditContent(editor.getHTML());
    },
  });

  useEffect(() => {
    if (currentDoc && editor) {
      const currentContent = currentDoc.content || "";
      if (editor.getHTML() !== currentContent) {
        editor.commands.setContent(currentContent);
        setEditContent(currentContent);
      }
    }
  }, [currentDoc, editor]);

  const filtered = docs?.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  if (selectedDoc && currentDoc) {
    return (
      <div className="space-y-4 h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedDoc(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{currentDoc.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className={`text-xs ${typeColors[currentDoc.type]}`}>
                  {typeLabels[currentDoc.type]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Editado {formatDistanceToNow(new Date(currentDoc.updatedAt), { addSuffix: true, locale: es })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowVersions(!showVersions)}
            >
              <Clock className="h-4 w-4 mr-1" />Versiones
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => {
                const content = currentDoc.type === "generated" ? currentDoc.content || "" : editContent;
                const blob = new Blob([content], { type: "text/markdown" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${currentDoc.title}.md`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Documento descargado");
              }}
            >
              <Download className="h-4 w-4 mr-1" />Descargar
            </Button>
            <Button
              size="sm"
              onClick={() => updateMutation.mutate({ id: currentDoc.id, content: editContent })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Guardar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100%-4rem)]">
          <div className={`border rounded-lg bg-card overflow-hidden ${showVersions ? "lg:col-span-3" : "lg:col-span-4"}`}>
            {currentDoc.type === "generated" ? (
              <ScrollArea className="h-full p-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Streamdown>{currentDoc.content || ""}</Streamdown>
                </div>
              </ScrollArea>
            ) : (
              <div className="h-full p-4">
                <EditorContent editor={editor} className="h-full prose prose-sm dark:prose-invert max-w-none [&_.tiptap]:outline-none [&_.tiptap]:h-full" />
              </div>
            )}
          </div>

          {showVersions && (
            <div className="border rounded-lg bg-card overflow-hidden">
              <div className="p-3 border-b">
                <h3 className="text-sm font-semibold">Historial de Versiones</h3>
              </div>
              <ScrollArea className="h-[calc(100%-3rem)]">
                {!versions || versions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Clock className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p>Sin versiones anteriores</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {versions.map(v => (
                      <button
                        key={v.id}
                        className="w-full text-left p-3 hover:bg-accent/50 transition-colors"
                        onClick={() => {
                          if (editor && v.content) {
                            editor.commands.setContent(v.content);
                            setEditContent(v.content);
                            toast.info(`Versión ${v.versionNumber} restaurada`);
                          }
                        }}
                      >
                        <p className="text-sm font-medium">Versión {v.versionNumber}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true, locale: es })}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
          <p className="text-muted-foreground mt-1">Notas, documentación y documentos generados por IA</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Documento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear Documento</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (!newDoc.title.trim()) return; createMutation.mutate(newDoc); }} className="space-y-4">
              <Input placeholder="Título del documento" value={newDoc.title} onChange={(e) => setNewDoc(d => ({ ...d, title: e.target.value }))} required />
              <Select value={newDoc.type} onValueChange={(v: any) => setNewDoc(d => ({ ...d, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Nota</SelectItem>
                  <SelectItem value="documentation">Documentación</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Crear</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar documentos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
            <PenLine className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-lg font-medium">No hay documentos</p>
          <p className="text-sm mt-1 max-w-xs mx-auto">Crea notas, documentación técnica o genera documentos con IA.</p>
          <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Crear Documento
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <Card key={doc.id} className="cursor-pointer hover:shadow-md transition-all border-border/50 group" onClick={() => setSelectedDoc(doc.id)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{doc.title}</h3>
                      <Badge variant="secondary" className={`mt-1 text-xs ${typeColors[doc.type]}`}>
                        {typeLabels[doc.type]}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: doc.id }); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true, locale: es })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
