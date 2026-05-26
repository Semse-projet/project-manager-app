import { notFound } from "next/navigation";
import { ElectricalToolClient, type ElectricalSection } from "../electrical-tool-client";

type ElectricalSectionPageProps = {
  params: Promise<{ section: string }>;
};

const VALID_SECTIONS: ElectricalSection[] = [
  "dashboard",
  "estimate",
  "scope",
  "materials",
  "summary",
  "milestones",
  "inspection",
  "load-analysis",
  "research",
];

export const metadata = {
  title: "Electrical Tool · SEMSE",
  description: "Electrical trade operating module inside SEMSE Tool Hub.",
};

export function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function ElectricalSectionPage({ params }: ElectricalSectionPageProps) {
  const { section } = await params;
  if (!VALID_SECTIONS.includes(section as ElectricalSection)) {
    notFound();
  }

  return <ElectricalToolClient section={section as ElectricalSection} />;
}
