import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, Code, BookOpen, Layers, Server, Activity, FileText, Wrench, Database, GitBranch, Bot, Beaker, AlertTriangle, User, ChevronLeft, Hexagon, Search, Bell, Settings, LogOut } from 'lucide-react';

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dev' },
  { id: 'apis', label: 'APIs y Endpoints', icon: Code, path: '/dev/apis' },
  { id: 'explorer', label: 'API Explorer', icon: Search, path: '/dev/explorer' },
  { id: 'docs', label: 'Documentación', icon: BookOpen, path: '/dev/docs' },
  { id: 'sdks', label: 'SDKs y Librerías', icon: Layers, path: '/dev/sdks' },
  { id: 'ambientes', label: 'Ambientes', icon: Server, path: '/dev/ambientes' },
  { id: 'monitoreo', label: 'Monitoreo', icon: Activity, path: '/dev/monitoreo' },
  { id: 'logs', label: 'Logs', icon: FileText, path: '/dev/logs' },
  { id: 'herramientas', label: 'Herramientas', icon: Wrench, path: '/dev/herramientas' },
  { id: 'bd', label: 'Base de datos', icon: Database, path: '/dev/bd' },
  { id: 'cicd', label: 'CI/CD', icon: GitBranch, path: '/dev/cicd' },
  { id: 'agentes', label: 'Agentes', icon: Bot, path: '/dev/agentes' },
  { id: 'testing', label: 'Testing', icon: Beaker, path: '/dev/testing' },
  { id: 'incidencias', label: 'Incidencias', icon: AlertTriangle, path: '/dev/incidencias' },
  { id: 'perfil', label: 'Perfil Dev', icon: User, path: '/dev/perfil' },
];

export default function DevLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B1628]">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#0F1D32] border-b border-white/5 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>
          <div className="flex items-center gap-2">
            <Hexagon className="w-6 h-6 text-[#14A0A0]" />
            <span className="text-white font-semibold text-sm">SEMSE<span className="text-[#14A0A0]">Dev</span></span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#14A0A0]/10 text-[#14A0A0] border border-[#14A0A0]/20 ml-2">Portal Dev</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors relative">
            <Bell className="w-4 h-4 text-slate-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          <button className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <Settings className="w-4 h-4 text-slate-400" />
          </button>
          <button className="w-8 h-8 rounded-lg bg-[#14A0A0]/10 flex items-center justify-center">
            <span className="text-xs font-bold text-[#14A0A0]">CR</span>
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="fixed left-0 top-14 bottom-0 w-60 bg-[#0F1D32] border-r border-white/5 overflow-y-auto hidden lg:block">
        <nav className="p-3 space-y-0.5">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left ${
                  active
                    ? 'bg-[#14A0A0]/10 text-[#14A0A0] border-l-2 border-[#14A0A0]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/5">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">
            <LogOut className="w-4 h-4" />
            Salir del portal
          </button>
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-16 left-4 z-40 w-10 h-10 rounded-lg bg-[#0F1D32] border border-white/10 flex items-center justify-center"
      >
        <Code className="w-5 h-5 text-[#14A0A0]" />
      </button>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-[55]" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute left-0 top-0 bottom-0 w-60 bg-[#0F1D32] border-r border-white/5 overflow-y-auto p-3 space-y-0.5 pt-16">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.id}
                  onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left ${
                    active
                      ? 'bg-[#14A0A0]/10 text-[#14A0A0] border-l-2 border-[#14A0A0]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="pt-14 lg:pl-60 min-h-screen">
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
