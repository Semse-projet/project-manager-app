import { RoofingToolClient, type RoofingSection } from "../roofing-tool-client";

const VALID_SECTIONS: RoofingSection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];

type Props = { params: Promise<{ section: string }> };

export async function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function RoofingPage({ params }: Props) {
  const { section } = await params;
  const validSection = VALID_SECTIONS.includes(section as RoofingSection) ? (section as RoofingSection) : "dashboard";
  return <RoofingToolClient section={validSection} />;
}
