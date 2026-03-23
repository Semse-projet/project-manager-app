import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Settings, Code2, Sparkles, Palette, Save, Loader2, User } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { data: prefs, isLoading } = trpc.preferences.get.useQuery();
  const updateMutation = trpc.preferences.update.useMutation({
    onSuccess: () => {
      toast.success("Configuración guardada");
      utils.preferences.get.invalidate();
    },
  });
  const utils = trpc.useUtils();

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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground mt-1">Personaliza tu experiencia en WebAssistant</p>
      </div>

      {/* Profile */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" />Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{user?.name || "Usuario"}</p>
              <p className="text-sm text-muted-foreground">{user?.email || "-"}</p>
              <p className="text-xs text-muted-foreground mt-1 capitalize">Rol: {user?.role || "user"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" />Apariencia</CardTitle>
          <CardDescription>Personaliza el tema visual de la interfaz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Tema Oscuro</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Activa el modo oscuro para reducir fatiga visual</p>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={() => toggleTheme?.()} />
          </div>
        </CardContent>
      </Card>

      {/* Editor Settings */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Code2 className="h-4 w-4" />Editor de Código</CardTitle>
          <CardDescription>Configura el comportamiento del editor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tamaño de Fuente: {settings.editorFontSize}px</Label>
            </div>
            <Slider
              value={[settings.editorFontSize]}
              onValueChange={([v]) => setSettings(s => ({ ...s, editorFontSize: v }))}
              min={10} max={32} step={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Tamaño de Tabulación</Label>
            <Select
              value={String(settings.editorTabSize)}
              onValueChange={(v) => setSettings(s => ({ ...s, editorTabSize: parseInt(v) }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 espacios</SelectItem>
                <SelectItem value="4">4 espacios</SelectItem>
                <SelectItem value="8">8 espacios</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Ajuste de Línea</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Ajustar líneas largas al ancho del editor</p>
              </div>
              <Switch checked={settings.editorWordWrap} onCheckedChange={(v) => setSettings(s => ({ ...s, editorWordWrap: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Minimapa</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Mostrar vista previa del código</p>
              </div>
              <Switch checked={settings.editorMinimap} onCheckedChange={(v) => setSettings(s => ({ ...s, editorMinimap: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Números de Línea</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Mostrar números de línea en el margen</p>
              </div>
              <Switch checked={settings.editorLineNumbers} onCheckedChange={(v) => setSettings(s => ({ ...s, editorLineNumbers: v }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" />Inteligencia Artificial</CardTitle>
          <CardDescription>Configura el comportamiento del asistente de IA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Comentarios Automáticos</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Sugerir comentarios al guardar archivos</p>
            </div>
            <Switch checked={settings.aiAutoComment} onCheckedChange={(v) => setSettings(s => ({ ...s, aiAutoComment: v }))} />
          </div>
          <div className="space-y-2">
            <Label>Idioma de Respuestas IA</Label>
            <Select value={settings.aiLanguage} onValueChange={(v) => setSettings(s => ({ ...s, aiLanguage: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full">
        {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Guardar Configuración
      </Button>
    </div>
  );
}
