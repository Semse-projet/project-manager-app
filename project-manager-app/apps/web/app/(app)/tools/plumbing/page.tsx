import { PlumbingToolClient } from "./plumbing-tool-client";

export const metadata = {
  title: "Plumbing Tool · SEMSE",
  description: "Plumbing calculator connected to the SEMSE tools API.",
};

export default function PlumbingToolPage() {
  return <PlumbingToolClient />;
}
