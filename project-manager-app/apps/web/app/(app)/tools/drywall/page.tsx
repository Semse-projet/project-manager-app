import { DrywallToolClient } from "./drywall-tool-client";

export const metadata = {
  title: "Drywall Tool · SEMSE",
  description: "Drywall trade operating module with comprehensive scope, estimation, and guidance.",
};

export default function DrywallToolPage() {
  return <DrywallToolClient section="dashboard" />;
}
