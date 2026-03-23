import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, userPreferences, projects, projectFiles,
  documents, tasks, activityLog, documentVersions, notifications
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

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
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
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
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ---- User Preferences ----
export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertUserPreferences(userId: number, prefs: Partial<typeof userPreferences.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  const existing = await getUserPreferences(userId);
  if (existing) {
    await db.update(userPreferences).set(prefs).where(eq(userPreferences.userId, userId));
  } else {
    await db.insert(userPreferences).values({ userId, ...prefs });
  }
  return getUserPreferences(userId);
}

// ---- Projects ----
export async function getProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(and(eq(projects.userId, userId), sql`${projects.status} != 'deleted'`)).orderBy(desc(projects.updatedAt));
}

export async function getProject(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function createProject(data: { userId: number; name: string; description?: string; language?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(projects).values(data);
  return getProject(result[0].insertId, data.userId);
}

export async function updateProject(id: number, userId: number, data: Partial<{ name: string; description: string; language: string; status: "active" | "archived" | "deleted" }>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(projects).set(data).where(and(eq(projects.id, id), eq(projects.userId, userId)));
  return getProject(id, userId);
}

// ---- Project Files ----
export async function getProjectFiles(projectId: number, parentId: number | null) {
  const db = await getDb();
  if (!db) return [];
  const condition = parentId === null
    ? and(eq(projectFiles.projectId, projectId), isNull(projectFiles.parentId))
    : and(eq(projectFiles.projectId, projectId), eq(projectFiles.parentId, parentId));
  return db.select().from(projectFiles).where(condition).orderBy(desc(projectFiles.type), asc(projectFiles.name));
}

export async function getFileById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(projectFiles).where(eq(projectFiles.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createFile(data: { projectId: number; parentId?: number | null; name: string; type: "file" | "folder"; content?: string; language?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(projectFiles).values({ ...data, parentId: data.parentId ?? null });
  return getFileById(result[0].insertId);
}

export async function updateFile(id: number, data: Partial<{ name: string; content: string; s3Url: string; s3Key: string }>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(projectFiles).set(data).where(eq(projectFiles.id, id));
  return getFileById(id);
}

export async function deleteFile(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectFiles).where(eq(projectFiles.id, id));
}

// ---- Documents ----
export async function getDocuments(userId: number, projectId?: number) {
  const db = await getDb();
  if (!db) return [];
  const condition = projectId
    ? and(eq(documents.userId, userId), eq(documents.projectId, projectId))
    : eq(documents.userId, userId);
  return db.select().from(documents).where(condition).orderBy(desc(documents.updatedAt));
}

export async function getDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function createDocument(data: { userId: number; projectId?: number; title: string; content?: string; type?: "note" | "documentation" | "generated" }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(documents).values(data);
  return getDocument(result[0].insertId, data.userId);
}

export async function updateDocument(id: number, userId: number, data: Partial<{ title: string; content: string }>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(documents).set(data).where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return getDocument(id, userId);
}

export async function deleteDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
}

// ---- Tasks ----
export async function getTasks(userId: number, projectId?: number) {
  const db = await getDb();
  if (!db) return [];
  const condition = projectId
    ? and(eq(tasks.userId, userId), eq(tasks.projectId, projectId))
    : eq(tasks.userId, userId);
  return db.select().from(tasks).where(condition).orderBy(asc(tasks.sortOrder), desc(tasks.createdAt));
}

export async function getTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function createTask(data: { userId: number; projectId?: number; title: string; description?: string; status?: "backlog" | "todo" | "in_progress" | "review" | "done"; priority?: "low" | "medium" | "high" | "urgent" }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(tasks).values(data);
  return getTask(result[0].insertId, data.userId);
}

export async function updateTask(id: number, userId: number, data: Partial<{ title: string; description: string; status: "backlog" | "todo" | "in_progress" | "review" | "done"; priority: "low" | "medium" | "high" | "urgent"; sortOrder: number; dueDate: Date | null }>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(tasks).set(data).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  return getTask(id, userId);
}

export async function deleteTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}

// ---- Activity Log ----
export async function logActivity(data: { userId: number; projectId?: number; action: string; entityType: string; entityId?: number; details?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values(data);
}

export async function getActivityLog(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLog).where(eq(activityLog.userId, userId)).orderBy(desc(activityLog.createdAt)).limit(limit);
}

// ---- Document Versions ----
export async function createDocumentVersion(data: { documentId: number; fileId?: number; userId: number; content: string; versionNumber: number; changeDescription?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(documentVersions).values(data);
}

export async function getDocumentVersions(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentVersions).where(eq(documentVersions.documentId, documentId)).orderBy(desc(documentVersions.versionNumber));
}

// ---- Notifications ----
export async function getUserNotifications(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function createNotification(data: { userId: number; title: string; message: string; type?: "info" | "warning" | "success" | "error"; link?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

// ---- Dashboard Stats ----
export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return { projectCount: 0, fileCount: 0, taskCount: 0, documentCount: 0, pendingTasks: 0 };
  const [projectRows] = await db.select({ count: sql<number>`count(*)` }).from(projects).where(and(eq(projects.userId, userId), sql`${projects.status} != 'deleted'`));
  const projectIds = (await db.select({ id: projects.id }).from(projects).where(and(eq(projects.userId, userId), sql`${projects.status} != 'deleted'`))).map(r => r.id);
  let fileCount = 0;
  if (projectIds.length > 0) {
    const [fileRows] = await db.select({ count: sql<number>`count(*)` }).from(projectFiles).where(sql`${projectFiles.projectId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`, `)})`);
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
