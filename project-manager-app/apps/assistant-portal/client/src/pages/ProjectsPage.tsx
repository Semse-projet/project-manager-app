import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderKanban, Plus, Code2, MoreVertical, Archive, Trash2, Search,
  FileCode, Braces, Hash, Cpu, Globe, Layers, Sparkles, Zap
} from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const LANGUAGES = ["JavaScript", "TypeScript", "Python", "Java", "C++", "Rust", "Go", "PHP", "Ruby", "SQL", "HTML/CSS", "Other"];

interface ProjectTemplate {
  name: string;
  description: string;
  language: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  files: { name: string; type: "file" | "folder"; content?: string; language?: string; children?: { name: string; type: "file"; content: string; language: string }[] }[];
}

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    name: "React App",
    description: "Aplicación React con componentes, hooks y estilos",
    language: "TypeScript",
    icon: Braces,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    files: [
      { name: "src", type: "folder", children: [
        { name: "App.tsx", type: "file", content: `import React, { useState } from 'react';\nimport './App.css';\n\nfunction App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div className="App">\n      <h1>Mi Aplicación React</h1>\n      <div className="card">\n        <button onClick={() => setCount(c => c + 1)}>\n          Contador: {count}\n        </button>\n      </div>\n    </div>\n  );\n}\n\nexport default App;`, language: "TypeScript" },
        { name: "App.css", type: "file", content: `.App {\n  text-align: center;\n  padding: 2rem;\n}\n\n.card {\n  padding: 1rem;\n}\n\nbutton {\n  padding: 0.5rem 1rem;\n  border-radius: 8px;\n  border: 1px solid transparent;\n  font-size: 1rem;\n  cursor: pointer;\n  transition: all 0.2s;\n}\n\nbutton:hover {\n  border-color: #646cff;\n}`, language: "HTML/CSS" },
        { name: "index.tsx", type: "file", content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);`, language: "TypeScript" },
      ]},
      { name: "package.json", type: "file", content: `{\n  "name": "react-app",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^19.0.0",\n    "react-dom": "^19.0.0"\n  },\n  "devDependencies": {\n    "typescript": "^5.0.0",\n    "@types/react": "^19.0.0"\n  }\n}`, language: "JavaScript" },
      { name: "tsconfig.json", type: "file", content: `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "module": "ESNext",\n    "jsx": "react-jsx",\n    "strict": true,\n    "esModuleInterop": true\n  },\n  "include": ["src"]\n}`, language: "JavaScript" },
      { name: "README.md", type: "file", content: `# React App\n\n## Inicio Rápido\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Estructura\n\n- \`src/App.tsx\` - Componente principal\n- \`src/index.tsx\` - Punto de entrada\n`, language: "Other" },
    ],
  },
  {
    name: "Python API",
    description: "API REST con FastAPI, modelos y endpoints",
    language: "Python",
    icon: Hash,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    files: [
      { name: "app", type: "folder", children: [
        { name: "main.py", type: "file", content: `from fastapi import FastAPI\nfrom app.routes import router\n\napp = FastAPI(\n    title="Mi API",\n    description="API REST con FastAPI",\n    version="1.0.0"\n)\n\napp.include_router(router, prefix="/api/v1")\n\n@app.get("/")\nasync def root():\n    return {"message": "Bienvenido a la API", "docs": "/docs"}`, language: "Python" },
        { name: "routes.py", type: "file", content: `from fastapi import APIRouter, HTTPException\nfrom app.models import Item, ItemCreate\nfrom typing import List\n\nrouter = APIRouter()\n\n# Base de datos en memoria (reemplazar con DB real)\nitems_db: List[Item] = []\ncounter = 0\n\n@router.get("/items", response_model=List[Item])\nasync def list_items():\n    return items_db\n\n@router.post("/items", response_model=Item)\nasync def create_item(item: ItemCreate):\n    global counter\n    counter += 1\n    new_item = Item(id=counter, **item.dict())\n    items_db.append(new_item)\n    return new_item\n\n@router.get("/items/{item_id}", response_model=Item)\nasync def get_item(item_id: int):\n    item = next((i for i in items_db if i.id == item_id), None)\n    if not item:\n        raise HTTPException(status_code=404, detail="Item no encontrado")\n    return item`, language: "Python" },
        { name: "models.py", type: "file", content: `from pydantic import BaseModel\nfrom typing import Optional\nfrom datetime import datetime\n\nclass ItemCreate(BaseModel):\n    name: str\n    description: Optional[str] = None\n    price: float = 0.0\n\nclass Item(ItemCreate):\n    id: int\n    created_at: datetime = datetime.now()\n\n    class Config:\n        from_attributes = True`, language: "Python" },
      ]},
      { name: "requirements.txt", type: "file", content: `fastapi==0.109.0\nuvicorn==0.27.0\npydantic==2.5.0`, language: "Other" },
      { name: "README.md", type: "file", content: `# Python API\n\n## Inicio Rápido\n\n\`\`\`bash\npip install -r requirements.txt\nuvicorn app.main:app --reload\n\`\`\`\n\n## Endpoints\n\n- \`GET /\` - Raíz\n- \`GET /api/v1/items\` - Listar items\n- \`POST /api/v1/items\` - Crear item\n- \`GET /docs\` - Documentación Swagger\n`, language: "Other" },
    ],
  },
  {
    name: "Node.js Express",
    description: "Servidor Express con rutas, middleware y TypeScript",
    language: "TypeScript",
    icon: Globe,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    files: [
      { name: "src", type: "folder", children: [
        { name: "index.ts", type: "file", content: `import express from 'express';\nimport cors from 'cors';\nimport { router } from './routes';\nimport { errorHandler } from './middleware';\n\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.use(cors());\napp.use(express.json());\napp.use('/api', router);\napp.use(errorHandler);\n\napp.listen(PORT, () => {\n  console.log(\`Servidor corriendo en http://localhost:\${PORT}\`);\n});`, language: "TypeScript" },
        { name: "routes.ts", type: "file", content: `import { Router, Request, Response } from 'express';\n\nexport const router = Router();\n\nrouter.get('/health', (_req: Request, res: Response) => {\n  res.json({ status: 'ok', timestamp: new Date().toISOString() });\n});\n\nrouter.get('/items', (_req: Request, res: Response) => {\n  res.json({ items: [], total: 0 });\n});\n\nrouter.post('/items', (req: Request, res: Response) => {\n  const { name, description } = req.body;\n  res.status(201).json({ id: Date.now(), name, description });\n});`, language: "TypeScript" },
        { name: "middleware.ts", type: "file", content: `import { Request, Response, NextFunction } from 'express';\n\nexport function errorHandler(\n  err: Error,\n  _req: Request,\n  res: Response,\n  _next: NextFunction\n) {\n  console.error(err.stack);\n  res.status(500).json({\n    error: 'Error interno del servidor',\n    message: err.message,\n  });\n}\n\nexport function logger(req: Request, _res: Response, next: NextFunction) {\n  console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.path}\`);\n  next();\n}`, language: "TypeScript" },
      ]},
      { name: "package.json", type: "file", content: `{\n  "name": "node-express-api",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "tsx watch src/index.ts",\n    "build": "tsc",\n    "start": "node dist/index.js"\n  },\n  "dependencies": {\n    "express": "^4.18.0",\n    "cors": "^2.8.5"\n  },\n  "devDependencies": {\n    "typescript": "^5.0.0",\n    "@types/express": "^4.17.0",\n    "tsx": "^4.0.0"\n  }\n}`, language: "JavaScript" },
      { name: "tsconfig.json", type: "file", content: `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "module": "ESNext",\n    "outDir": "dist",\n    "strict": true,\n    "esModuleInterop": true,\n    "moduleResolution": "bundler"\n  },\n  "include": ["src"]\n}`, language: "JavaScript" },
      { name: "README.md", type: "file", content: `# Node.js Express API\n\n## Inicio Rápido\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Endpoints\n\n- \`GET /api/health\` - Health check\n- \`GET /api/items\` - Listar items\n- \`POST /api/items\` - Crear item\n`, language: "Other" },
    ],
  },
  {
    name: "Rust CLI",
    description: "Aplicación de línea de comandos con Rust y Cargo",
    language: "Rust",
    icon: Cpu,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    files: [
      { name: "src", type: "folder", children: [
        { name: "main.rs", type: "file", content: `use std::env;\nuse std::io::{self, Write};\n\nmod utils;\n\nfn main() {\n    let args: Vec<String> = env::args().collect();\n\n    if args.len() < 2 {\n        print_help();\n        return;\n    }\n\n    match args[1].as_str() {\n        "greet" => {\n            let name = args.get(2).map(|s| s.as_str()).unwrap_or("Mundo");\n            println!("¡Hola, {}!", name);\n        }\n        "calc" => {\n            print!("Ingresa una expresión: ");\n            io::stdout().flush().unwrap();\n            let mut input = String::new();\n            io::stdin().read_line(&mut input).unwrap();\n            println!("Resultado: {}", utils::evaluate(&input.trim()));\n        }\n        _ => print_help(),\n    }\n}\n\nfn print_help() {\n    println!("Uso: mi-cli <comando> [args]");\n    println!("\\nComandos:");\n    println!("  greet [nombre]  - Saluda al usuario");\n    println!("  calc            - Calculadora simple");\n}`, language: "Rust" },
        { name: "utils.rs", type: "file", content: `/// Evalúa una expresión matemática simple\npub fn evaluate(expr: &str) -> String {\n    let parts: Vec<&str> = expr.split_whitespace().collect();\n    if parts.len() != 3 {\n        return "Error: formato esperado 'num op num'".to_string();\n    }\n\n    let a: f64 = match parts[0].parse() {\n        Ok(n) => n,\n        Err(_) => return "Error: primer operando inválido".to_string(),\n    };\n    let b: f64 = match parts[2].parse() {\n        Ok(n) => n,\n        Err(_) => return "Error: segundo operando inválido".to_string(),\n    };\n\n    match parts[1] {\n        "+" => format!("{}", a + b),\n        "-" => format!("{}", a - b),\n        "*" => format!("{}", a * b),\n        "/" => {\n            if b == 0.0 {\n                "Error: división por cero".to_string()\n            } else {\n                format!("{}", a / b)\n            }\n        }\n        _ => "Error: operador no soportado".to_string(),\n    }\n}`, language: "Rust" },
      ]},
      { name: "Cargo.toml", type: "file", content: `[package]\nname = "mi-cli"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`, language: "Other" },
      { name: "README.md", type: "file", content: `# Rust CLI\n\n## Compilar y Ejecutar\n\n\`\`\`bash\ncargo build\ncargo run -- greet "Developer"\ncargo run -- calc\n\`\`\`\n`, language: "Other" },
    ],
  },
  {
    name: "HTML/CSS Landing",
    description: "Página de aterrizaje responsiva con HTML5 y CSS3",
    language: "HTML/CSS",
    icon: Layers,
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    files: [
      { name: "index.html", type: "file", content: `<!DOCTYPE html>\n<html lang="es">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Mi Landing Page</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <header class="hero">\n    <nav>\n      <div class="logo">MiMarca</div>\n      <ul>\n        <li><a href="#features">Características</a></li>\n        <li><a href="#about">Nosotros</a></li>\n        <li><a href="#contact">Contacto</a></li>\n      </ul>\n    </nav>\n    <div class="hero-content">\n      <h1>Bienvenido a MiMarca</h1>\n      <p>La solución que necesitas para tu negocio</p>\n      <a href="#contact" class="cta-button">Comenzar</a>\n    </div>\n  </header>\n\n  <section id="features" class="features">\n    <h2>Características</h2>\n    <div class="features-grid">\n      <div class="feature-card">\n        <h3>Rápido</h3>\n        <p>Rendimiento optimizado para la mejor experiencia.</p>\n      </div>\n      <div class="feature-card">\n        <h3>Seguro</h3>\n        <p>Protección de datos de última generación.</p>\n      </div>\n      <div class="feature-card">\n        <h3>Escalable</h3>\n        <p>Crece con tu negocio sin límites.</p>\n      </div>\n    </div>\n  </section>\n</body>\n</html>`, language: "HTML/CSS" },
      { name: "styles.css", type: "file", content: `* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: 'Inter', sans-serif;\n  color: #333;\n}\n\n.hero {\n  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n  color: white;\n  min-height: 100vh;\n  padding: 2rem;\n}\n\nnav {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  max-width: 1200px;\n  margin: 0 auto;\n}\n\n.logo {\n  font-size: 1.5rem;\n  font-weight: 700;\n}\n\nnav ul {\n  display: flex;\n  list-style: none;\n  gap: 2rem;\n}\n\nnav a {\n  color: white;\n  text-decoration: none;\n  opacity: 0.9;\n}\n\n.hero-content {\n  text-align: center;\n  padding: 8rem 2rem;\n}\n\n.hero-content h1 {\n  font-size: 3rem;\n  margin-bottom: 1rem;\n}\n\n.cta-button {\n  display: inline-block;\n  padding: 1rem 2rem;\n  background: white;\n  color: #667eea;\n  border-radius: 8px;\n  text-decoration: none;\n  font-weight: 600;\n  margin-top: 1.5rem;\n}\n\n.features {\n  padding: 4rem 2rem;\n  text-align: center;\n}\n\n.features h2 {\n  font-size: 2rem;\n  margin-bottom: 2rem;\n}\n\n.features-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));\n  gap: 2rem;\n  max-width: 1200px;\n  margin: 0 auto;\n}\n\n.feature-card {\n  padding: 2rem;\n  border-radius: 12px;\n  background: #f8f9fa;\n}\n\n.feature-card h3 {\n  margin-bottom: 0.5rem;\n  color: #667eea;\n}`, language: "HTML/CSS" },
      { name: "README.md", type: "file", content: `# Landing Page\n\n## Uso\n\nAbrir \`index.html\` en el navegador.\n\n## Personalización\n\n- Editar colores en \`styles.css\`\n- Modificar contenido en \`index.html\`\n`, language: "Other" },
    ],
  },
  {
    name: "Proyecto Vacío",
    description: "Proyecto en blanco para empezar desde cero",
    language: "",
    icon: FileCode,
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    files: [
      { name: "README.md", type: "file", content: `# Mi Proyecto\n\nDescripción del proyecto aquí.\n`, language: "Other" },
    ],
  },
];

export default function ProjectsPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"blank" | "template">("template");
  const [newProject, setNewProject] = useState({ name: "", description: "", language: "" });
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);

  const utils = trpc.useUtils();
  const { data: projects, isLoading } = trpc.projects.list.useQuery();
  const createMutation = trpc.projects.create.useMutation({
    onSuccess: (project) => {
      utils.projects.list.invalidate();
      utils.dashboard.stats.invalidate();
      if (project && selectedTemplate && selectedTemplate.files.length > 0) {
        createTemplateFiles(project.id, selectedTemplate);
      }
      setDialogOpen(false);
      setNewProject({ name: "", description: "", language: "" });
      setSelectedTemplate(null);
      toast.success("Proyecto creado exitosamente");
    },
  });
  const createFileMutation = trpc.files.create.useMutation();
  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
  });

  async function createTemplateFiles(projectId: number, template: ProjectTemplate) {
    for (const file of template.files) {
      if (file.type === "folder" && file.children) {
        const folder = await createFileMutation.mutateAsync({
          projectId,
          name: file.name,
          type: "folder",
        });
        if (folder) {
          for (const child of file.children) {
            await createFileMutation.mutateAsync({
              projectId,
              parentId: folder.id,
              name: child.name,
              type: "file",
              content: child.content,
              language: child.language,
            });
          }
        }
      } else if (file.type === "file") {
        await createFileMutation.mutateAsync({
          projectId,
          name: file.name,
          type: "file",
          content: file.content,
          language: file.language,
        });
      }
    }
    utils.files.list.invalidate();
  }

  function handleTemplateSelect(template: ProjectTemplate) {
    setSelectedTemplate(template);
    setNewProject({
      name: template.name === "Proyecto Vacío" ? "" : `Mi ${template.name}`,
      description: template.description,
      language: template.language,
    });
    setDialogTab("blank");
  }

  const filtered = projects?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proyectos</h1>
          <p className="text-muted-foreground mt-1">Gestiona tus proyectos de desarrollo</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setSelectedTemplate(null); setDialogTab("template"); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Proyecto</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
            </DialogHeader>
            <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as "blank" | "template")}>
              <TabsList className="w-full">
                <TabsTrigger value="template" className="flex-1">
                  <Sparkles className="h-4 w-4 mr-2" />Desde Template
                </TabsTrigger>
                <TabsTrigger value="blank" className="flex-1">
                  <FileCode className="h-4 w-4 mr-2" />Personalizado
                </TabsTrigger>
              </TabsList>

              <TabsContent value="template" className="mt-4">
                <div className="grid grid-cols-2 gap-3">
                  {PROJECT_TEMPLATES.map((template) => (
                    <button
                      key={template.name}
                      className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-md ${
                        selectedTemplate?.name === template.name
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border/50 hover:border-primary/30"
                      }`}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <div className={`p-2 rounded-lg ${template.bgColor} shrink-0`}>
                        <template.icon className={`h-5 w-5 ${template.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{template.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
                        {template.language && (
                          <Badge variant="secondary" className="mt-1.5 text-xs">{template.language}</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="blank" className="mt-4">
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newProject.name.trim()) return;
                    createMutation.mutate(newProject);
                  }}
                >
                  {selectedTemplate && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <Zap className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Basado en template: <span className="font-medium text-foreground">{selectedTemplate.name}</span>
                        {" "}- se crearán {selectedTemplate.files.length} archivos/carpetas automáticamente
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-6 text-xs"
                        onClick={() => setSelectedTemplate(null)}
                      >
                        Quitar
                      </Button>
                    </div>
                  )}
                  <Input
                    placeholder="Nombre del proyecto"
                    value={newProject.name}
                    onChange={(e) => setNewProject(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                  <Textarea
                    placeholder="Descripción (opcional)"
                    value={newProject.description}
                    onChange={(e) => setNewProject(p => ({ ...p, description: e.target.value }))}
                    rows={3}
                  />
                  <Select
                    value={newProject.language || "none"}
                    onValueChange={(v) => setNewProject(p => ({ ...p, language: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Lenguaje principal" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin especificar</SelectItem>
                      {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creando..." : "Crear Proyecto"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar proyectos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No hay proyectos</p>
          <p className="text-sm mt-1">Crea tu primer proyecto para comenzar</p>
          <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Crear Proyecto
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(project => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-md transition-all border-border/50 group"
              onClick={() => setLocation(`/projects/${project.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Code2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{project.name}</h3>
                      {project.language && (
                        <Badge variant="secondary" className="mt-1 text-xs">{project.language}</Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: project.id, status: "archived" }); toast.success("Proyecto archivado"); }}>
                        <Archive className="mr-2 h-4 w-4" />Archivar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: project.id, status: "deleted" }); toast.success("Proyecto eliminado"); }}>
                        <Trash2 className="mr-2 h-4 w-4" />Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{project.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                  Actualizado {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true, locale: es })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
