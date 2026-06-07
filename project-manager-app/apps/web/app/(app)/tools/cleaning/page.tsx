import { CleaningToolClient } from "./cleaning-tool-client";

export const metadata = {
  title: "Cleaning Tool · SEMSE",
  description: "Cleaning trade operating module with comprehensive scope, estimation, and guidance.",
};

export default function CleaningToolPage() {
  return <CleaningToolClient section="dashboard" />;
}
