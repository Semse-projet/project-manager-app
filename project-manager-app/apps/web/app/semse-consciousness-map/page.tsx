import { SemseConsciousnessMap } from "@/components/semse/semse-consciousness-map";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SEMSE Consciousness Map",
  description: "Visualización interactiva del cerebro digital de SEMSEproject",
};

export default function SemseConsciousnessMapPage() {
  return <SemseConsciousnessMap />;
}
