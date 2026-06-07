import { InsulationToolClient, type InsulationSection } from "../insulation-tool-client";

const VALID_SECTIONS: InsulationSection[] = [
  "dashboard",
  "estimate",
  "scope",
  "materials",
  "summary",
  "milestones",
  "inspection",
  "research",
];

export async function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return { title: `Insulation - ${section.charAt(0).toUpperCase() + section.slice(1)}` };
}

export default async function InsulationSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <InsulationToolClient section={section as InsulationSection} />;
}
