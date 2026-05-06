"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";

type BuildOpsProjectInput = {
  title: string;
  description: string;
  trade: string;
  projectType: string;
  clientName: string;
  professionalName: string;
  location: string;
  budgetEstimate: string;
  status: string;
  startDate: string;
  dueDate: string;
};

const INITIAL_INPUT: BuildOpsProjectInput = {
  title: "",
  description: "",
  trade: "roofing",
  projectType: "remodel",
  clientName: "",
  professionalName: "",
  location: "",
  budgetEstimate: "",
  status: "draft",
  startDate: "",
  dueDate: "",
};

export default function NewBuildOpsProjectPage() {
  const [input, setInput] = useState<BuildOpsProjectInput>(INITIAL_INPUT);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/buildops/projects" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} />
            Back to projects
          </Link>
          <Badge variant="brand">BuildOps</Badge>
        </div>

        <section className="grid gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-ink">New project</h1>
          <p className="max-w-2xl text-sm text-muted">
            Shell only. Save flow comes later when DB wiring lands.
          </p>
        </section>

        <Card className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Title" value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} />
            <Select label="Trade" value={input.trade} onChange={(event) => setInput({ ...input, trade: event.target.value })}>
              <option value="roofing">Roofing</option>
              <option value="concrete">Concrete</option>
              <option value="plumbing">Plumbing</option>
              <option value="hvac">HVAC</option>
              <option value="electrical">Electrical</option>
              <option value="painting">Painting</option>
              <option value="drywall">Drywall</option>
              <option value="flooring">Flooring</option>
              <option value="carpentry">Carpentry</option>
              <option value="tile">Tile</option>
            </Select>
            <Input label="Client name" value={input.clientName} onChange={(event) => setInput({ ...input, clientName: event.target.value })} />
            <Input label="Professional name" value={input.professionalName} onChange={(event) => setInput({ ...input, professionalName: event.target.value })} />
            <Input label="Location" value={input.location} onChange={(event) => setInput({ ...input, location: event.target.value })} />
            <Input label="Budget estimate" value={input.budgetEstimate} onChange={(event) => setInput({ ...input, budgetEstimate: event.target.value })} />
            <Select label="Project type" value={input.projectType} onChange={(event) => setInput({ ...input, projectType: event.target.value })}>
              <option value="remodel">Remodel</option>
              <option value="newConstruction">New construction</option>
              <option value="repair">Repair</option>
              <option value="service">Service</option>
            </Select>
            <Select label="Status" value={input.status} onChange={(event) => setInput({ ...input, status: event.target.value })}>
              <option value="draft">Draft</option>
              <option value="estimating">Estimating</option>
              <option value="quoted">Quoted</option>
              <option value="approved">Approved</option>
            </Select>
            <Input label="Start date" type="date" value={input.startDate} onChange={(event) => setInput({ ...input, startDate: event.target.value })} />
            <Input label="Due date" type="date" value={input.dueDate} onChange={(event) => setInput({ ...input, dueDate: event.target.value })} />
            <div className="md:col-span-2">
              <Textarea
                label="Description"
                rows={5}
                value={input.description}
                onChange={(event) => setInput({ ...input, description: event.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
            <p className="text-sm text-muted">No DB yet. Form is ready for next phase.</p>
            <Button type="button" disabled>
              <Save size={16} />
              Save project
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
