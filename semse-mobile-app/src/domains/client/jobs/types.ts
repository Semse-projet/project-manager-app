export type ClientJobStatus = "active" | "published" | "completed";

export type ClientJob = {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  location: string;
  budget: string;
  status: ClientJobStatus;
  date: string;
  proposals: number;
  image?: string;
};

export type ClientActivity = {
  id: string;
  title: string;
  detail: string;
  time: string;
  icon: string;
};

export type ClientProfileSnapshot = {
  name: string;
  email: string;
  phone: string;
  location: string;
  address: string;
  memberSince: string;
  projectsCount: number;
  avatar: string;
};
