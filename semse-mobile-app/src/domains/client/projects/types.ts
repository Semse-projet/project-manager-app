export type ClientMilestoneStatus = "completed" | "in_progress" | "pending";

export type ClientMilestone = {
  id: string;
  title: string;
  description: string;
  status: ClientMilestoneStatus;
  date: string;
  amount: number;
  evidenceCount: number;
};

export type ClientProjectActivity = {
  id: string;
  type: string;
  title: string;
  date: string;
  description?: string;
};

export type ClientProject = {
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
  milestones: ClientMilestone[];
  activities: ClientProjectActivity[];
};
