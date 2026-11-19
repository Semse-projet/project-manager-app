import { createRoot } from "react-dom/client";
import { SemseConsciousnessMap } from "@/components/semse/semse-consciousness-map";
import "./preview.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing preview root");
createRoot(root).render(<SemseConsciousnessMap />);
