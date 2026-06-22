import { ElectricalSubsystemsToolClient, type ElectricalSubsystemsSection } from "../electrical-subsystems-tool-client";
const VALID_SECTIONS: ElectricalSubsystemsSection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];
export async function generateStaticParams() { return VALID_SECTIONS.map((section) => ({ section })); }
export const revalidate = 3600;
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; return { title: `Electrical Subsystems - ${section.charAt(0).toUpperCase() + section.slice(1)}` }; }
export default async function Page({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; return <ElectricalSubsystemsToolClient section={section as ElectricalSubsystemsSection} />; }
