import { CarpentryToolClient } from "./carpentry-tool-client";

export const metadata = {
  title: "Carpentry Tool · SEMSE",
  description: "Carpentry trade operating module with comprehensive scope, estimation, and guidance.",
};

export default function CarpentryToolPage() {
  return <CarpentryToolClient section="dashboard" />;
}
