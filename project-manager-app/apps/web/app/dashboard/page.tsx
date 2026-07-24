import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard · SEMSE" };

export default function LegacyDashboardPage(): never {
  redirect("/login");
}
