import { notFound } from "next/navigation";
import { PaintingToolClient, type PaintingSection } from "../painting-tool-client";

type PaintingSectionPageProps = {
  params: Promise<{ section: string }>;
};

const VALID_SECTIONS: PaintingSection[] = [
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
  title: "Painting Tool · SEMSE",
  description: "Painting trade operating module inside SEMSE Tool Hub.",
};

export function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function PaintingSectionPage({ params }: PaintingSectionPageProps) {
  const { section } = await params;
  if (!VALID_SECTIONS.includes(section as PaintingSection)) {
    notFound();
  }

  return <PaintingToolClient section={section as PaintingSection} />;
}
