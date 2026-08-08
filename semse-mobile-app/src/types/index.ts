export interface Job {
  id: string;
  title: string;
  client: string;
  location: string;
  status: 'active' | 'pending' | 'completed' | 'cancelled' | 'scheduled';
  date: string;
  time: string;
  description: string;
  progress: number;
  supervisor: {
    name: string;
    phone: string;
    avatar?: string;
  };
  tasks: Task[];
  materials: Material[];
  evidences: Evidence[];
}

export interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
}

export interface Material {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: 'delivered' | 'pending';
}

export interface Evidence {
  id: string;
  type: 'photo' | 'video' | 'document';
  url: string;
  thumbnail?: string;
  description: string;
  date: string;
  location?: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  status: 'open' | 'resolved';
  date: string;
  description: string;
  jobId?: string;
}

export interface Trip {
  id: string;
  destination: string;
  origin: string;
  status: 'active' | 'scheduled' | 'completed';
  startDate: string;
  endDate: string;
  objective: string;
  transport: string;
  accommodation: string;
}

export interface Expense {
  id: string;
  concept: string;
  amount: number;
  category: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Payment {
  id: string;
  description: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending';
  jobId?: string;
}

export interface Dispute {
  id: string;
  title: string;
  status: 'open' | 'resolved_favor' | 'resolved_against';
  date: string;
  description: string;
}

export interface UserProfile {
  name: string;
  role: string;
  avatar: string;
  phone: string;
  email: string;
  location: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  memberSince: string;
  jobsCompleted: number;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color: string;
  path: string;
}

export interface HotelReservation {
  id: string;
  hotelName: string;
  address: string;
  checkIn: string;
  checkOut: string;
  confirmationCode: string;
  status: 'confirmed' | 'pending';
}

export interface FieldUnit {
  id: string;
  name: string;
  type: string;
  driver: string;
  status: 'active' | 'inactive';
}

export interface Checklist {
  id: string;
  title: string;
  status: 'in_progress' | 'pending' | 'completed';
  progress: number;
}

export interface Advance {
  id: string;
  amount: number;
  deliveredDate: string;
  status: 'active' | 'used' | 'pending';
  details: { concept: string; amount: number; status: string }[];
}
