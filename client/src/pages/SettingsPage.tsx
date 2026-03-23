import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { PageTransition } from "@/components/PageTransition";
import { Settings, Code2, Sparkles, Palette, Save, Loader2, User, Keyboard, Command } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

const defaultShortcuts = [
  { action: "Guardar archivo", keys: "Ctrl + S", category: "Editor" },
  { action: "Búsqueda global", keys: "Ctrl + K", category: "Navegación" },
  { action: "Cerrar pestaña", keys: "Ctrl + W", category: "Editor" },
  { action: "Nuevo proyecto", keys: "Ctrl + N", category: "Proyectos" },
  { action: "Generar comentarios IA", keys: "Ctrl + Shift + C", category: "IA" },
  { action: "Generar documentación", keys: "Ctrl + Shift + D", category: "IA" },
  { action: "Análisis de bugs", keys: "Ctrl + Shift + B", category: "IA" },
  { action: "Cambiar tema", keys: "Ctrl + Shift + T", category: "Apariencia" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { data: prefs, isLoading } = trpc.preferences.get.useQuery();
  const utils = trpc.useUtils();
  const updateMutation = trpc.preferences.update.useMutation({
    onSuccess: () => {
      toast.success("Configuración guardada");
      utils.preferences.get.invalidate();
    },
  });

  const [settings, setSettings] = useState({
    editorFontSize: 14,
    editorTabSize: 2,
    editorWordWrap: true,
    editorMinimap: false,
    editorLineNumbers: true,
    aiAutoComment: true,
    aiLanguage: "es",
  });

  useEffect(() => {
    if (prefs) {
      setSettings({
        editorFontSize: prefs.editorFontSize,
        editorTabSize: prefs.editorTabSize,
        editorWordWrap: prefs.editorWordWrap,
        editorMinimap: prefs.editorMinimap,
        editorLineNumbers: prefs.editorLineNumbers,
        aiAutoComment: prefs.aiAutoComment,
        aiLanguage: prefs.aiLanguage,
      });
    }
  }, [prefs]);

  const handleSave = () => {
    updateMutation.mutate({
      ...settings,
      theme: theme as "light" | "dark",
    });
  };

  return (
    <PageTransition className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">Personaliza tu experiencia en WebAssistant</p>
      </div>

      {/* Profile */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" />Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-lg bg-primary/10 text-primary font-bold">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold truncate">{user?.name || "Usuario"}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email || "-"}</p>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">Rol: {user?.role || "user"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4 text-primary" />Apariencia</CardTitle>
          <CardDescription className="text-xs">Personaliza el tema visual de la interfaz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Tema Oscuro</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Activa el modo oscuro para reducir fatiga visual</p>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={() => toggleTheme?.()} />
          </div>
        </CardContent>
      </Card>

      {/* Editor Settings */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Code2 className="h-4 w-4 text-primary" />Editor de Código</CardTitle>
          <CardDescription className="text-xs">Configura el comportamiento del editor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Tamaño de Fuente: {settings.editorFontSize}px</Label>
            </div>
            <Slider
              value={[settings.editorFontSize]}
              onValueChange={([v]) => setSettings(s => ({ ...s, editorFontSize: v }))}
              min={10} max={32} step={1}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Tamaño de Tabulación</Label>
            <Select
              value={String(settings.editorTabSize)}
              onValueChange={(v) => setSettings(s => ({ ...s, editorTabSize: parseInt(v) }))}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 espacios</SelectItem>
                <SelectItem value="4">4 espacios</SelectItem>
                <SelectItem value="8">8 espacios</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            {[
              { key: "editorWordWrap" as const, label: "Ajuste de Línea", desc: "Ajustar líneas largas al ancho del editor" },
              { key: "editorMinimap" as const, label: "Minimapa", desc: "Mostrar vista previa del código" },
              { key: "editorLineNumbers" as const, label: "Números de Línea", desc: "Mostrar números en el margen" },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">{item.label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <Switch
                  checked={settings[item.key]}
                  onCheckedChange={(v) => setSettings(s => ({ ...s, [item.key]: v }))}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Inteligencia Artificial</CardTitle>
          <CardDescription className="text-xs">Configura el comportamiento del asistente de IA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Comentarios Automáticos</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Sugerir comentarios al guardar archivos</p>
            </div>
            <Switch checked={settings.aiAutoComment} onCheckedChange={(v) => setSettings(s => ({ ...s, aiAutoComment: v }))} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Idioma de Respuestas IA</Label>
            <Select value={settings.aiLanguage} onValueChange={(v) => setSettings(s => ({ ...s, aiLanguage: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Keyboard className="h-4 w-4 text-primary" />Atajos de Teclado</CardTitle>
          <CardDescription className="text-xs">Referencia rápida de atajos disponibles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {defaultShortcuts.map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">{shortcut.category}</span>
                  <span className="text-sm">{shortcut.action}</span>
                </div>
                <kbd className="px-2 py-0.5 text-[11px] font-mono bg-muted/50 border border-border/50 rounded text-muted-foreground">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full" size="sm">
        {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Guardar Configuración
      </Button>

      <div className="h-8" />
    </PageTransition>
  );
}
