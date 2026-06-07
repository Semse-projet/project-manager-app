import { PlumbingToolClient, type PlumbingSection } from "../plumbing-tool-client";

const VALID_SECTIONS: PlumbingSection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];

type Props = { params: Promise<{ section: string }> };

export async function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function PlumbingPage({ params }: Props) {
  const { section } = await params;
  const validSection = VALID_SECTIONS.includes(section as PlumbingSection) ? (section as PlumbingSection) : "dashboard";
  return <PlumbingToolClient section={validSection} />;
}
