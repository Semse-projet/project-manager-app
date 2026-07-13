import { ProjectManagerToolClient } from "./project-manager-tool-client";

export const metadata = {
  title: "Construction Manager · SEMSE",
  description: "Construction management module with field ops, trade coordination, milestones, and closeout.",
};

export default function ProjectManagerToolPage() {
  return <ProjectManagerToolClient section="dashboard" />;
}
