"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type LanguagePreference = "es" | "en";

interface LanguageContextValue {
  language: LanguagePreference;
  setLanguage: (lang: LanguagePreference) => void;
  t: (key: string) => string;
}

const TRANSLATIONS: Record<LanguagePreference, Record<string, string>> = {
  es: {
    // Roles
    "role.worker": "Profesional",
    "role.client": "Cliente",
    "role.admin": "Admin",
    // Layout UI
    "ui.signOut": "Salir",
    "ui.language": "Idioma",
    "ui.theme": "Tema",
    "ui.dark": "Oscuro",
    "ui.light": "Claro",
    "ui.notifications": "Notificaciones",
    "ui.loading": "Cargando…",
    "ui.save": "Guardar",
    "ui.cancel": "Cancelar",
    "ui.back": "Volver",
    "ui.new": "Nuevo",
    "ui.edit": "Editar",
    "ui.delete": "Eliminar",
    "ui.search": "Buscar",
    "ui.filter": "Filtrar",
    "ui.export": "Exportar",
    "ui.noData": "Sin datos",
    "ui.error": "Error",
    "ui.refresh": "Actualizar",
    // Nav — Admin
    "nav.dashboard": "Dashboard",
    "nav.operations": "Operaciones",
    "nav.autonomy": "Autonomía",
    "nav.developerRuntime": "Entorno Dev",
    "nav.domainEvents": "Eventos de dominio",
    "nav.users": "Usuarios",
    "nav.disputes": "Disputas",
    "nav.qaCenter": "Centro QA",
    "nav.compliance": "Cumplimiento",
    "nav.finance": "Finanzas",
    "nav.travelOps": "Viajes",
    "nav.reports": "Reportes",
    "nav.fieldOps": "Ops. de campo",
    "nav.settings": "Configuración",
    "nav.htmlCanvas": "HTML Canvas",
    "nav.buildOps": "BuildOps",
    "nav.semseTools": "SEMSE Tools",
    "nav.agents": "Agentes",
    "nav.coordinator": "Coordinador",
    "nav.llmMetrics": "Métricas LLM",
    "nav.aiMissionControl": "Control Misión IA",
    "nav.pmo": "PMO Automatizado",
    "nav.semseX": "SEMSE_X",
    "nav.agentMemory": "Memoria Agente",
    "nav.prometeo": "Prometeo RAG",
    // Nav — Worker
    "nav.workerDashboard": "Dashboard",
    "nav.agenda": "Agenda",
    "nav.myJobs": "Mis trabajos",
    "nav.tasks": "Tareas",
    "nav.timeTracker": "Time Tracker",
    "nav.evidence": "Evidencia",
    "nav.materials": "Materiales",
    "nav.incidents": "Incidencias",
    "nav.payments": "Pagos",
    "nav.travel": "Movilidad",
    "nav.myProfile": "Mi perfil",
    "nav.aiSettings": "Asistente IA",
    // Nav — Client
    "nav.leads": "Leads & Clientes",
    "nav.postJob": "Publicar trabajo",
    "nav.myProjects": "Mis proyectos",
    "nav.aiCopilot": "Copiloto IA",
    "nav.milestones": "Hitos",
    "nav.professionals": "Profesionales",
    "nav.documents": "Documentos",
    "nav.reviews": "Reseñas",
    "nav.financeHub": "Hub Financiero",
    // Dashboard quick-action descriptions
    "dash.fieldOpsDesc": "Ir a unidades y trabajo de campo",
    "dash.quickActions": "Acciones rápidas",
    "dash.fastManagement": "Gestión rápida",
    // Sections
    "section.main": "Principal",
    "section.control": "Control",
    "section.operations": "Operaciones",
    "section.field": "Campo",
    "section.ai": "IA",
    "section.lab": "Lab",
  },
  en: {
    // Roles
    "role.worker": "Worker",
    "role.client": "Client",
    "role.admin": "Admin",
    // Layout UI
    "ui.signOut": "Sign out",
    "ui.language": "Language",
    "ui.theme": "Theme",
    "ui.dark": "Dark",
    "ui.light": "Light",
    "ui.notifications": "Notifications",
    "ui.loading": "Loading…",
    "ui.save": "Save",
    "ui.cancel": "Cancel",
    "ui.back": "Back",
    "ui.new": "New",
    "ui.edit": "Edit",
    "ui.delete": "Delete",
    "ui.search": "Search",
    "ui.filter": "Filter",
    "ui.export": "Export",
    "ui.noData": "No data",
    "ui.error": "Error",
    "ui.refresh": "Refresh",
    // Nav — Admin
    "nav.dashboard": "Dashboard",
    "nav.operations": "Operations",
    "nav.autonomy": "Autonomy",
    "nav.developerRuntime": "Developer Runtime",
    "nav.domainEvents": "Domain Events",
    "nav.users": "Users",
    "nav.disputes": "Disputes",
    "nav.qaCenter": "QA Center",
    "nav.compliance": "Compliance",
    "nav.finance": "Finance",
    "nav.travelOps": "Travel Ops",
    "nav.reports": "Reports",
    "nav.fieldOps": "Field Ops",
    "nav.settings": "Settings",
    "nav.htmlCanvas": "HTML Canvas",
    "nav.buildOps": "BuildOps",
    "nav.semseTools": "SEMSE Tools",
    "nav.agents": "Agents",
    "nav.coordinator": "Coordinator",
    "nav.llmMetrics": "LLM Metrics",
    "nav.aiMissionControl": "AI Mission Control",
    "nav.pmo": "PMO Dashboard",
    "nav.semseX": "SEMSE_X",
    "nav.agentMemory": "Agent Memory",
    "nav.prometeo": "Prometeo RAG",
    // Nav — Worker
    "nav.workerDashboard": "Dashboard",
    "nav.agenda": "Agenda",
    "nav.myJobs": "My jobs",
    "nav.tasks": "Tasks",
    "nav.timeTracker": "Time Tracker",
    "nav.evidence": "Evidence",
    "nav.materials": "Materials",
    "nav.incidents": "Incidents",
    "nav.payments": "Payments",
    "nav.travel": "Travel Ops",
    "nav.myProfile": "My profile",
    "nav.aiSettings": "AI Settings",
    // Nav — Client
    "nav.leads": "Leads & Clients",
    "nav.postJob": "Post job",
    "nav.myProjects": "My projects",
    "nav.aiCopilot": "AI Copilot",
    "nav.milestones": "Milestones",
    "nav.professionals": "Professionals",
    "nav.documents": "Documents",
    "nav.reviews": "Reviews",
    "nav.financeHub": "Finance Hub",
    // Dashboard quick-action descriptions
    "dash.fieldOpsDesc": "Go to units and field work",
    "dash.quickActions": "Quick actions",
    "dash.fastManagement": "Quick management",
    // Sections
    "section.main": "Main",
    "section.control": "Control",
    "section.operations": "Operations",
    "section.field": "Field",
    "section.ai": "AI",
    "section.lab": "Lab",
  },
};

const LanguageContext = createContext<LanguageContextValue>({
  language: "es",
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguagePreference>("es");

  useEffect(() => {
    const saved = window.localStorage.getItem("semse-language");
    if (saved === "es" || saved === "en") setLanguageState(saved);
  }, []);

  function setLanguage(lang: LanguagePreference) {
    setLanguageState(lang);
    window.localStorage.setItem("semse-language", lang);
    document.documentElement.lang = lang;
  }

  function t(key: string): string {
    return TRANSLATIONS[language][key] ?? TRANSLATIONS.en[key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
