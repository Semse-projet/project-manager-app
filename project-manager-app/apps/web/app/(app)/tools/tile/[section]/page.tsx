import { TileToolClient, type TileSection } from "../tile-tool-client";

const VALID_SECTIONS: TileSection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];

type Props = { params: Promise<{ section: string }> };

export async function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function TilePage({ params }: Props) {
  const { section } = await params;
  const validSection = VALID_SECTIONS.includes(section as TileSection) ? (section as TileSection) : "dashboard";
  return <TileToolClient section={validSection} />;
}
