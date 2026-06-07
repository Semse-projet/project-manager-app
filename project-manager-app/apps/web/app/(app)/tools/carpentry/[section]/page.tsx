import { notFound } from "next/navigation";
import { CarpentryToolClient, type CarpentrySection } from "../carpentry-tool-client";

type SectionPageProps = {
  params: Promise<{ section: string }>;
};

const VALID_SECTIONS: CarpentrySection[] = [
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
  title: "CARPENTRY Tool · SEMSE",
  description: "CARPENTRY trade operating module inside SEMSE Tool Hub.",
};

export function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  if (!VALID_SECTIONS.includes(section as CarpentrySection)) {
    notFound();
  }

  return <CarpentryToolClient section={section as CarpentrySection} />;
}
