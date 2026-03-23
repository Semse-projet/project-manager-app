import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import EditorPage from "./pages/EditorPage";
import DocumentsPage from "./pages/DocumentsPage";
import TasksPage from "./pages/TasksPage";
import AIAssistantPage from "./pages/AIAssistantPage";
import SettingsPage from "./pages/SettingsPage";
import ActivityPage from "./pages/ActivityPage";
import NotificationsPage from "./pages/NotificationsPage";
import RAGToolsPage from "./pages/RAGToolsPage";
import SEMSEPage from "./pages/SEMSEPage";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/projects/:id" component={ProjectDetailPage} />
        <Route path="/editor/:projectId/:fileId?" component={EditorPage} />
        <Route path="/documents" component={DocumentsPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/ai" component={AIAssistantPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/activity" component={ActivityPage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/rag-tools" component={RAGToolsPage} />
        <Route path="/semse" component={SEMSEPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
