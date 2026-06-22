import { SolarToolClient, type SolarSection } from "../solar-tool-client";

const VALID_SECTIONS: SolarSection[] = [
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
  return { title: `Solar - ${section.charAt(0).toUpperCase() + section.slice(1)}` };
}

export default async function SolarSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <SolarToolClient section={section as SolarSection} />;
}
