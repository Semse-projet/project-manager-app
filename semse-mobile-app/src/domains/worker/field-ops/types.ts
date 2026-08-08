export type WorkerFieldUnit = {
  id: string;
  name: string;
  type: string;
  driver: string;
  status: "active" | "inactive";
};

export type WorkerChecklist = {
  id: string;
  title: string;
  status: "in_progress" | "pending" | "completed";
  progress: number;
};
