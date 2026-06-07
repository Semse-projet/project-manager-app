import { notFound } from "next/navigation";
import { DrywallToolClient, type DrywallSection } from "../drywall-tool-client";

type SectionPageProps = {
  params: Promise<{ section: string }>;
};

const VALID_SECTIONS: DrywallSection[] = [
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
  title: "DRYWALL Tool · SEMSE",
  description: "DRYWALL trade operating module inside SEMSE Tool Hub.",
};

export function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  if (!VALID_SECTIONS.includes(section as DrywallSection)) {
    notFound();
  }

  return <DrywallToolClient section={section as DrywallSection} />;
}
