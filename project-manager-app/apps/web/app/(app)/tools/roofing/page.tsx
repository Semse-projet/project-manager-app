import { RoofingToolClient } from "./roofing-tool-client";

export const metadata = {
  title: "Roofing Tool · SEMSE",
  description: "First SEMSE Pro Tools workflow connected to the tools API.",
};

export default function RoofingToolPage() {
  return <RoofingToolClient />;
}
