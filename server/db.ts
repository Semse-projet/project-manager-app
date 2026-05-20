import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLog,
  documents,
  documentVersions,
  notifications,
  projectFiles,
  projects,
  tasks,
  userPreferences,
  users,
  type ActivityLogEntry,
  type Document,
  type DocumentVersion,
  type InsertUser,
  type Notification,
  type Project,
  type ProjectFile,
  type Task,
  type User,
  type UserPreference,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

type ProjectStatus = "active" | "archived" | "deleted";
type DocumentType = "note" | "documentation" | "generated";
type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type NotificationType = "info" | "warning" | "success" | "error";

let _db: ReturnType<typeof drizzle> | null = null;

type MemoryState = {
  users: User[];
  preferences: UserPreference[];
  projects: Project[];
  files: ProjectFile[];
  documents: Document[];
  tasks: Task[];
  activity: ActivityLogEntry[];
  versions: DocumentVersion[];
  notifications: Notification[];
  ids: {
    user: number;
    preference: number;
    project: number;
    file: number;
    document: number;
    task: number;
    activity: number;
    version: number;
    notification: number;
  };
  seededUsers: Set<number>;
};

const memory: MemoryState = {
  users: [],
  preferences: [],
  projects: [],
  files: [],
  documents: [],
  tasks: [],
  activity: [],
  versions: [],
  notifications: [],
  ids: {
    user: 1,
    preference: 1,
    project: 1,
    file: 1,
    document: 1,
    task: 1,
    activity: 1,
    version: 1,
    notification: 1,
  },
  seededUsers: new Set<number>(),
};

const now = () => new Date();
const useMemory = () => !process.env.DATABASE_URL;

const nextId = (key: keyof MemoryState["ids"]) => {
  const id = memory.ids[key];
  memory.ids[key] += 1;
  return id;
};

const cloneDate = (value: Date | null | undefined) =>
  value ? new Date(value) : null;

const sortByUpdatedAtDesc = <T extends { updatedAt: Date }>(items: T[]) =>
  [...items].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

function ensureMemorySeed(userId: number) {
  if (memory.seededUsers.has(userId)) return;
  memory.seededUsers.add(userId);

  const baseTime = now();
  const projectAId = nextId("project");
  const projectBId = nextId("project");
  const rootFolderId = nextId("file");
  const apiFileId = nextId("file");
  const uiFileId = nextId("file");

  memory.projects.push(
    {
      id: projectAId,
      userId,
      name: "Portal Demo",
      description: "Proyecto local para probar el dashboard sin base de datos.",
      language: "TypeScript",
      status: "active",
      lastOpenedAt: new Date(baseTime.getTime() - 1000 * 60 * 10),
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 60 * 24 * 4),
      updatedAt: new Date(baseTime.getTime() - 1000 * 60 * 18),
    },
    {
      id: projectBId,
      userId,
      name: "Landing Marketing",
      description: "Mock de una landing para validar flujos de documentos y tareas.",
      language: "React",
      status: "active",
      lastOpenedAt: new Date(baseTime.getTime() - 1000 * 60 * 70),
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 60 * 24 * 2),
      updatedAt: new Date(baseTime.getTime() - 1000 * 60 * 45),
    }
  );

  memory.files.push(
    {
      id: rootFolderId,
      projectId: projectAId,
      parentId: null,
      name: "src",
      type: "folder",
      content: null,
      language: null,
      s3Url: null,
      s3Key: null,
      size: 0,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 60 * 24 * 3),
      updatedAt: new Date(baseTime.getTime() - 1000 * 60 * 20),
    },
    {
      id: apiFileId,
      projectId: projectAId,
      parentId: rootFolderId,
      name: "api.ts",
      type: "file",
      content:
        "export async function getDashboard() {\n  return fetch('/api/trpc/dashboard.stats');\n}\n",
      language: "typescript",
      s3Url: null,
      s3Key: null,
      size: 86,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 60 * 24 * 3),
      updatedAt: new Date(baseTime.getTime() - 1000 * 60 * 25),
    },
    {
      id: uiFileId,
      projectId: projectAId,
      parentId: rootFolderId,
      name: "Home.tsx",
      type: "file",
      content:
        "export default function Home() {\n  return <h1>Modo local activo</h1>;\n}\n",
      language: "tsx",
      s3Url: null,
      s3Key: null,
      size: 72,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 60 * 24 * 2),
      updatedAt: new Date(baseTime.getTime() - 1000 * 60 * 30),
    }
  );

  const documentAId = nextId("document");
  const documentBId = nextId("document");
  memory.documents.push(
    {
      id: documentAId,
      projectId: projectAId,
      userId,
      title: "Plan de trabajo",
      content: "Definir alcance, tareas y entregables del portal.",
      type: "documentation",
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 60 * 12),
      updatedAt: new Date(baseTime.getTime() - 1000 * 60 * 35),
    },
    {
      id: documentBId,
      projectId: projectBId,
      userId,
      title: "Ideas de contenido",
      content: "Hero con CTA, seccion de beneficios y testimonios.",
      type: "note",
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 60 * 8),
      updatedAt: new Date(baseTime.getTime() - 1000 * 60 * 55),
    }
  );

  memory.versions.push({
    id: nextId("version"),
    documentId: documentAId,
    fileId: null,
    userId,
    content: "Definir alcance, tareas y entregables del portal.",
    versionNumber: 1,
    changeDescription: "Version inicial",
    createdAt: new Date(baseTime.getTime() - 1000 * 60 * 60 * 12),
  });

  memory.tasks.push(
    {
      id: nextId("task"),
      projectId: projectAId,
      userId,
      title: "Revisar dashboard",
      description: "Validar que los indicadores se actualicen al crear datos locales.",
      status: "in_progress",
      priority: "high",
      sortOrder: 1,
      dueDate: null,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 60 * 6),
      updatedAt: new Date(baseTime.getTime() - 1000 * 60 * 40),
    },
    {
      id: nextId("task"),
      projectId: projectAId,
      userId,
      title: "Crear documento tecnico",
      description: "Documentar flujo de autenticacion local.",
      status: "todo",
      priority: "medium",
      sortOrder: 2,
      dueDate: null,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 60 * 5),
      updatedAt: new Date(baseTime.getTime() - 1000 * 60 * 50),
    },
    {
      id: nextId("task"),
      projectId: projectBId,
      userId,
      title: "Publicar hero inicial",
      description: "Preparar una primera version de la landing.",
      status: "done",
      priority: "low",
      sortOrder: 3,
      dueDate: null,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 60 * 4),
      updatedAt: new Date(baseTime.getTime() - 1000 * 60 * 80),
    }
  );

  memory.activity.push(
    {
      id: nextId("activity"),
      userId,
      projectId: projectAId,
      action: "created",
      entityType: "project",
      entityId: projectAId,
      details: 'Proyecto "Portal Demo" creado en modo local',
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 90),
    },
    {
      id: nextId("activity"),
      userId,
      projectId: projectAId,
      action: "updated",
      entityType: "file",
      entityId: apiFileId,
      details: 'Archivo "api.ts" actualizado',
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 50),
    }
  );

  memory.notifications.push(
    {
      id: nextId("notification"),
      userId,
      title: "Modo local activo",
      message: "El portal esta usando almacenamiento en memoria para desarrollo.",
      type: "info",
      isRead: false,
      link: "/settings",
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 15),
    },
    {
      id: nextId("notification"),
      userId,
      title: "Datos de ejemplo listos",
      message: "Ya puedes crear proyectos, tareas y documentos en esta sesion.",
      type: "success",
      isRead: false,
      link: "/projects",
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 5),
    }
  );
}

function ensureMemoryUser(openId: string, partial?: Omit<InsertUser, "openId">): User {
  const details = partial ?? {};
  let user = memory.users.find(item => item.openId === openId);
  if (!user) {
    const timestamp = now();
    user = {
      id: nextId("user"),
      openId,
      name: details.name ?? "Local Dev User",
      email: details.email ?? "local@example.com",
      loginMethod: details.loginMethod ?? "local-dev",
      role:
        details.role ?? (openId === ENV.ownerOpenId && ENV.ownerOpenId ? "admin" : "user"),
      createdAt: timestamp,
      updatedAt: timestamp,
      lastSignedIn: details.lastSignedIn ?? timestamp,
    };
    memory.users.push(user);
  } else {
    user.name = details.name ?? user.name;
    user.email = details.email ?? user.email;
    user.loginMethod = details.loginMethod ?? user.loginMethod;
    user.role = details.role ?? user.role;
    user.lastSignedIn = details.lastSignedIn ?? now();
    user.updatedAt = now();
  }

  ensureMemorySeed(user.id);
  return user;
}

function ensureMemoryPreferences(userId: number): UserPreference {
  let prefs = memory.preferences.find(item => item.userId === userId);
  if (!prefs) {
    const timestamp = now();
    prefs = {
      id: nextId("preference"),
      userId,
      theme: "dark",
      editorFontSize: 14,
      editorTabSize: 2,
      editorWordWrap: true,
      editorMinimap: false,
      editorLineNumbers: true,
      aiAutoComment: true,
      aiLanguage: "es",
      keyboardShortcuts: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    memory.preferences.push(prefs);
  }
  return prefs;
}

function deleteFileTree(id: number) {
  const childIds = memory.files.filter(file => file.parentId === id).map(file => file.id);
  for (const childId of childIds) deleteFileTree(childId);
  memory.files = memory.files.filter(file => file.id !== id);
}

function getProjectFilesForUser(userId: number) {
  const projectIds = memory.projects
    .filter(project => project.userId === userId && project.status !== "deleted")
    .map(project => project.id);
  return memory.files.filter(file => projectIds.includes(file.projectId));
}

function touchProject(projectId: number | null | undefined) {
  if (!projectId) return;
  const project = memory.projects.find(item => item.id === projectId);
  if (!project) return;
  const timestamp = now();
  project.updatedAt = timestamp;
  project.lastOpenedAt = timestamp;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();

  if (!db) {
    ensureMemoryUser(user.openId, user);
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return memory.users.find(user => user.openId === openId);
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return ensureMemoryPreferences(userId);
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertUserPreferences(
  userId: number,
  prefs: Partial<typeof userPreferences.$inferInsert>
) {
  const db = await getDb();
  if (!db) {
    const existing = ensureMemoryPreferences(userId);
    Object.assign(existing, prefs, { updatedAt: now() });
    return existing;
  }

  const existing = await getUserPreferences(userId);
  if (existing) {
    await db.update(userPreferences).set(prefs).where(eq(userPreferences.userId, userId));
  } else {
    await db.insert(userPreferences).values({ userId, ...prefs });
  }
  return getUserPreferences(userId);
}

export async function getProjects(userId: number) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(userId);
    return sortByUpdatedAtDesc(
      memory.projects.filter(project => project.userId === userId && project.status !== "deleted")
    );
  }
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), sql`${projects.status} != 'deleted'`))
    .orderBy(desc(projects.updatedAt));
}

export async function getProject(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(userId);
    return (
      memory.projects.find(
        project => project.id === id && project.userId === userId && project.status !== "deleted"
      ) ?? null
    );
  }
  const result = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function createProject(data: {
  userId: number;
  name: string;
  description?: string;
  language?: string;
}) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(data.userId);
    const timestamp = now();
    const project: Project = {
      id: nextId("project"),
      userId: data.userId,
      name: data.name,
      description: data.description ?? null,
      language: data.language ?? null,
      status: "active",
      lastOpenedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    memory.projects.push(project);
    return project;
  }
  const result = await db.insert(projects).values(data);
  return getProject(result[0].insertId, data.userId);
}

export async function updateProject(
  id: number,
  userId: number,
  data: Partial<{
    name: string;
    description: string;
    language: string;
    status: ProjectStatus;
  }>
) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(userId);
    const project = memory.projects.find(item => item.id === id && item.userId === userId);
    if (!project) return null;
    Object.assign(project, data, { updatedAt: now() });
    return project;
  }
  await db.update(projects).set(data).where(and(eq(projects.id, id), eq(projects.userId, userId)));
  return getProject(id, userId);
}

export async function getProjectFiles(projectId: number, parentId: number | null) {
  const db = await getDb();
  if (!db) {
    return [...memory.files]
      .filter(file => file.projectId === projectId && file.parentId === parentId)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }
  const condition =
    parentId === null
      ? and(eq(projectFiles.projectId, projectId), isNull(projectFiles.parentId))
      : and(eq(projectFiles.projectId, projectId), eq(projectFiles.parentId, parentId));
  return db.select().from(projectFiles).where(condition).orderBy(desc(projectFiles.type), asc(projectFiles.name));
}

export async function getFileById(id: number) {
  const db = await getDb();
  if (!db) return memory.files.find(file => file.id === id) ?? null;
  const result = await db.select().from(projectFiles).where(eq(projectFiles.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createFile(data: {
  projectId: number;
  parentId?: number | null;
  name: string;
  type: "file" | "folder";
  content?: string;
  language?: string;
}) {
  const db = await getDb();
  if (!db) {
    const timestamp = now();
    const file: ProjectFile = {
      id: nextId("file"),
      projectId: data.projectId,
      parentId: data.parentId ?? null,
      name: data.name,
      type: data.type,
      content: data.content ?? null,
      language: data.language ?? null,
      s3Url: null,
      s3Key: null,
      size: data.content?.length ?? 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    memory.files.push(file);
    touchProject(data.projectId);
    return file;
  }
  const result = await db.insert(projectFiles).values({ ...data, parentId: data.parentId ?? null });
  return getFileById(result[0].insertId);
}

export async function updateFile(
  id: number,
  data: Partial<{ name: string; content: string; s3Url: string; s3Key: string }>
) {
  const db = await getDb();
  if (!db) {
    const file = memory.files.find(item => item.id === id);
    if (!file) return null;
    Object.assign(file, data, {
      size: data.content !== undefined ? data.content.length : file.size,
      updatedAt: now(),
    });
    touchProject(file.projectId);
    return file;
  }
  await db.update(projectFiles).set(data).where(eq(projectFiles.id, id));
  return getFileById(id);
}

export async function deleteFile(id: number) {
  const db = await getDb();
  if (!db) {
    const file = memory.files.find(item => item.id === id);
    if (!file) return;
    deleteFileTree(id);
    touchProject(file.projectId);
    return;
  }
  await db.delete(projectFiles).where(eq(projectFiles.id, id));
}

export async function getDocuments(userId: number, projectId?: number) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(userId);
    return sortByUpdatedAtDesc(
      memory.documents.filter(
        document =>
          document.userId === userId &&
          (projectId === undefined || document.projectId === projectId)
      )
    );
  }
  const condition = projectId
    ? and(eq(documents.userId, userId), eq(documents.projectId, projectId))
    : eq(documents.userId, userId);
  return db.select().from(documents).where(condition).orderBy(desc(documents.updatedAt));
}

export async function getDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(userId);
    return memory.documents.find(document => document.id === id && document.userId === userId) ?? null;
  }
  const result = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function createDocument(data: {
  userId: number;
  projectId?: number;
  title: string;
  content?: string;
  type?: DocumentType;
}) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(data.userId);
    const timestamp = now();
    const document: Document = {
      id: nextId("document"),
      projectId: data.projectId ?? null,
      userId: data.userId,
      title: data.title,
      content: data.content ?? null,
      type: data.type ?? "note",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    memory.documents.push(document);
    memory.versions.push({
      id: nextId("version"),
      documentId: document.id,
      fileId: null,
      userId: data.userId,
      content: document.content,
      versionNumber: 1,
      changeDescription: "Version inicial",
      createdAt: timestamp,
    });
    touchProject(document.projectId);
    return document;
  }
  const result = await db.insert(documents).values(data);
  return getDocument(result[0].insertId, data.userId);
}

export async function updateDocument(
  id: number,
  userId: number,
  data: Partial<{ title: string; content: string }>
) {
  const db = await getDb();
  if (!db) {
    const document = memory.documents.find(item => item.id === id && item.userId === userId);
    if (!document) return null;
    const previousContent = document.content;
    Object.assign(document, data, { updatedAt: now() });
    if (data.content !== undefined && data.content !== previousContent) {
      const versionCount = memory.versions.filter(version => version.documentId === id).length;
      memory.versions.push({
        id: nextId("version"),
        documentId: id,
        fileId: null,
        userId,
        content: data.content,
        versionNumber: versionCount + 1,
        changeDescription: "Actualizacion de contenido",
        createdAt: now(),
      });
    }
    touchProject(document.projectId);
    return document;
  }
  await db.update(documents).set(data).where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return getDocument(id, userId);
}

export async function deleteDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const document = memory.documents.find(item => item.id === id && item.userId === userId);
    if (!document) return;
    memory.documents = memory.documents.filter(item => !(item.id === id && item.userId === userId));
    memory.versions = memory.versions.filter(version => version.documentId !== id);
    touchProject(document.projectId);
    return;
  }
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
}

export async function getTasks(userId: number, projectId?: number) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(userId);
    return [...memory.tasks]
      .filter(task => task.userId === userId && (projectId === undefined || task.projectId === projectId))
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }
  const condition = projectId
    ? and(eq(tasks.userId, userId), eq(tasks.projectId, projectId))
    : eq(tasks.userId, userId);
  return db.select().from(tasks).where(condition).orderBy(asc(tasks.sortOrder), desc(tasks.createdAt));
}

export async function getTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(userId);
    return memory.tasks.find(task => task.id === id && task.userId === userId) ?? null;
  }
  const result = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function createTask(data: {
  userId: number;
  projectId?: number;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(data.userId);
    const timestamp = now();
    const existingTasks = memory.tasks.filter(task => task.userId === data.userId);
    const task: Task = {
      id: nextId("task"),
      projectId: data.projectId ?? null,
      userId: data.userId,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "todo",
      priority: data.priority ?? "medium",
      sortOrder: existingTasks.length + 1,
      dueDate: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    memory.tasks.push(task);
    touchProject(task.projectId);
    return task;
  }
  const result = await db.insert(tasks).values(data);
  return getTask(result[0].insertId, data.userId);
}

export async function updateTask(
  id: number,
  userId: number,
  data: Partial<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    sortOrder: number;
    dueDate: Date | null;
  }>
) {
  const db = await getDb();
  if (!db) {
    const task = memory.tasks.find(item => item.id === id && item.userId === userId);
    if (!task) return null;
    Object.assign(task, data, {
      dueDate: data.dueDate !== undefined ? cloneDate(data.dueDate) : task.dueDate,
      updatedAt: now(),
    });
    touchProject(task.projectId);
    return task;
  }
  await db.update(tasks).set(data).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  return getTask(id, userId);
}

export async function deleteTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const task = memory.tasks.find(item => item.id === id && item.userId === userId);
    if (!task) return;
    memory.tasks = memory.tasks.filter(item => !(item.id === id && item.userId === userId));
    touchProject(task.projectId);
    return;
  }
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}

export async function logActivity(data: {
  userId: number;
  projectId?: number;
  action: string;
  entityType: string;
  entityId?: number;
  details?: string;
}) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(data.userId);
    memory.activity.unshift({
      id: nextId("activity"),
      userId: data.userId,
      projectId: data.projectId ?? null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      details: data.details ?? null,
      createdAt: now(),
    });
    return;
  }
  await db.insert(activityLog).values(data);
}

export async function getActivityLog(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(userId);
    return [...memory.activity]
      .filter(entry => entry.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  return db.select().from(activityLog).where(eq(activityLog.userId, userId)).orderBy(desc(activityLog.createdAt)).limit(limit);
}

export async function createDocumentVersion(data: {
  documentId: number;
  fileId?: number;
  userId: number;
  content: string;
  versionNumber: number;
  changeDescription?: string;
}) {
  const db = await getDb();
  if (!db) {
    memory.versions.push({
      id: nextId("version"),
      documentId: data.documentId,
      fileId: data.fileId ?? null,
      userId: data.userId,
      content: data.content,
      versionNumber: data.versionNumber,
      changeDescription: data.changeDescription ?? null,
      createdAt: now(),
    });
    return;
  }
  await db.insert(documentVersions).values(data);
}

export async function getDocumentVersions(documentId: number) {
  const db = await getDb();
  if (!db) {
    return [...memory.versions]
      .filter(version => version.documentId === documentId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }
  return db.select().from(documentVersions).where(eq(documentVersions.documentId, documentId)).orderBy(desc(documentVersions.versionNumber));
}

export async function getUserNotifications(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(userId);
    return [...memory.notifications]
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function createNotification(data: {
  userId: number;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}) {
  const db = await getDb();
  if (!db) {
    memory.notifications.unshift({
      id: nextId("notification"),
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type ?? "info",
      isRead: false,
      link: data.link ?? null,
      createdAt: now(),
    });
    return;
  }
  await db.insert(notifications).values(data);
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const notification = memory.notifications.find(item => item.id === id && item.userId === userId);
    if (notification) notification.isRead = true;
    return;
  }
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) {
    memory.notifications.forEach(notification => {
      if (notification.userId === userId) notification.isRead = true;
    });
    return;
  }
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) {
    ensureMemorySeed(userId);
    const activeProjects = memory.projects.filter(
      project => project.userId === userId && project.status !== "deleted"
    );
    const fileCount = getProjectFilesForUser(userId).length;
    const userTasks = memory.tasks.filter(task => task.userId === userId);
    const pendingTasks = userTasks.filter(task => task.status !== "done").length;
    const userDocuments = memory.documents.filter(document => document.userId === userId);
    return {
      projectCount: activeProjects.length,
      fileCount,
      taskCount: userTasks.length,
      documentCount: userDocuments.length,
      pendingTasks,
    };
  }

  const [projectRows] = await db.select({ count: sql<number>`count(*)` }).from(projects).where(and(eq(projects.userId, userId), sql`${projects.status} != 'deleted'`));
  const projectIds = (await db.select({ id: projects.id }).from(projects).where(and(eq(projects.userId, userId), sql`${projects.status} != 'deleted'`))).map(r => r.id);
  let fileCount = 0;
  if (projectIds.length > 0) {
    const [fileRows] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectFiles)
      .where(sql`${projectFiles.projectId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`, `)})`);
    fileCount = fileRows?.count ?? 0;
  }
  const [taskRows] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.userId, userId));
  const [pendingRows] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(eq(tasks.userId, userId), sql`${tasks.status} != 'done'`));
  const [docRows] = await db.select({ count: sql<number>`count(*)` }).from(documents).where(eq(documents.userId, userId));
  return {
    projectCount: projectRows?.count ?? 0,
    fileCount,
    taskCount: taskRows?.count ?? 0,
    documentCount: docRows?.count ?? 0,
    pendingTasks: pendingRows?.count ?? 0,
  };
}
