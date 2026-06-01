import { SidingToolClient, type SidingSection } from "../siding-tool-client";

const VALID_SECTIONS: SidingSection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];

type Props = { params: Promise<{ section: string }> };

export async function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function SidingPage({ params }: Props) {
  const { section } = await params;
  const validSection = VALID_SECTIONS.includes(section as SidingSection) ? (section as SidingSection) : "dashboard";
  return <SidingToolClient section={validSection} />;
}
