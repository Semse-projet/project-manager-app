import { KitchenToolClient } from "./kitchen-tool-client";

export const metadata = {
  title: "Kitchen Tool · SEMSE",
  description: "Kitchen trade operating module with comprehensive scope, estimation, and guidance.",
};

export default function KitchenToolPage() {
  return <KitchenToolClient section="dashboard" />;
}
