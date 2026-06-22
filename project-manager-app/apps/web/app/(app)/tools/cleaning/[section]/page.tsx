import { notFound } from "next/navigation";
import { CleaningToolClient, type CleaningSection } from "../cleaning-tool-client";

type SectionPageProps = {
  params: Promise<{ section: string }>;
};

const VALID_SECTIONS: CleaningSection[] = [
  "dashboard",
  "estimate",
  "scope",
  "materials",
  "summary",
  "milestones",
  "inspection",
  "research",
];

export const metadata = {
  title: "CLEANING Tool · SEMSE",
  description: "CLEANING trade operating module inside SEMSE Tool Hub.",
};

export function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  if (!VALID_SECTIONS.includes(section as CleaningSection)) {
    notFound();
  }

  return <CleaningToolClient section={section as CleaningSection} />;
}
