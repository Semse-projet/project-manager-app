import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderOpen, File, FolderPlus, FilePlus, ArrowLeft, Code2,
  Trash2, MoreVertical, Pencil
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

const FILE_LANGUAGES = [
  "javascript", "typescript", "python", "java", "cpp", "rust", "html", "css", "json", "markdown", "sql", "xml", "php"
];

function getLanguageFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", java: "java", cpp: "cpp", c: "cpp", h: "cpp",
    rs: "rust", html: "html", htm: "html", css: "css", json: "json",
    md: "markdown", sql: "sql", xml: "xml", php: "php",
  };
  return map[ext] || "text";
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);
  const [folderStack, setFolderStack] = useState<{ id: number | null; name: string }[]>([]);
  const [newFileDialog, setNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileType, setNewFileType] = useState<"file" | "folder">("file");

  const utils = trpc.useUtils();
  const { data: project, isLoading: projectLoading } = trpc.projects.get.useQuery({ id: projectId });
  const { data: files, isLoading: filesLoading } = trpc.files.list.useQuery({
    projectId,
    parentId: currentFolder,
  });

  const createFileMutation = trpc.files.create.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate();
      setNewFileDialog(false);
      setNewFileName("");
      toast.success(newFileType === "folder" ? "Carpeta creada" : "Archivo creado");
    },
  });

  const deleteFileMutation = trpc.files.delete.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate();
      toast.success("Eliminado exitosamente");
    },
  });

  const navigateToFolder = (folderId: number, folderName: string) => {
    setFolderStack(prev => [...prev, { id: currentFolder, name: folderName }]);
    setCurrentFolder(folderId);
  };

  const navigateBack = () => {
    const prev = folderStack[folderStack.length - 1];
    if (prev) {
      setCurrentFolder(prev.id);
      setFolderStack(s => s.slice(0, -1));
    }
  };

  if (projectLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!project) return <div className="text-center py-16 text-muted-foreground">Proyecto no encontrado</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            {project.language && <Badge variant="secondary">{project.language}</Badge>}
          </div>
          {project.description && <p className="text-muted-foreground mt-1 text-sm">{project.description}</p>}
        </div>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">Archivos</CardTitle>
              {currentFolder !== null && (
                <Button variant="ghost" size="sm" onClick={navigateBack} className="text-xs">
                  <ArrowLeft className="h-3 w-3 mr-1" />Atrás
                </Button>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="cursor-pointer hover:text-foreground" onClick={() => { setCurrentFolder(null); setFolderStack([]); }}>
                  /
                </span>
                {folderStack.map((f, i) => (
                  <span key={i}>
                    <span className="cursor-pointer hover:text-foreground" onClick={() => {
                      setCurrentFolder(f.id);
                      setFolderStack(s => s.slice(0, i));
                    }}>
                      {f.name}
                    </span>/
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={newFileDialog} onOpenChange={setNewFileDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" onClick={() => setNewFileType("folder")}>
                    <FolderPlus className="h-4 w-4 mr-1" />Carpeta
                  </Button>
                </DialogTrigger>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => setNewFileType("file")}>
                    <FilePlus className="h-4 w-4 mr-1" />Archivo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear {newFileType === "folder" ? "Carpeta" : "Archivo"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!newFileName.trim()) return;
                    createFileMutation.mutate({
                      projectId,
                      parentId: currentFolder,
                      name: newFileName,
                      type: newFileType,
                      language: newFileType === "file" ? getLanguageFromName(newFileName) : undefined,
                      content: newFileType === "file" ? "" : undefined,
                    });
                  }} className="space-y-4">
                    <Input
                      placeholder={newFileType === "folder" ? "Nombre de la carpeta" : "nombre_archivo.ext"}
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      required
                    />
                    <Button type="submit" className="w-full" disabled={createFileMutation.isPending}>
                      Crear
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filesLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !files || files.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Carpeta vacía</p>
              <p className="text-xs mt-1">Crea archivos o carpetas para comenzar</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {files.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 py-2.5 px-2 rounded-md hover:bg-accent/50 transition-colors group"
                >
                  <button
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    onClick={() => {
                      if (file.type === "folder") {
                        navigateToFolder(file.id, file.name);
                      } else {
                        setLocation(`/editor/${projectId}/${file.id}`);
                      }
                    }}
                  >
                    {file.type === "folder" ? (
                      <FolderOpen className="h-5 w-5 text-amber-500 shrink-0" />
                    ) : (
                      <File className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      {file.language && (
                        <p className="text-xs text-muted-foreground">{file.language}</p>
                      )}
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {file.type === "file" && (
                        <DropdownMenuItem onClick={() => setLocation(`/editor/${projectId}/${file.id}`)}>
                          <Pencil className="mr-2 h-4 w-4" />Editar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteFileMutation.mutate({ id: file.id })}>
                        <Trash2 className="mr-2 h-4 w-4" />Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
