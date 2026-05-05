import { WindowsDoorsToolClient } from "./windows-doors-tool-client";

export const metadata = {
  title: "Windows / Doors Tool · SEMSE",
  description: "Windows and doors calculator connected to the SEMSE tools API.",
};

export default function WindowsDoorsToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <WindowsDoorsToolClient />
      </div>
    </main>
  );
}
