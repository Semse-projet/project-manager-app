import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createWorkspaceStore } from "../../apps/web/lib/stores/workspace-state.ts";
import {
  normalizeProjects,
  filterProjects,
  resolveSelectedProject,
  resolveProjectIds,
  readProjectMilestones,
  projectStatusLabel,
  milestoneStatusLabel,
} from "../../apps/web/app/workspace/lib/projects-model.ts";
import { buildCanonicalProjectView } from "../../apps/web/lib/canonical-project-view.ts";

function queryStoreBindings(React: any) {
  const unused = async () => { throw new Error("No network in query fixture"); };
  const workspaceStore = createWorkspaceStore({ getContext: unused, navigate: unused, loadMission: unused, unloadMission: unused });
  return { workspaceStore, useWorkspaceStore: () => React.useSyncExternalStore(workspaceStore.subscribe, workspaceStore.getSnapshot, workspaceStore.getServerSnapshot) };
}

const projects = () =>
  normalizeProjects(
    [
      { id: "project-a", jobId: "job-a", status: "OPEN" },
      { id: "project-b", jobId: "job-b", status: "blocked" },
    ],
    [
      { id: "job-a", title: "Reparación sintética", scope: "Tubería" },
      { id: "job-b", title: "Pintura sintética" },
    ],
  );

test("estados y búsqueda local conservan el agregado Project", () => {
  const rows = projects();
  assert.equal(rows[0].status, "open");
  assert.deepEqual(
    filterProjects(rows, "reparacion", "open").map((p) => p.id),
    ["project-a"],
  );
  assert.deepEqual(
    filterProjects(rows, "", "blocked").map((p) => p.id),
    ["project-b"],
  );
  assert.equal(projectStatusLabel("IN_PROGRESS"), "En curso");
  assert.equal(projectStatusLabel("active"), "Estado no reconocido (active)");
  assert.equal(milestoneStatusLabel("awaiting_review"), "Listo");
  assert.equal(milestoneStatusLabel("PAID"), "Pagado");
  assert.equal(milestoneStatusLabel("submitted"), "En revisión");
  assert.equal(
    normalizeProjects([{ id: "unknown", status: "future" }])[0].status,
    "future",
  );
});

test("selección solo resuelve Project.id de la lista autorizada", () => {
  assert.equal(resolveSelectedProject(projects(), "project-a")?.jobId, "job-a");
  assert.equal(resolveSelectedProject(projects(), "job-a"), null);
  assert.equal(resolveSelectedProject(projects(), "buildops-a"), null);
  assert.equal(resolveSelectedProject(projects(), "project-de-otra-org"), null);
});

test("Project, Job y BuildOps conservan referencias distintas sin fallback implícito", () => {
  assert.deepEqual(
    resolveProjectIds("canonical", { id: "project-a", jobId: "job-a" }),
    {
      canonicalProjectId: "project-a",
      jobId: "job-a",
      buildOpsProjectId: null,
    },
  );
  assert.deepEqual(
    resolveProjectIds("buildops", {
      id: "buildops-a",
      canonicalProjectId: "project-a",
      jobId: "job-a",
    }),
    {
      canonicalProjectId: "project-a",
      jobId: "job-a",
      buildOpsProjectId: "buildops-a",
    },
  );
  assert.deepEqual(resolveProjectIds("buildops", { id: "buildops-unlinked" }), {
    canonicalProjectId: null,
    jobId: null,
    buildOpsProjectId: "buildops-unlinked",
  });
});

test("errores de contrato no se convierten en un vacío válido", () => {
  assert.throws(() => normalizeProjects(undefined), /respuesta/i);
  assert.throws(() => normalizeProjects({ data: [] }), /respuesta/i);
  assert.throws(
    () => normalizeProjects([{ id: "", status: "open" }]),
    /identificador/i,
  );
  assert.deepEqual(normalizeProjects([]), []);
});

test("consulta hitos mediante jobId autorizado codificado, nunca Project.id", async () => {
  const project = normalizeProjects([
    { id: "project-a", jobId: "job/a ?", status: "open" },
  ])[0];
  let requested = "";
  const result = await readProjectMilestones(project, async (id) => {
    requested = id;
    return [
      {
        id: "milestone-a",
        projectId: "project-a",
        title: "Hito sintético",
        status: "approved",
        sequence: 1,
      },
    ];
  });
  assert.equal(requested, "job%2Fa%20%3F");
  assert.equal(result[0].status, "approved");
  assert.equal(result[0].dueDate, null);
});

test("hitos rechaza mezcla de agregados, error API y contrato inválido", async () => {
  const project = projects()[0];
  const denied = Object.assign(new Error("403 acceso denegado"), {
    status: 403,
  });
  await assert.rejects(
    readProjectMilestones(project, async () => {
      throw denied;
    }),
    (e: unknown) => e === denied,
  );
  await assert.rejects(
    readProjectMilestones(project, async () => undefined as never),
    /respuesta/i,
  );
  await assert.rejects(
    readProjectMilestones(project, async () => [
      { id: "m", projectId: "project-b" },
    ]),
    /proyecto/i,
  );
  await assert.rejects(
    readProjectMilestones({ ...project, jobId: null }, async () => {
      throw new Error("no debe llamar");
    }),
    /vinculado/i,
  );
  assert.deepEqual(await readProjectMilestones(project, async () => []), []);
});

test("vista canónica no fabrica riesgo o avance ni mezcla datos de otro Job", () => {
  const view = buildCanonicalProjectView(
    { id: "project-a", jobId: "job-a" },
    { id: "job-a", title: "Trabajo sintético", budgetMax: NaN },
  );
  assert.equal(view?.budgetEstimate, null);
  assert.equal(view && "riskScore" in view, false);
  assert.equal(view && "completion" in view, false);
  assert.equal(
    buildCanonicalProjectView(
      { id: "project-a", jobId: "job-a" },
      { id: "job-b", title: "Otro" },
    ),
    null,
  );
});

// Ejecuta el hook real transpilado con el tooling ya instalado; no consulta APIs.
test("hook real: null no consulta, errores no son vacío y respuestas viejas/unmount se descartan", async () => {
  const require = createRequire(new URL("../../package.json", import.meta.url));
  const ts = require("typescript");
  const React = require("react");
  const renderer = require("react-test-renderer");
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const storeBindings = queryStoreBindings(React);
  const source = readFileSync(
    new URL(
      "../../apps/web/app/workspace/lib/use-workspace-query.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const exports: Record<string, any> = {};
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports, require: (name: string) => name === "../../../lib/stores/workspaceStore" ? storeBindings : require(name), Promise, Error },
  );
  let snapshot: any;
  function Probe({
    queryKey,
    loader,
  }: {
    queryKey: string | null;
    loader: () => Promise<string[]>;
  }) {
    snapshot = exports.useWorkspaceQuery(queryKey, loader);
    return null;
  }
  let calls = 0;
  const disabled = async () => {
    calls++;
    return [];
  };
  let root: any;
  await renderer.act(async () => {
    root = renderer.create(
      React.createElement(Probe, { queryKey: null, loader: disabled }),
    );
  });
  assert.equal(calls, 0);
  let resolveOld!: (v: string[]) => void;
  const old = () =>
    new Promise<string[]>((r) => {
      resolveOld = r;
    });
  await renderer.act(async () => {
    root.update(
      React.createElement(Probe, { queryKey: "project-a", loader: old }),
    );
  });
  const newer = async () => ["milestone-b"];
  await renderer.act(async () => {
    root.update(
      React.createElement(Probe, { queryKey: "project-b", loader: newer }),
    );
  });
  await renderer.act(async () => {
    resolveOld(["milestone-a"]);
  });
  assert.deepEqual(snapshot.data, ["milestone-b"]);
  const denied = async () => {
    throw new Error("403 acceso denegado");
  };
  await renderer.act(async () => {
    root.update(
      React.createElement(Probe, { queryKey: "forbidden", loader: denied }),
    );
  });
  assert.equal(snapshot.data, null);
  assert.match(snapshot.error, /403/);
  let resolveUnmount!: (v: string[]) => void;
  const pending = () =>
    new Promise<string[]>((r) => {
      resolveUnmount = r;
    });
  await renderer.act(async () => {
    root.update(
      React.createElement(Probe, { queryKey: "unmount", loader: pending }),
    );
  });
  await renderer.act(async () => {
    root.unmount();
    resolveUnmount(["never shown"]);
  });
  assert.equal(snapshot.data, null);
});

test("contrato UI conecta helpers reales, rol null y vínculos sin filtro ignorado ni storage", () => {
  const read = (path: string) =>
    readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  const panel = read("apps/web/app/workspace/components/ProjectsPanel.tsx");
  const detail = read(
    "apps/web/app/(app)/client/projects/[projectId]/page.tsx",
  );
  const listing = read("apps/web/app/(app)/client/projects/page.tsx");
  assert.match(panel, /role: WorkspaceRole \| null/);
  assert.match(panel, /useWorkspaceQuery/);
  assert.match(panel, /if \(!role\)/);
  assert.match(panel, /fetchJobMilestones/);
  assert.match(detail, /readProjectMilestones/);
  assert.doesNotMatch(
    detail,
    /buildops\/milestones\?projectId|riskScore: 0|completion: 0|riskLevel: "low"/,
  );
  assert.doesNotMatch(
    listing,
    /fetchProjects\(\)\.catch|on_hold|status.*\?\? "active"/,
  );
  for (const source of [panel, detail, listing])
    assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test("panel real: rol nulo sin requests/enlaces y selección descarta hitos fuera de orden", async () => {
  const require = createRequire(
    new URL("../../apps/web/package.json", import.meta.url),
  );
  const ts = require("typescript");
  const React = require("react");
  const renderer = require("react-test-renderer");
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const model =
    await import("../../apps/web/app/workspace/lib/projects-model.ts");
  const storeBindings = queryStoreBindings(React);
  function loadSource(path: string, aliases: Record<string, unknown> = {}) {
    const source = readFileSync(
      new URL(`../../${path}`, import.meta.url),
      "utf8",
    );
    const exports: Record<string, any> = {};
    runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      {
        exports,
        require: (name: string) => aliases[name] ?? (name === "../../../lib/stores/workspaceStore" ? storeBindings : require(name)),
        Promise,
        Error,
      },
    );
    return exports;
  }
  const query = loadSource("apps/web/app/workspace/lib/use-workspace-query.ts");
  const state = loadSource("apps/web/app/workspace/components/PanelState.tsx");
  const calls: string[] = [];
  let resolveA!: (rows: Record<string, unknown>[]) => void;
  const api = {
    fetchProjects: async () => {
      calls.push("projects");
      return [
        { id: "project-a", jobId: "job-a", status: "open" },
        { id: "project-b", jobId: "job-b", status: "blocked" },
      ];
    },
    fetchJobs: async () => {
      calls.push("jobs");
      return [
        { id: "job-a", title: "Proyecto A sintético" },
        { id: "job-b", title: "Proyecto B sintético" },
      ];
    },
    fetchJobMilestones: (id: string): Promise<Record<string, unknown>[]> => {
      calls.push(id);
      if (id === "job-a")
        return new Promise((resolve) => {
          resolveA = resolve;
        });
      return Promise.resolve([
        {
          id: "milestone-b",
          projectId: "project-b",
          title: "Hito B confirmado",
          status: "paid",
        },
      ]);
    },
  };
  const module = loadSource(
    "apps/web/app/workspace/components/ProjectsPanel.tsx",
    {
      "../../semse-api": api,
      "../lib/projects-model": model,
      "../lib/use-workspace-query": query,
      "./PanelState": state,
      "next/link": {
        __esModule: true,
        default: (props: Record<string, unknown>) =>
          React.createElement("a", props),
      },
    },
  );
  let root: any;
  await renderer.act(async () => {
    root = renderer.create(
      React.createElement(module.ProjectsPanel, { role: null }),
    );
  });
  assert.deepEqual(calls, []);
  assert.equal(root.root.findAllByType("a").length, 0);
  await renderer.act(async () => {
    root.update(React.createElement(module.ProjectsPanel, { role: "client" }));
  });
  assert.deepEqual(calls, ["projects", "jobs"]);
  const selector = () => root.root.findAllByType("select").at(-1);
  await renderer.act(async () => {
    selector().props.onChange({ target: { value: "project-a" } });
  });
  assert.equal(calls.at(-1), "job-a");
  await renderer.act(async () => {
    selector().props.onChange({ target: { value: "project-b" } });
  });
  await renderer.act(async () => {
    resolveA([
      {
        id: "milestone-a",
        projectId: "project-a",
        title: "Hito A obsoleto",
        status: "draft",
      },
    ]);
  });
  assert.match(JSON.stringify(root.toJSON()), /Hito B confirmado/);
  assert.doesNotMatch(JSON.stringify(root.toJSON()), /Hito A obsoleto/);
  api.fetchJobMilestones = async () => {
    throw Object.assign(new Error("Missing permission milestones:read"), {
      status: 403,
    });
  };
  await renderer.act(async () => {
    selector().props.onChange({ target: { value: "project-a" } });
  });
  assert.match(JSON.stringify(root.toJSON()), /Sin acceso a los hitos/);
  assert.doesNotMatch(JSON.stringify(root.toJSON()), /Sin hitos registrados/);
  const beforeNull = calls.length;
  await renderer.act(async () => {
    root.update(React.createElement(module.ProjectsPanel, { role: null }));
  });
  assert.equal(calls.length, beforeNull);
  assert.equal(root.root.findAllByType("a").length, 0);
  await renderer.act(async () => {
    root.update(React.createElement(module.ProjectsPanel, { role: "client" }));
  });
  assert.equal(selector().props.value, "");
  assert.doesNotMatch(JSON.stringify(root.toJSON()), /Hito B confirmado/);
  api.fetchProjects = async () => {
    throw Object.assign(new Error("Missing permission projects:read"), {
      status: 403,
    });
  };
  await renderer.act(async () => {
    root.update(React.createElement(module.ProjectsPanel, { role: "worker" }));
  });
  assert.match(JSON.stringify(root.toJSON()), /Sin acceso a los proyectos/);
  assert.doesNotMatch(
    JSON.stringify(root.toJSON()),
    /Sin proyectos autorizados/,
  );
  await renderer.act(async () => {
    root.unmount();
  });
});
