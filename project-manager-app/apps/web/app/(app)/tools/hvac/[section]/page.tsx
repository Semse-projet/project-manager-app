import { HvacToolClient, type HvacSection } from "../hvac-tool-client";

const VALID_SECTIONS: HvacSection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];

type Props = { params: Promise<{ section: string }> };

export async function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function HvacPage({ params }: Props) {
  const { section } = await params;
  const validSection = VALID_SECTIONS.includes(section as HvacSection) ? (section as HvacSection) : "dashboard";
  return <HvacToolClient section={validSection} />;
}
