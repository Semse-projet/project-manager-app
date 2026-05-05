import { ConcreteToolClient } from "./concrete-tool-client";

export const metadata = {
  title: "Concrete Tool · SEMSE",
  description: "Concrete slab calculator connected to the SEMSE tools API.",
};

export default function ConcreteToolPage() {
  return <ConcreteToolClient />;
}
