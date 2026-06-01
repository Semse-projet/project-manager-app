import { DeckToolClient, type DeckSection } from "../deck-tool-client";

const VALID_SECTIONS: DeckSection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];

type Props = { params: Promise<{ section: string }> };

export async function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function DeckPage({ params }: Props) {
  const { section } = await params;
  const validSection = VALID_SECTIONS.includes(section as DeckSection) ? (section as DeckSection) : "dashboard";
  return <DeckToolClient section={validSection} />;
}
