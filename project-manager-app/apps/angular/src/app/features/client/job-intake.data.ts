export type JobLocationType = 'remote' | 'on_site' | 'hybrid';
export type JobBudgetType = 'fixed' | 'range' | 'hourly';

export type JobCategory = {
  id: string;
  name: string;
  subcategories: Array<{
    id: string;
    name: string;
    basePrice: number;
  }>;
};

export type JobIntakePrefill = {
  categoryId: string;
  subcategoryId: string;
  title: string;
  description: string;
  locationType: JobLocationType;
  city: string;
  budgetType: JobBudgetType;
  budgetMin: number;
  budgetMax: number;
  urgency: string;
};

export const JOB_CATEGORIES: JobCategory[] = [
  {
    id: 'plomeria',
    name: 'Plomeria',
    subcategories: [
      { id: 'reparacion', name: 'Reparacion de fugas', basePrice: 80 },
      { id: 'instalacion', name: 'Instalacion sanitaria', basePrice: 150 },
      { id: 'destapado', name: 'Destapado de canerias', basePrice: 60 },
    ],
  },
  {
    id: 'electricidad',
    name: 'Electricidad',
    subcategories: [
      { id: 'instalacion_elec', name: 'Instalacion electrica', basePrice: 120 },
      { id: 'panel', name: 'Actualizacion de panel', basePrice: 300 },
      { id: 'iluminacion', name: 'Instalacion de iluminacion', basePrice: 90 },
    ],
  },
  {
    id: 'pintura',
    name: 'Pintura',
    subcategories: [
      { id: 'interior', name: 'Pintura interior', basePrice: 200 },
      { id: 'exterior', name: 'Pintura exterior', basePrice: 350 },
      { id: 'decorativa', name: 'Pintura decorativa', basePrice: 180 },
    ],
  },
  {
    id: 'pisos',
    name: 'Pisos',
    subcategories: [
      { id: 'instalacion_piso', name: 'Instalacion de pisos', basePrice: 250 },
      { id: 'pulido', name: 'Pulido y restauracion', basePrice: 180 },
      { id: 'ceramica', name: 'Ceramica y azulejos', basePrice: 200 },
    ],
  },
  {
    id: 'carpinteria',
    name: 'Carpinteria',
    subcategories: [
      { id: 'muebles', name: 'Muebles a medida', basePrice: 400 },
      { id: 'puertas', name: 'Puertas y ventanas', basePrice: 250 },
      { id: 'remodelacion', name: 'Remodelacion general', basePrice: 500 },
    ],
  },
  {
    id: 'jardineria',
    name: 'Jardineria',
    subcategories: [
      { id: 'mantenimiento', name: 'Mantenimiento regular', basePrice: 80 },
      { id: 'diseno', name: 'Diseno de jardin', basePrice: 300 },
      { id: 'poda', name: 'Poda de arboles', basePrice: 120 },
    ],
  },
];

export const JOB_URGENCY_OPTIONS = [
  { value: 'low', label: 'Baja', description: 'Sin prisa, flexible', color: '#10b981' },
  { value: 'medium', label: 'Media', description: 'En las proximas semanas', color: '#f59e0b' },
  { value: 'high', label: 'Alta', description: 'Esta semana', color: '#ff6a00' },
  { value: 'urgent', label: 'Urgente', description: 'Lo antes posible', color: '#ef4444' },
] as const;

export function parseJobIntakePrefill(params: URLSearchParams): JobIntakePrefill {
  const get = (key: string) => params.get(key)?.trim() ?? '';
  const budgetMinRaw = Number(get('budgetMin') || '500');
  const budgetMin = Number.isFinite(budgetMinRaw) ? budgetMinRaw : 500;
  const budgetMaxRaw = Number(get('budgetMax') || '2000');
  const locationType = get('locationType');
  const budgetType = get('budgetType');

  return {
    categoryId: get('category'),
    subcategoryId: get('subcategory'),
    title: get('title'),
    description: get('description'),
    locationType: locationType === 'remote' || locationType === 'hybrid' ? locationType : 'on_site',
    city: get('city'),
    budgetType: budgetType === 'fixed' || budgetType === 'hourly' ? budgetType : 'range',
    budgetMin,
    budgetMax: Number.isFinite(budgetMaxRaw) ? Math.max(budgetMaxRaw, budgetMin) : Math.max(2000, budgetMin),
    urgency: get('urgency') || 'medium',
  };
}

export function categoryName(categoryId: string | null | undefined): string | null {
  if (!categoryId) {
    return null;
  }
  return JOB_CATEGORIES.find((item) => item.id === categoryId)?.name ?? categoryId;
}

export function subcategoryName(subcategoryId: string | null | undefined): string | null {
  if (!subcategoryId) {
    return null;
  }
  for (const category of JOB_CATEGORIES) {
    const subcategory = category.subcategories.find((item) => item.id === subcategoryId);
    if (subcategory) {
      return subcategory.name;
    }
  }
  return subcategoryId;
}
