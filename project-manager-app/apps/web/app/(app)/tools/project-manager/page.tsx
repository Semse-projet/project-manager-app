import { ProjectManagerToolClient } from "./project-manager-tool-client";

export default function ProjectManagerToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl">
        <ProjectManagerToolClient />
      </div>
    </main>
  );
}
