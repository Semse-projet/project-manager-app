export interface ClientJob {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  location: string;
  budget: string;
  status: 'active' | 'published' | 'completed';
  date: string;
  proposals: number;
  image?: string;
}

export interface Proposal {
  id: string;
  professionalName: string;
  company: string;
  avatar: string;
  rating: number;
  reviews: number;
  price: number;
  deliveryDays: number;
  message: string;
  date: string;
  verified: boolean;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending';
  date: string;
  amount: number;
  evidenceCount: number;
}

export interface ClientProject {
  id: string;
  title: string;
  professional: string;
  company: string;
  avatar: string;
  progress: number;
  budget: number;
  startDate: string;
  endDate: string;
  status: string;
  milestones: Milestone[];
  activities: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  date: string;
  description?: string;
}

export interface EscrowPayment {
  id: string;
  concept: string;
  amount: number;
  status: 'funded' | 'released' | 'pending';
  date: string;
}

export interface ContractDoc {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
}

export const clientJobs: ClientJob[] = [
  {
    id: 'cj1',
    title: 'Remodelación de cocina',
    description: 'Necesito remodelar mi cocina completa: instalación de mobiliario, encimeras, iluminación eléctrica y fontanería.',
    type: 'Remodelación',
    category: 'Construcción',
    location: 'Ciudad de México, CDMX',
    budget: '$2,500 - $3,500 USD',
    status: 'active',
    date: '15/04/2024',
    proposals: 5,
    image: 'https://picsum.photos/400/300?random=10',
  },
  {
    id: 'cj2',
    title: 'Ampliación de casa',
    description: 'Ampliación de segundo piso con 2 habitaciones y 1 baño.',
    type: 'Construcción',
    category: 'Construcción',
    location: 'Guadalajara, Jalisco',
    budget: '$8,000 - $12,000 USD',
    status: 'published',
    date: '20/04/2024',
    proposals: 3,
    image: 'https://picsum.photos/400/300?random=11',
  },
  {
    id: 'cj3',
    title: 'Impermeabilización',
    description: 'Impermeabilización de azotea y áreas exteriores.',
    type: 'Mantenimiento',
    category: 'Mantenimiento',
    location: 'Monterrey, Nuevo León',
    budget: '$1,500 - $2,000 USD',
    status: 'published',
    date: '18/04/2024',
    proposals: 2,
    image: 'https://picsum.photos/400/300?random=12',
  },
  {
    id: 'cj4',
    title: 'Pintura interior',
    description: 'Pintura de interior completa de casa de 3 recámaras.',
    type: 'Acabados',
    category: 'Acabados',
    location: 'Puebla, Puebla',
    budget: '$800 - $1,200 USD',
    status: 'completed',
    date: '01/03/2024',
    proposals: 4,
    image: 'https://picsum.photos/400/300?random=13',
  },
];

export const proposals: Proposal[] = [
  {
    id: 'p1',
    professionalName: 'ConstruPro MX',
    company: 'Constructora',
    avatar: 'CP',
    rating: 4.9,
    reviews: 128,
    price: 2850,
    deliveryDays: 7,
    message: 'Ofrecemos garantía de 12 meses en todos nuestros trabajos. Incluye materiales de primera calidad.',
    date: 'Hace 2 días',
    verified: true,
  },
  {
    id: 'p2',
    professionalName: 'Carlos López',
    company: 'Independiente',
    avatar: 'CL',
    rating: 4.7,
    reviews: 89,
    price: 3200,
    deliveryDays: 10,
    message: 'Especialista en remodelaciones de cocina con más de 10 años de experiencia.',
    date: 'Hace 3 días',
    verified: true,
  },
  {
    id: 'p3',
    professionalName: 'Obras y Más',
    company: 'Constructora',
    avatar: 'OM',
    rating: 4.5,
    reviews: 56,
    price: 2750,
    deliveryDays: 8,
    message: 'Precio competitivo con excelente calidad. Contamos con equipo propio.',
    date: 'Hace 4 días',
    verified: false,
  },
  {
    id: 'p4',
    professionalName: 'Innova Construcciones',
    company: 'Constructora',
    avatar: 'IC',
    rating: 4.8,
    reviews: 203,
    price: 3500,
    deliveryDays: 6,
    message: 'Utilizamos tecnología de punta y materiales eco-amigables.',
    date: 'Hace 5 días',
    verified: true,
  },
  {
    id: 'p5',
    professionalName: 'Grupo Edifica',
    company: 'Grupo',
    avatar: 'GE',
    rating: 4.6,
    reviews: 175,
    price: 3000,
    deliveryDays: 9,
    message: 'Amplia experiencia en proyectos residenciales. Presupuesto sin compromiso.',
    date: 'Hace 6 días',
    verified: true,
  },
];

export const activeProject: ClientProject = {
  id: 'ap1',
  title: 'Remodelación de cocina',
  professional: 'ConstruPro MX',
  company: 'Constructora',
  avatar: 'CP',
  progress: 35,
  budget: 2850,
  startDate: '15/04/2024',
  endDate: '22/04/2024',
  status: 'En progreso',
  milestones: [
    { id: 'm1', title: 'Demolición y desmonte', description: 'Remoción de mobiliario existente', status: 'completed', date: '15/04/2024', amount: 570, evidenceCount: 8 },
    { id: 'm2', title: 'Instalación eléctrica', description: 'Cableado e iluminación nueva', status: 'in_progress', date: '18/04/2024', amount: 855, evidenceCount: 5 },
    { id: 'm3', title: 'Carpintería y muebles', description: 'Instalación de gabinetes y encimeras', status: 'pending', date: '20/04/2024', amount: 712, evidenceCount: 0 },
    { id: 'm4', title: 'Encimeras e instalación', description: 'Colocación de encimeras y fregadero', status: 'pending', date: '21/04/2024', amount: 428, evidenceCount: 0 },
    { id: 'm5', title: 'Acabados finales', description: 'Pintura, limpieza y detalles', status: 'pending', date: '22/04/2024', amount: 285, evidenceCount: 0 },
  ],
  activities: [
    { id: 'a1', type: 'milestone', title: 'Hito 1 aprobado', date: 'hace 1 día', description: 'Demolición y desmonte completado' },
    { id: 'a2', type: 'evidence', title: 'Evidencia recibida', date: 'hace 2 días', description: '8 nuevas fotos del progreso' },
    { id: 'a3', type: 'message', title: 'Mensaje del profesional', date: 'hace 2 días', description: 'Carlos: "Iniciando instalación eléctrica hoy"' },
  ],
};

export const escrowPayments: EscrowPayment[] = [
  { id: 'e1', concept: 'Hito 1 - Demolición y desmonte', amount: 570, status: 'released', date: '15/04/2024' },
  { id: 'e2', concept: 'Hito 2 - Instalación eléctrica', amount: 855, status: 'funded', date: '18/04/2024' },
  { id: 'e3', concept: 'Hito 3 - Carpintería y muebles', amount: 712, status: 'pending', date: '20/04/2024' },
  { id: 'e4', concept: 'Hito 4 - Encimeras e instalación', amount: 428, status: 'pending', date: '21/04/2024' },
  { id: 'e5', concept: 'Hito 5 - Acabados finales', amount: 285, status: 'pending', date: '22/04/2024' },
];

export const contractDocs: ContractDoc[] = [
  { id: 'cd1', name: 'Contrato del proyecto', type: 'PDF', size: '1.2 MB', date: '14/04/2024' },
  { id: 'cd2', name: 'Alcance del trabajo', type: 'PDF', size: '850 KB', date: '14/04/2024' },
  { id: 'cd3', name: 'Cronograma de trabajo', type: 'PDF', size: '620 KB', date: '14/04/2024' },
  { id: 'cd4', name: 'Garantías y pólizas', type: 'PDF', size: '430 KB', date: '14/04/2024' },
  { id: 'cd5', name: 'Plano de distribución', type: 'PDF', size: '2.1 MB', date: '14/04/2024' },
];

export const clientNotifications = [
  { id: 'n1', title: 'Nueva postulación', message: 'Juan Pérez se postuló a tu proyecto', time: 'Hace 5 min', read: false },
  { id: 'n2', title: 'Mensaje recibido', message: 'Ana Torres te envió un mensaje', time: 'Hace 1 hora', read: false },
  { id: 'n3', title: 'Proyecto guardado', message: 'Guardaste "Plataforma educativa"', time: 'Hace 2 horas', read: true },
  { id: 'n4', title: 'Proyecto actualizado', message: '"App de tareas" fue actualizado', time: 'Hace 1 día', read: true },
];

export const recentActivities = [
  { id: 'ra1', title: 'Propuesta recibida', detail: 'Remodelación de cocina', time: 'Hace 2 hs', icon: 'file' },
  { id: 'ra2', title: 'Hito aprobado', detail: 'Instalación eléctrica', time: 'Hace 1 día', icon: 'check' },
  { id: 'ra3', title: 'Pago liberado', detail: 'Pago liberado: $570 USD', time: 'Hace 2 días', icon: 'dollar' },
];

export const clientQuickActions = [
  { id: 'qa1', label: 'Publicar trabajo', icon: 'plus', color: 'bg-[#0D7377]', description: 'Encuentra colaboradores' },
  { id: 'qa2', label: 'Buscar proyectos', icon: 'search', color: 'bg-blue-500', description: 'Explora oportunidades' },
  { id: 'qa3', label: 'Mis proyectos', icon: 'folder', color: 'bg-amber-500', description: 'Gestiona tus proyectos' },
  { id: 'qa4', label: 'Mensajes', icon: 'message', color: 'bg-purple-500', description: 'Revisa tus conversaciones' },
];

export const jobTypes = [
  { id: 'construccion', label: 'Construcción', icon: 'building', selected: false },
  { id: 'remodelacion', label: 'Remodelación', icon: 'hammer', selected: false },
  { id: 'instalaciones', label: 'Instalaciones', icon: 'plug', selected: false },
  { id: 'acabados', label: 'Acabados', icon: 'paint', selected: false },
  { id: 'mantenimiento', label: 'Mantenimiento', icon: 'wrench', selected: false },
  { id: 'otros', label: 'Otros servicios', icon: 'more', selected: false },
];

export const clientProfile = {
  name: 'María González',
  email: 'maria.gonzalez@email.com',
  phone: '+52 55 1234 5678',
  location: 'Ciudad de México, CDMX',
  address: 'Av. Insurgentes Sur 1234, Del Valle, 03100',
  memberSince: 'Enero 2023',
  projectsCount: 12,
  avatar: 'https://i.pravatar.cc/150?img=5',
};
