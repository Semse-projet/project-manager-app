import { BathroomToolClient } from "./bathroom-tool-client";

export const metadata = {
  title: "Bathroom Tool · SEMSE",
  description: "Bathroom remodel module with scope, fixture selection, plumbing coordination, and quality inspection.",
};

export default function BathroomToolPage() {
  return <BathroomToolClient section="dashboard" />;
}
