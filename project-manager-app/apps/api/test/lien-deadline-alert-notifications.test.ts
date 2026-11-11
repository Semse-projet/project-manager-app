import test from "node:test";
import assert from "node:assert/strict";
import { LienAlertsScheduler } from "../dist/modules/liens/lien-alerts.scheduler.js";
import { LiensService } from "../dist/modules/liens/liens.service.js";
import { NotificationsService } from "../dist/modules/notifications/notifications.service.js";

// m2.1-lien-rights, decisión D-LIEN (dueño, 2026-11-11): la alerta de plazo de lien llega a TODOS los miembros
// ACTIVOS con rol PRO de la organización asignada al proyecto, por notificación (in-app/push) y email.

const DAY = 24 * 60 * 60 * 1000;

function makeHarness(opts: {
  status?: string;
  days?: number;
  members?: Array<{ userId: string; email: string | null }>;
  emailFails?: boolean;
  membershipThrows?: boolean;
} = {}) {
  const calendar: Record<string, unknown> = {
    id: "cal_1",
    status: opts.status ?? "CREATED",
    stateName: "Florida",
    preliminaryNoticeDeadline: new Date(Date.now() + (opts.days ?? 25) * DAY),
    project: { id: "proj_1", tenantId: "tenant_1", assignedProOrgId: "org_pro", job: { title: "Kitchen <Remodel>" } },
  };
  const membershipQueries: unknown[] = [];
  const notifications: Array<Record<string, any>> = [];
  const emails: Array<Record<string, string>> = [];
  const generated: string[] = [];
  const prisma = {
    lienCalendar: {
      async findMany() { return [calendar]; },
      async findUniqueOrThrow() { return calendar; },
      async update({ data }: { data: { status: string } }) { calendar.status = data.status; return calendar; },
    },
    membership: {
      async findMany({ where }: { where: unknown }) {
        membershipQueries.push(where);
        if (opts.membershipThrows) throw new Error("db down");
        return (opts.members ?? [
          { userId: "pro_1", email: "pro1@example.com" },
          { userId: "pro_2", email: "pro2@example.com" },
        ]).map((m) => ({ userId: m.userId, user: { email: m.email } }));
      },
    },
  };
  const notificationsService = new NotificationsService({
    async create(input: Record<string, unknown>) { notifications.push(input); return { id: `n_${notifications.length}` }; },
  } as never);
  const email = {
    async send(input: Record<string, string>) { emails.push(input); return opts.emailFails ? { sent: false, error: "x" } : { sent: true }; },
  };
  const scheduler = new LienAlertsScheduler(
    prisma as never,
    new LiensService(prisma as never, {} as never),
    { async generateAllNoticesForCalendar(id: string) { generated.push(id); return []; } } as never,
    notificationsService,
    email as never,
  );
  return { scheduler, calendar, membershipQueries, notifications, emails, generated };
}

test("D-LIEN: la transición a 30 días avisa a cada miembro PRO activo de la org asignada (notificación + email)", async () => {
  const h = makeHarness();
  await h.scheduler.checkAndAlertDeadlines();

  assert.equal(h.calendar.status, "ALERTED_30D");
  assert.deepEqual(h.membershipQueries, [{
    orgId: "org_pro",
    status: "ACTIVE",
    role: { key: "PRO" },
    org: { tenantId: "tenant_1" },
    user: { status: "active" },
  }], "solo miembros ACTIVOS con rol PRO, de la org asignada y dentro del tenant del proyecto");
  assert.deepEqual(h.notifications.map((n) => [n.tenantId, n.userId, n.type]), [
    ["tenant_1", "pro_1", "lien_deadline_alert"],
    ["tenant_1", "pro_2", "lien_deadline_alert"],
  ]);
  assert.equal(h.notifications[0]!.payload.status, "ALERTED_30D");
  assert.equal(h.notifications[0]!.payload.lienCalendarId, "cal_1");
  assert.match(h.notifications[0]!.title, /Plazo de lien en 25 día/);
  assert.deepEqual(h.emails.map((e) => e.to), ["pro1@example.com", "pro2@example.com"]);
  assert.ok(h.emails[0]!.html.includes("Kitchen &lt;Remodel&gt;"), "el título del proyecto va escapado en el HTML");
});

test("D-LIEN: a 3 días es el último aviso y se generan los notices", async () => {
  const h = makeHarness({ status: "ALERTED_7D", days: 3 });
  await h.scheduler.checkAndAlertDeadlines();
  assert.equal(h.calendar.status, "ALERTED_3D");
  assert.deepEqual(h.generated, ["cal_1"]);
  assert.match(h.notifications[0]!.title, /Último aviso/);
  assert.match(h.notifications[0]!.body, /avisos ya se generaron/);
});

test("D-LIEN: sin transición no hay aviso; un mismo usuario con dos membresías recibe uno solo", async () => {
  const quiet = makeHarness({ days: 45 });
  await quiet.scheduler.checkAndAlertDeadlines();
  assert.equal(quiet.notifications.length, 0);
  assert.equal(quiet.emails.length, 0);

  const dup = makeHarness({ members: [{ userId: "pro_1", email: "p@example.com" }, { userId: "pro_1", email: "p@example.com" }] });
  await dup.scheduler.checkAndAlertDeadlines();
  assert.equal(dup.notifications.length, 1);
  assert.equal(dup.emails.length, 1);
});

test("D-LIEN: sin destinatarios o con fallo de envío, la transición se mantiene y el job no falla", async () => {
  const none = makeHarness({ members: [] });
  await none.scheduler.checkAndAlertDeadlines();
  assert.equal(none.calendar.status, "ALERTED_30D");
  assert.equal(none.notifications.length, 0);

  const broken = makeHarness({ membershipThrows: true });
  await broken.scheduler.checkAndAlertDeadlines();
  assert.equal(broken.calendar.status, "ALERTED_30D");

  const noEmail = makeHarness({ emailFails: true, members: [{ userId: "pro_1", email: null }, { userId: "pro_2", email: "p2@example.com" }] });
  await noEmail.scheduler.checkAndAlertDeadlines();
  assert.equal(noEmail.notifications.length, 2, "la notificación in-app no depende del email");
  assert.deepEqual(noEmail.emails.map((e) => e.to), ["p2@example.com"]);
});
