import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import DevLayout from './components/DevLayout';
import { isAuthenticated } from './lib/auth/mobile-auth';

const Login = lazy(() => import('./pages/Login'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Trabajos = lazy(() => import('./pages/Trabajos'));
const DetalleTrabajo = lazy(() => import('./pages/DetalleTrabajo'));
const Evidencias = lazy(() => import('./pages/Evidencias'));
const NuevaEvidencia = lazy(() => import('./pages/NuevaEvidencia'));
const Tareas = lazy(() => import('./pages/Tareas'));
const Materiales = lazy(() => import('./pages/Materiales'));
const Incidentes = lazy(() => import('./pages/Incidentes'));
const FieldOps = lazy(() => import('./pages/FieldOps'));
const Tracker = lazy(() => import('./pages/Tracker'));
const Viajes = lazy(() => import('./pages/Viajes'));
const Hospedaje = lazy(() => import('./pages/Hospedaje'));
const Gastos = lazy(() => import('./pages/Gastos'));
const Anticipos = lazy(() => import('./pages/Anticipos'));
const Liquidacion = lazy(() => import('./pages/Liquidacion'));
const Pagos = lazy(() => import('./pages/Pagos'));
const Disputas = lazy(() => import('./pages/Disputas'));
const Perfil = lazy(() => import('./pages/Perfil'));
const Herramientas = lazy(() => import('./pages/Herramientas'));
const Mensajes = lazy(() => import('./pages/Mensajes'));

const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const ClientPublicarTrabajo = lazy(() => import('./pages/client/ClientPublicarTrabajo'));
const ClientPublicarDetalle = lazy(() => import('./pages/client/ClientPublicarDetalle'));
const ClientMisTrabajos = lazy(() => import('./pages/client/ClientMisTrabajos'));
const ClientDetalleJob = lazy(() => import('./pages/client/ClientDetalleJob'));
const ClientComparar = lazy(() => import('./pages/client/ClientComparar'));
const ClientMatch = lazy(() => import('./pages/client/ClientMatch'));
const ClientProyectoActivo = lazy(() => import('./pages/client/ClientProyectoActivo'));
const ClientAprobar = lazy(() => import('./pages/client/ClientAprobar'));
const ClientPagos = lazy(() => import('./pages/client/ClientPagos'));
const ClientDocumentos = lazy(() => import('./pages/client/ClientDocumentos'));
const ClientDisputas = lazy(() => import('./pages/client/ClientDisputas'));
const ClientReviews = lazy(() => import('./pages/client/ClientReviews'));
const ClientProfile = lazy(() => import('./pages/client/ClientProfile'));
const ClientAjustes = lazy(() => import('./pages/client/ClientAjustes'));

const DevDashboard = lazy(() => import('./pages/dev/DevDashboard'));
const DevAPIs = lazy(() => import('./pages/dev/DevAPIs'));
const DevExplorer = lazy(() => import('./pages/dev/DevExplorer'));
const DevDocs = lazy(() => import('./pages/dev/DevDocs'));
const DevSDKs = lazy(() => import('./pages/dev/DevSDKs'));
const DevAmbientes = lazy(() => import('./pages/dev/DevAmbientes'));
const DevMonitoreo = lazy(() => import('./pages/dev/DevMonitoreo'));
const DevLogs = lazy(() => import('./pages/dev/DevLogs'));
const DevHerramientas = lazy(() => import('./pages/dev/DevHerramientas'));
const DevBD = lazy(() => import('./pages/dev/DevBD'));
const DevCICD = lazy(() => import('./pages/dev/DevCICD'));
const DevAgentes = lazy(() => import('./pages/dev/DevAgentes'));
const DevTesting = lazy(() => import('./pages/dev/DevTesting'));
const DevIncidencias = lazy(() => import('./pages/dev/DevIncidencias'));
const DevPerfil = lazy(() => import('./pages/dev/DevPerfil'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] px-4 py-10">
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#1A2B3C]">Cargando superficie...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Suspense fallback={null}><Login /></Suspense>} />

        {/* Dev Portal - Separate Layout */}
        <Route element={<DevLayout />}>
          <Route path="/dev" element={<DevDashboard />} />
          <Route path="/dev/apis" element={<DevAPIs />} />
          <Route path="/dev/explorer" element={<DevExplorer />} />
          <Route path="/dev/docs" element={<DevDocs />} />
          <Route path="/dev/sdks" element={<DevSDKs />} />
          <Route path="/dev/ambientes" element={<DevAmbientes />} />
          <Route path="/dev/monitoreo" element={<DevMonitoreo />} />
          <Route path="/dev/logs" element={<DevLogs />} />
          <Route path="/dev/herramientas" element={<DevHerramientas />} />
          <Route path="/dev/bd" element={<DevBD />} />
          <Route path="/dev/cicd" element={<DevCICD />} />
          <Route path="/dev/agentes" element={<DevAgentes />} />
          <Route path="/dev/testing" element={<DevTesting />} />
          <Route path="/dev/incidencias" element={<DevIncidencias />} />
          <Route path="/dev/perfil" element={<DevPerfil />} />
        </Route>

        {/* Professional & Client Routes */}
        <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          {/* Professional */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/trabajos" element={<Trabajos />} />
          <Route path="/trabajo/:id" element={<DetalleTrabajo />} />
          <Route path="/evidencias" element={<Evidencias />} />
          <Route path="/nueva-evidencia" element={<NuevaEvidencia />} />
          <Route path="/tareas" element={<Tareas />} />
          <Route path="/materiales" element={<Materiales />} />
          <Route path="/incidentes" element={<Incidentes />} />
          <Route path="/field-ops" element={<FieldOps />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/viajes" element={<Viajes />} />
          <Route path="/hospedaje" element={<Hospedaje />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/anticipos" element={<Anticipos />} />
          <Route path="/liquidacion" element={<Liquidacion />} />
          <Route path="/pagos" element={<Pagos />} />
          <Route path="/disputas" element={<Disputas />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/herramientas" element={<Herramientas />} />
          <Route path="/mensajes" element={<Mensajes />} />

          {/* Client */}
          <Route path="/cliente" element={<ClientDashboard />} />
          <Route path="/cliente/publicar" element={<ClientPublicarTrabajo />} />
          <Route path="/cliente/publicar-detalle" element={<ClientPublicarDetalle />} />
          <Route path="/cliente/trabajos" element={<ClientMisTrabajos />} />
          <Route path="/cliente/detalle-job" element={<ClientDetalleJob />} />
          <Route path="/cliente/comparar" element={<ClientComparar />} />
          <Route path="/cliente/match" element={<ClientMatch />} />
          <Route path="/cliente/proyecto-activo" element={<ClientProyectoActivo />} />
          <Route path="/cliente/aprobar" element={<ClientAprobar />} />
          <Route path="/cliente/pagos" element={<ClientPagos />} />
          <Route path="/cliente/documentos" element={<ClientDocumentos />} />
          <Route path="/cliente/disputas" element={<ClientDisputas />} />
          <Route path="/cliente/reviews" element={<ClientReviews />} />
          <Route path="/cliente/perfil" element={<ClientProfile />} />
          <Route path="/cliente/ajustes" element={<ClientAjustes />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
