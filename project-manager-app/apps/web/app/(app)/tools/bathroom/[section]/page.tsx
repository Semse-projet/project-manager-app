import { notFound } from "next/navigation";
import { BathroomToolClient, type BathroomSection } from "../bathroom-tool-client";

type BathroomSectionPageProps = {
  params: Promise<{ section: string }>;
};

const VALID_SECTIONS: BathroomSection[] = [
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
  title: "Bathroom Tool · SEMSE",
  description: "Bathroom remodel operating module inside SEMSE Tool Hub.",
};

export function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function BathroomSectionPage({ params }: BathroomSectionPageProps) {
  const { section } = await params;
  if (!VALID_SECTIONS.includes(section as BathroomSection)) {
    notFound();
  }

  return <BathroomToolClient section={section as BathroomSection} />;
}
