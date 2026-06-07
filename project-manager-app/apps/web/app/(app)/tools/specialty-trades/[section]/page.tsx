import { SpecialtyTradesToolClient, type SpecialtyTradesSection } from "../specialty-trades-tool-client";
const VALID_SECTIONS: SpecialtyTradesSection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];
export async function generateStaticParams() { return VALID_SECTIONS.map((section) => ({ section })); }
export const revalidate = 3600;
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; return { title: `Specialty Trades - ${section.charAt(0).toUpperCase() + section.slice(1)}` }; }
export default async function Page({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; return <SpecialtyTradesToolClient section={section as SpecialtyTradesSection} />; }
