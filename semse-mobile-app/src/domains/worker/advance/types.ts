export type WorkerAdvanceDetail = {
  concept: string;
  amount: number;
  status: string;
};

export type WorkerAdvance = {
  id: string;
  amount: number;
  deliveredDate: string;
  status: "active" | "used" | "pending";
  details: WorkerAdvanceDetail[];
};
