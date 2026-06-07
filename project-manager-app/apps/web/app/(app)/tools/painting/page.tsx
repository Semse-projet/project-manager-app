import { PaintingToolClient } from "./painting-tool-client";

export const metadata = {
  title: "Painting Tool · SEMSE",
  description: "Painting trade operating module with scope, estimation, materials, and research-backed guidance.",
};

export default function PaintingToolPage() {
  return <PaintingToolClient section="dashboard" />;
}
