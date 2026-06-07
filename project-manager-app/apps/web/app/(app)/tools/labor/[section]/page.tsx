import { LaborToolClient, type LaborSection } from "../labor-tool-client";

const VALID_SECTIONS: LaborSection[] = [
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
  return { title: `Labor - ${section.charAt(0).toUpperCase() + section.slice(1)}` };
}

export default async function LaborSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <LaborToolClient section={section as LaborSection} />;
}
