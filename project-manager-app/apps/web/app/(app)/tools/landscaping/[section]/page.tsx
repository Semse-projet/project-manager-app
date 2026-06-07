import { LandscapingToolClient, type LandscapingSection } from "../landscaping-tool-client";

const VALID_SECTIONS: LandscapingSection[] = [
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
  return { title: `Landscaping - ${section.charAt(0).toUpperCase() + section.slice(1)}` };
}

export default async function LandscapingSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <LandscapingToolClient section={section as LandscapingSection} />;
}
