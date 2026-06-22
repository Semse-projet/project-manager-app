import { notFound } from "next/navigation";
import { KitchenToolClient, type KitchenSection } from "../kitchen-tool-client";

type SectionPageProps = {
  params: Promise<{ section: string }>;
};

const VALID_SECTIONS: KitchenSection[] = [
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
  title: "KITCHEN Tool · SEMSE",
  description: "KITCHEN trade operating module inside SEMSE Tool Hub.",
};

export function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  if (!VALID_SECTIONS.includes(section as KitchenSection)) {
    notFound();
  }

  return <KitchenToolClient section={section as KitchenSection} />;
}
