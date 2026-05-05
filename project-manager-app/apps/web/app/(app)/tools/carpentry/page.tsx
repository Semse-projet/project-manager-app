import { CarpentryToolClient } from "./carpentry-tool-client";

export const metadata = {
  title: "Carpentry Tool · SEMSE",
  description: "Carpentry calculator connected to the SEMSE tools API.",
};

export default function CarpentryToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <CarpentryToolClient />
      </div>
    </main>
  );
}
