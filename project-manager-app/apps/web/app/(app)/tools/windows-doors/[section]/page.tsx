import { WindowsDoorsToolClient, type WindowsDoorsSection } from "../windows-doors-tool-client";

const VALID_SECTIONS: WindowsDoorsSection[] = ["dashboard", "estimate", "scope", "materials", "summary", "milestones", "inspection", "research"];

type Props = { params: Promise<{ section: string }> };

export async function generateStaticParams() {
  return VALID_SECTIONS.map((section) => ({ section }));
}

export default async function WindowsDoorsPage({ params }: Props) {
  const { section } = await params;
  const validSection = VALID_SECTIONS.includes(section as WindowsDoorsSection) ? (section as WindowsDoorsSection) : "dashboard";
  return <WindowsDoorsToolClient section={validSection} />;
}
