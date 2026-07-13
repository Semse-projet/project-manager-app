import { notFound } from "next/navigation";
import { ProjectManagerToolClient, type ProjectManagerSection } from "../project-manager-tool-client";

type ProjectManagerSectionPageProps = {
  params: Promise<{ section: string }>;
};

const VALID_SECTIONS: ProjectManagerSection[] = [
  "dashboard",
  "fieldops",
  "plan",
  "coordination",
  "milestones",
  "inspection",
  "research",
];

export const metadata = {
  title: "Construction Manager · SEMSE",
  description: "Construction management module inside SEMSE Tool Hub.",
};

export function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function ProjectManagerSectionPage({ params }: ProjectManagerSectionPageProps) {
  const { section } = await params;
  if (!VALID_SECTIONS.includes(section as ProjectManagerSection)) {
    notFound();
  }

  return <ProjectManagerToolClient section={section as ProjectManagerSection} />;
}
