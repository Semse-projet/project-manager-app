import { FencingToolClient, type FencingSection } from "../fencing-tool-client";

const VALID_SECTIONS: FencingSection[] = [
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
  return { title: `Fencing - ${section.charAt(0).toUpperCase() + section.slice(1)}` };
}

export default async function FencingSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <FencingToolClient section={section as FencingSection} />;
}
