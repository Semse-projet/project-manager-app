import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import ClientBottomNav from './ClientBottomNav';
import SideMenu from './SideMenu';
import AppHeader from './AppHeader';
import RoleToggle from './RoleToggle';
import { useRoleStore } from '@/hooks/useRoleStore';
import { useState } from 'react';

const routeConfig: Record<string, {
  title: string;
  showBack?: boolean;
  showMenu?: boolean;
  showSearch?: boolean;
  showNotifications?: boolean;
  showMore?: boolean;
}> = {
  // Professional routes
  '/': { title: 'SEMSEproject', showMenu: true, showNotifications: true },
  '/trabajos': { title: 'Mis trabajos', showBack: true, showSearch: true },
  '/trabajo/:id': { title: 'Detalle del trabajo', showBack: true, showMore: true },
  '/evidencias': { title: 'Evidencias del trabajo', showBack: true, showMore: true },
  '/nueva-evidencia': { title: 'Nueva evidencia', showBack: true },
  '/tareas': { title: 'Tareas del trabajo', showBack: true },
  '/materiales': { title: 'Materiales', showBack: true, showSearch: true },
  '/incidentes': { title: 'Incidentes', showBack: true },
  '/field-ops': { title: 'Operaciones en campo', showBack: true },
  '/tracker': { title: 'Tracker en tiempo real', showBack: true },
  '/viajes': { title: 'Viajes', showBack: true },
  '/hospedaje': { title: 'Hospedaje', showBack: true },
  '/gastos': { title: 'Gastos de viaje', showBack: true, showMore: true },
  '/anticipos': { title: 'Anticipos', showBack: true },
  '/liquidacion': { title: 'Liquidación de viaje', showBack: true },
  '/pagos': { title: 'Pagos', showBack: true, showMore: true },
  '/disputas': { title: 'Disputas', showBack: true },
  '/perfil': { title: 'Mi perfil', showBack: false, showMore: true },
  '/herramientas': { title: 'Herramientas', showBack: true },
  '/mensajes': { title: 'Mensajes', showBack: true },
  // Client routes
  '/cliente/publicar': { title: 'Publicar trabajo', showBack: true },
  '/cliente/publicar-detalle': { title: 'Detalles del trabajo', showBack: true },
  '/cliente/trabajos': { title: 'Mis trabajos', showBack: true },
  '/cliente/detalle-job': { title: 'Detalle del trabajo', showBack: true },
  '/cliente/comparar': { title: 'Comparar profesionales', showBack: true },
  '/cliente/match': { title: 'Seleccionar profesional', showBack: true },
  '/cliente/proyecto-activo': { title: 'Proyecto activo', showBack: true, showMore: true },
  '/cliente/aprobar': { title: 'Aprobar hito', showBack: true },
  '/cliente/pagos': { title: 'Pagos del proyecto', showBack: true },
  '/cliente/documentos': { title: 'Documentos', showBack: true },
  '/cliente/disputas': { title: 'Disputas', showBack: true },
  '/cliente/reviews': { title: 'Califica tu experiencia', showBack: true },
  '/cliente/perfil': { title: 'Mi perfil', showBack: false, showMore: true },
  '/cliente/ajustes': { title: 'Ajustes', showBack: true },
};

function getRouteConfig(pathname: string) {
  if (routeConfig[pathname]) return routeConfig[pathname];
  if (pathname.startsWith('/trabajo/')) return routeConfig['/trabajo/:id'];
  return { title: 'SEMSEproject', showBack: true };
}

export default function AppLayout() {
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const location = useLocation();
  const { role } = useRoleStore();
  const config = getRouteConfig(location.pathname);

  const isClientRoute = location.pathname.startsWith('/cliente/');
  const effectiveRole = isClientRoute ? 'client' : role;
  const showNav = !['/nueva-evidencia', '/tracker', '/cliente/publicar', '/cliente/publicar-detalle'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-lg mx-auto relative bg-white min-h-screen shadow-2xl">
        <AppHeader
          title={config.title}
          showBack={config.showBack}
          showMenu={effectiveRole === 'professional' && !isClientRoute ? config.showMenu : false}
          showSearch={config.showSearch}
          showNotifications={config.showNotifications}
          showMore={config.showMore}
          onMenuClick={() => setSideMenuOpen(true)}
        />

        <RoleToggle />

        <main className="pb-20">
          <Outlet />
        </main>

        {showNav && (
          <>
            {effectiveRole === 'client' || isClientRoute ? <ClientBottomNav /> : <BottomNav />}
          </>
        )}
        <SideMenu isOpen={sideMenuOpen} onClose={() => setSideMenuOpen(false)} />
      </div>
    </div>
  );
}
