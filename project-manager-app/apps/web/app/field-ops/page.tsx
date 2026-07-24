import { redirect } from "next/navigation";

export const metadata = { title: "Operaciones de campo · SEMSE" };

export default function LegacyFieldOpsPage(): never {
  redirect("/login");
}
