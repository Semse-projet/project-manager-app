/**
 * Pestañas de la finca. `requires` es la acción de la política de finca
 * (`agro-farm-policy.ts`) que exige el API detrás de la pantalla, u "OWNER"
 * para las pantallas que el API todavía reserva al propietario.
 */
type FarmTab = { href: string; label: string; requires?: string };

export function farmTabs(farmId: string, viewer?: { role: string; actions: string[] } | null) {
  const tabs: FarmTab[] = [
    { href: `/agro/${farmId}`,               label: "Dashboard"       },
    { href: `/agro/${farmId}/animals`,        label: "Animales"        },
    { href: `/agro/${farmId}/groups`,         label: "Grupos"          },
    { href: `/agro/${farmId}/tasks`,          label: "Tareas"          },
    { href: `/agro/${farmId}/incidents`,      label: "Incidencias"     },
    { href: `/agro/${farmId}/workforce`,      label: "Equipo"          },
    { href: `/agro/${farmId}/calendar`,       label: "Calendario"      },
    { href: `/agro/${farmId}/feeding`,        label: "Alimentación"    },
    { href: `/agro/${farmId}/health`,         label: "Salud"           },
    { href: `/agro/${farmId}/inventory`,      label: "Inventario"      },
    { href: `/agro/${farmId}/costs`, label: "Costos", requires: "farm.finance" },
    { href: `/agro/${farmId}/production`, label: "Producción", requires: "OWNER" },
    { href: `/agro/${farmId}/profitability`, label: "Rentabilidad", requires: "farm.finance" },
    { href: `/agro/${farmId}/sales`, label: "Ventas", requires: "farm.finance" },
    { href: `/agro/${farmId}/simulator`, label: "Simulador", requires: "farm.finance" },
    { href: `/agro/${farmId}/analytics`, label: "Analítica", requires: "farm.finance" },
    { href: `/agro/${farmId}/reproduction`,   label: "Reproducción"    },
    { href: `/agro/${farmId}/infrastructure`, label: "Infraestructura" },
    { href: `/agro/${farmId}/evidence`,       label: "Evidencia"       },
    { href: `/agro/${farmId}/audit`, label: "Auditoría", requires: "farm.finance" },
  ];
  // Sin datos del rol (cargando o API antiguo) se muestran todas, como antes: el API decide.
  if (!viewer) return tabs;
  return tabs.filter((tab) =>
    !tab.requires || (tab.requires === "OWNER" ? viewer.role === "OWNER" : viewer.actions.includes(tab.requires)));
}
