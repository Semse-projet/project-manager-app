import { StructuralToolClient, type StructuralSection } from "../structural-tool-client";
const VALID_SECTIONS: StructuralSection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];
export async function generateStaticParams() { return VALID_SECTIONS.map((section) => ({ section })); }
export const revalidate = 3600;
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; return { title: `Structural - ${section.charAt(0).toUpperCase() + section.slice(1)}` }; }
export default async function Page({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; return <StructuralToolClient section={section as StructuralSection} />; }
