import { FlooringToolClient, type FlooringSection } from "../flooring-tool-client";

const VALID_SECTIONS: FlooringSection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];

type Props = { params: Promise<{ section: string }> };

export async function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function FlooringPage({ params }: Props) {
  const { section } = await params;
  const validSection = VALID_SECTIONS.includes(section as FlooringSection) ? (section as FlooringSection) : "dashboard";
  return <FlooringToolClient section={validSection} />;
}
