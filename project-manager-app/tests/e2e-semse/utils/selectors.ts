// Shared selectors for SEMSE e2e tests.
// Prefer data-testid when available; fall back to role/text selectors.

export const LOGIN = {
  presetAdmin: { name: /Admin/i },
  presetClient: { name: /Cliente/i },
  presetWorker: { name: /Profesional/i },
  submitBtn: { name: /Ingresar|Sign in|Login/i },
};

export const NAV = {
  buildops: { name: /BuildOps/i },
  tools: { name: /Tools/i },
};

export const BUILDOPS_MILESTONES = {
  heading: "h1",
  milestoneCard: "[data-testid='milestone-card']",
  statusBadge: "[data-testid='milestone-status']",
  // Fallback: any badge inside a Card
  anyBadge: ".semse-badge, [class*='badge'], [class*='Badge']",
};

export const TOOLS_DASHBOARD = {
  heading: "h1",
  tradeLink: (trade: string) => `a[href='/tools/${trade}']`,
};

export const CONCRETE_TOOL = {
  calculateBtn: { name: /Calculate concrete/i },
  resultSection: "[data-testid='tool-result']",
  // Fallback heading
  resultHeading: { name: /Result|Materials|Costo|Cost/i },
};
