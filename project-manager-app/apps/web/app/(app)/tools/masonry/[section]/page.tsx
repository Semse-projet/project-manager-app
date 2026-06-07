import { MasonryToolClient, type MasonrySection } from "../masonry-tool-client";

const VALID_SECTIONS: MasonrySection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];

type Props = { params: Promise<{ section: string }> };

export async function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function MasonryPage({ params }: Props) {
  const { section } = await params;
  const validSection = VALID_SECTIONS.includes(section as MasonrySection) ? (section as MasonrySection) : "dashboard";
  return <MasonryToolClient section={validSection} />;
}
