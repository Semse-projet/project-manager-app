import type { Job, Incident, Trip, Expense, Payment, Dispute, UserProfile, HotelReservation, FieldUnit, Checklist, Advance, QuickAction } from '@/types';

export const userProfile: UserProfile = {
  name: 'Carlos López',
  role: 'Técnico Electricista',
  avatar: 'https://i.pravatar.cc/150?img=12',
  phone: '+51 987 654 321',
  email: 'carlos.lopez@semse.com',
  location: 'Lima, Perú',
  specialty: 'Instalaciones eléctricas',
  rating: 4.8,
  reviewCount: 123,
  memberSince: '2023',
  jobsCompleted: 156,
};

export const jobs: Job[] = [
  {
    id: '1',
    title: 'Instalación de luminarias LED',
    client: 'Centro Comercial Plaza Norte',
    location: 'Av. Principal 123, Lima',
    status: 'active',
    date: '22 Abr 2026',
    time: '8:00 AM - 5:00 PM',
    description: 'Instalación de 50 luminarias LED en pasillos principales y estacionamiento.',
    progress: 70,
    supervisor: { name: 'Ana Torres', phone: '+51 999 888 777' },
    tasks: [
      { id: 't1', title: 'Instalar luminarias en pasillo A', status: 'completed', priority: 'high', completed: true },
      { id: 't2', title: 'Cableado eléctrico', status: 'in_progress', priority: 'high', completed: false },
      { id: 't3', title: 'Prueba de funcionamiento', status: 'pending', priority: 'medium', completed: false },
    ],
    materials: [
      { id: 'm1', name: 'Luminaria LED 120cm', category: 'Alta', quantity: 30, unit: 'unidades', status: 'delivered' },
      { id: 'm2', name: 'Cable eléctrico 12 AWG', category: 'Media', quantity: 150, unit: 'metros', status: 'delivered' },
      { id: 'm3', name: 'Conector estanco IP65', category: 'Alta', quantity: 20, unit: 'unidades', status: 'pending' },
      { id: 'm4', name: 'Tubo conduit PVC 3/4"', category: 'Baja', quantity: 25, unit: 'metros', status: 'pending' },
      { id: 'm5', name: 'Cinta aislante', category: 'Baja', quantity: 5, unit: 'unidades', status: 'delivered' },
    ],
    evidences: [
      { id: 'e1', type: 'photo', url: 'https://picsum.photos/400/400?random=1', description: 'Instalación inicial', date: '22 Abr, 8:30 AM', location: 'Centro Comercial Plaza Norte' },
      { id: 'e2', type: 'photo', url: 'https://picsum.photos/400/400?random=2', description: 'Cableado principal', date: '22 Abr, 9:15 AM', location: 'Centro Comercial Plaza Norte' },
      { id: 'e3', type: 'video', url: 'https://picsum.photos/400/400?random=3', description: 'Prueba de encendido', date: '22 Abr, 10:45 AM', location: 'Centro Comercial Plaza Norte' },
      { id: 'e4', type: 'photo', url: 'https://picsum.photos/400/400?random=4', description: 'Tubería eléctrica', date: '22 Abr, 11:30 AM', location: 'Centro Comercial Plaza Norte' },
    ],
  },
  {
    id: '2',
    title: 'Mantenimiento preventivo',
    client: 'Edificio Torre Central',
    location: 'Calle San Martín 456',
    status: 'scheduled',
    date: '23 Abr 2026',
    time: '9:00 AM - 2:00 PM',
    description: 'Mantenimiento preventivo de tableros eléctricos y sistema de iluminación.',
    progress: 0,
    supervisor: { name: 'Luis Medina', phone: '+51 955 444 333' },
    tasks: [
      { id: 't4', title: 'Inspección de tableros', status: 'pending', priority: 'high', completed: false },
      { id: 't5', title: 'Limpieza de luminarias', status: 'pending', priority: 'medium', completed: false },
    ],
    materials: [
      { id: 'm6', name: 'Limpiador de contactos', category: 'Media', quantity: 2, unit: 'latas', status: 'pending' },
      { id: 'm7', name: 'Bombillas LED 15W', category: 'Alta', quantity: 10, unit: 'unidades', status: 'pending' },
    ],
    evidences: [],
  },
  {
    id: '3',
    title: 'Revisión de sistema eléctrico',
    client: 'Hospital Santa Rosa',
    location: 'Av. Javier Prado 789',
    status: 'pending',
    date: '24 Abr 2026',
    time: '7:00 AM - 3:00 PM',
    description: 'Revisión completa del sistema eléctrico del ala norte.',
    progress: 0,
    supervisor: { name: 'María García', phone: '+51 911 222 333' },
    tasks: [
      { id: 't6', title: 'Revisión de cableado', status: 'pending', priority: 'high', completed: false },
      { id: 't7', title: 'Prueba de continuidad', status: 'pending', priority: 'high', completed: false },
      { id: 't8', title: 'Reporte de hallazgos', status: 'pending', priority: 'medium', completed: false },
    ],
    materials: [],
    evidences: [],
  },
  {
    id: '4',
    title: 'Instalación de paneles solares',
    client: 'Planta Industrial ABC',
    location: 'Carretera Panamericana km 25',
    status: 'completed',
    date: '18 Abr 2026',
    time: '8:00 AM - 6:00 PM',
    description: 'Instalación de 20 paneles solares en techo industrial.',
    progress: 100,
    supervisor: { name: 'Pedro Sánchez', phone: '+51 977 666 555' },
    tasks: [
      { id: 't9', title: 'Montaje de estructuras', status: 'completed', priority: 'high', completed: true },
      { id: 't10', title: 'Instalación de paneles', status: 'completed', priority: 'high', completed: true },
      { id: 't11', title: 'Conexión eléctrica', status: 'completed', priority: 'high', completed: true },
    ],
    materials: [],
    evidences: [],
  },
];

export const incidents: Incident[] = [
  {
    id: 'i1',
    title: 'Daño en cableado existente',
    severity: 'high',
    status: 'open',
    date: '22 Abr, 6:20 AM',
    description: 'Se encontró cableado deteriorado en el sector este durante la inspección inicial.',
    jobId: '1',
  },
  {
    id: 'i2',
    title: 'Retraso en entrega de materiales',
    severity: 'medium',
    status: 'open',
    date: '21 Abr, 4:30 PM',
    description: 'Los conectores estancos no llegaron a tiempo, se reprogramó para mañana.',
  },
  {
    id: 'i3',
    title: 'Condiciones climáticas',
    severity: 'low',
    status: 'resolved',
    date: '20 Abr, 2:15 PM',
    description: 'Lluvia ligera que retrasó el trabajo por 2 horas.',
  },
];

export const trips: Trip[] = [
  {
    id: 'tr1',
    destination: 'Arequipa',
    origin: 'Lima',
    status: 'active',
    startDate: '23 Abr 2026',
    endDate: '25 Abr 2026',
    objective: 'Mantenimiento preventivo de sistemas fotovoltaicos en planta solar.',
    transport: 'Terrestre',
    accommodation: 'Hotel Tierra Viva Arequipa',
  },
  {
    id: 'tr2',
    destination: 'Cusco',
    origin: 'Lima',
    status: 'scheduled',
    startDate: '29 - 30 Abr 2026',
    endDate: '30 Abr 2026',
    objective: 'Instalación de equipos de medición energética.',
    transport: 'Aéreo',
    accommodation: 'Hotel Costa del Sol Cusco',
  },
];

export const expenses: Expense[] = [
  { id: 'ex1', concept: 'Combustible', amount: 85.0, category: 'transporte', date: '22 Abr 2026', status: 'pending' },
  { id: 'ex2', concept: 'Peaje', amount: 25.0, category: 'transporte', date: '22 Abr 2026', status: 'approved' },
  { id: 'ex3', concept: 'Almuerzo', amount: 18.0, category: 'comida', date: '22 Abr 2026', status: 'pending' },
  { id: 'ex4', concept: 'Estacionamiento', amount: 10.0, category: 'transporte', date: '22 Abr 2026', status: 'approved' },
];

export const payments: Payment[] = [
  { id: 'p1', description: 'Pago por trabajo #J-4567', amount: 500.0, date: '18 Abr 2026', status: 'completed', jobId: '4' },
  { id: 'p2', description: 'Pago por trabajo #J-4421', amount: 400.0, date: '10 Abr 2026', status: 'completed' },
  { id: 'p3', description: 'Pago por trabajo #J-4380', amount: 350.0, date: '05 Abr 2026', status: 'completed' },
];

export const disputes: Dispute[] = [
  {
    id: 'd1',
    title: 'Pago incompleto trabajo #J-4421',
    status: 'open',
    date: '21 Abr 2026',
    description: 'El pago recibido no cubre las horas extras trabajadas.',
  },
  {
    id: 'd2',
    title: 'Diferencia en materiales',
    status: 'resolved_favor',
    date: '10 Abr 2026',
    description: 'Disputa sobre el cobro de materiales adicionales.',
  },
  {
    id: 'd3',
    title: 'Retraso en pago',
    status: 'resolved_against',
    date: '02 Abr 2026',
    description: 'Pago fue procesado con retraso por problemas administrativos.',
  },
];

export const hotelReservations: HotelReservation[] = [
  {
    id: 'h1',
    hotelName: 'Hotel Tierra Viva Arequipa',
    address: 'Calle Jerusalén 202, Arequipa',
    checkIn: '23 Abr 2026',
    checkOut: '25 Abr 2026',
    confirmationCode: 'HTV-4567',
    status: 'confirmed',
  },
  {
    id: 'h2',
    hotelName: 'Hotel Costa del Sol Cusco',
    address: 'Av. El Sol 602, Cusco',
    checkIn: '29 - 30 Abr 2026',
    checkOut: '30 Abr 2026',
    confirmationCode: 'PEN-8901',
    status: 'pending',
  },
];

export const fieldUnits: FieldUnit[] = [
  { id: 'u1', name: 'Unidad F-23', type: 'Vehículo', driver: 'Juan Pérez', status: 'active' },
];

export const checklists: Checklist[] = [
  { id: 'c1', title: 'Checklist diario', status: 'in_progress', progress: 60 },
  { id: 'c2', title: 'Seguridad en campo', status: 'pending', progress: 0 },
  { id: 'c3', title: 'Cierre de trabajo', status: 'pending', progress: 0 },
];

export const advanceData: Advance = {
  id: 'a1',
  amount: 380.0,
  deliveredDate: '21 Abr 2026',
  status: 'active',
  details: [
    { concept: 'Gastos de viaje y viáticos', amount: 300.0, status: 'Utilizado' },
    { concept: 'Combustible', amount: 120.0, status: 'Pendiente' },
    { concept: 'Disponible', amount: 180.0, status: 'Disponible' },
  ],
};

export const quickActions: QuickAction[] = [
  { id: 'qa1', label: 'Evidencias', icon: 'Camera', color: 'bg-teal-50 text-[#0D7377]', path: '/evidencias' },
  { id: 'qa2', label: 'Tareas', icon: 'CheckSquare', color: 'bg-amber-50 text-amber-600', path: '/tareas' },
  { id: 'qa3', label: 'Viajes', icon: 'MapPin', color: 'bg-blue-50 text-blue-600', path: '/viajes' },
  { id: 'qa4', label: 'Pagos', icon: 'DollarSign', color: 'bg-emerald-50 text-emerald-600', path: '/pagos' },
];

export const dashboardStats = {
  assignedJobs: 3,
  pendingTasks: 2,
  activeTrips: 1,
  monthlyEarnings: 1250,
};
