import { ConcreteToolClient, type ConcreteSection } from "../concrete-tool-client";

const VALID_SECTIONS: ConcreteSection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];

type Props = { params: Promise<{ section: string }> };

export async function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function ConcretePage({ params }: Props) {
  const { section } = await params;
  const validSection = VALID_SECTIONS.includes(section as ConcreteSection) ? (section as ConcreteSection) : "dashboard";
  return <ConcreteToolClient section={validSection} />;
}
