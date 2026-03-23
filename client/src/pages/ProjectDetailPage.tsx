import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FolderOpen, File, FolderPlus, FilePlus, ArrowLeft, Code2,
  Trash2, MoreVertical, Pencil, ChevronRight, Home, Download, FileCode
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

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

function getFileIcon(name: string, type: string) {
  if (type === "folder") return <FolderOpen className="h-5 w-5 text-amber-500 shrink-0" />;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const colorMap: Record<string, string> = {
    ts: "text-blue-400", tsx: "text-blue-400", js: "text-yellow-400", jsx: "text-yellow-400",
    py: "text-green-400", rs: "text-orange-400", java: "text-red-400",
    html: "text-orange-500", css: "text-cyan-400", json: "text-yellow-300",
    md: "text-gray-400", sql: "text-violet-400",
  };
  return <FileCode className={`h-5 w-5 shrink-0 ${colorMap[ext] || "text-muted-foreground"}`} />;
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

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentFolder(null);
      setFolderStack([]);
    } else {
      const target = folderStack[index];
      if (target) {
        setCurrentFolder(target.id);
        setFolderStack(s => s.slice(0, index));
      }
    }
  };

  const sortedFiles = files ? [...files].sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  }) : [];

  if (projectLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!project) return <div className="text-center py-16 text-muted-foreground">Proyecto no encontrado</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            {project.language && <Badge variant="secondary">{project.language}</Badge>}
            <Badge variant="outline" className="text-xs">
              {files?.length ?? 0} elementos
            </Badge>
          </div>
          {project.description && <p className="text-muted-foreground mt-1 text-sm">{project.description}</p>}
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1 text-sm bg-muted/30 rounded-lg px-3 py-2 border border-border/30">
        <button
          onClick={() => navigateToBreadcrumb(-1)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">raíz</span>
        </button>
        {folderStack.map((folder, index) => (
          <div key={index} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <button
              onClick={() => navigateToBreadcrumb(index)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {folder.name}
            </button>
          </div>
        ))}
        {currentFolder !== null && folderStack.length > 0 && (
          <div className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-xs font-medium text-foreground">
              {folderStack[folderStack.length - 1]?.name || "..."}
            </span>
          </div>
        )}
      </nav>

      {/* File Manager */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">Archivos</CardTitle>
              {currentFolder !== null && (
                <Button variant="ghost" size="sm" onClick={navigateBack} className="text-xs h-7">
                  <ArrowLeft className="h-3 w-3 mr-1" />Atrás
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Dialog open={newFileDialog} onOpenChange={setNewFileDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" onClick={() => setNewFileType("folder")} className="h-8">
                    <FolderPlus className="h-4 w-4 mr-1" />Carpeta
                  </Button>
                </DialogTrigger>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => setNewFileType("file")} className="h-8">
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
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      {newFileType === "file"
                        ? "El lenguaje se detectará automáticamente por la extensión del archivo."
                        : "Las carpetas pueden contener archivos y subcarpetas."}
                    </p>
                    <Button type="submit" className="w-full" disabled={createFileMutation.isPending}>
                      {createFileMutation.isPending ? "Creando..." : `Crear ${newFileType === "folder" ? "Carpeta" : "Archivo"}`}
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
          ) : sortedFiles.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
                <FolderOpen className="h-8 w-8 opacity-40" />
              </div>
              <p className="text-sm font-medium">Carpeta vacía</p>
              <p className="text-xs mt-1 max-w-xs mx-auto">
                Crea archivos o carpetas para comenzar a organizar tu proyecto.
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => { setNewFileType("folder"); setNewFileDialog(true); }}>
                  <FolderPlus className="h-4 w-4 mr-1" />Nueva Carpeta
                </Button>
                <Button size="sm" onClick={() => { setNewFileType("file"); setNewFileDialog(true); }}>
                  <FilePlus className="h-4 w-4 mr-1" />Nuevo Archivo
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {sortedFiles.map(file => (
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
                    {getFileIcon(file.name, file.type)}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      {file.language && file.language !== "text" && (
                        <p className="text-xs text-muted-foreground">{file.language}</p>
                      )}
                    </div>
                    {file.type === "folder" && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    )}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {file.type === "file" && (
                        <DropdownMenuItem onClick={() => setLocation(`/editor/${projectId}/${file.id}`)}>
                          <Pencil className="mr-2 h-4 w-4" />Editar en IDE
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
