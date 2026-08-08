export type WorkerJobStatus = "active" | "pending" | "completed" | "cancelled" | "scheduled";

export type WorkerSupervisor = {
  name: string;
  phone: string;
  avatar?: string;
};

export type WorkerTaskStatus = "pending" | "in_progress" | "completed";

export type WorkerTaskPriority = "high" | "medium" | "low";

export type WorkerTask = {
  id: string;
  title: string;
  status: WorkerTaskStatus;
  priority: WorkerTaskPriority;
  completed: boolean;
};

export type WorkerMaterial = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: "delivered" | "pending";
};

export type WorkerJobEvidence = {
  id: string;
  type: "photo" | "video" | "document";
  url: string;
  description: string;
  date: string;
  location?: string;
};

export type WorkerJob = {
  id: string;
  title: string;
  client: string;
  location: string;
  status: WorkerJobStatus;
  rawStatus?: string;
  budgetMin?: number;
  budgetMax?: number;
  date: string;
  time: string;
  description: string;
  progress: number;
  supervisor: WorkerSupervisor;
  tasks: WorkerTask[];
  materials: WorkerMaterial[];
  evidences: WorkerJobEvidence[];
};

export type WorkerJobStats = {
  assignedJobs: number;
  pendingTasks: number;
  activeTrips: number;
  monthlyEarnings: number;
};
