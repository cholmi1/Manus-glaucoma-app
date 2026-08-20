import { and, desc, eq } from "drizzle-orm";
import { deviceAssignments, devices, notifications } from "../drizzle/schema";
import { appendAuditLog } from "./audit";
import { requireDb } from "./db";
import { rentalLevel } from "./routers/clinical";

export type RentalNotificationLevel = "d3" | "d1" | "d0" | "overdue" | "blocked";

export function rentalNotificationLevel(rentTo: string | null, now: string): RentalNotificationLevel | null {
  const level = rentalLevel(rentTo, now);
  return level === "d3" || level === "d1" || level === "d0" || level === "overdue" || level === "blocked" ? level : null;
}

export async function queueRentalNotifications(now = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date())) {
  const db = await requireDb();
  const assignments = await db.select({ assignment: deviceAssignments, organizationId: devices.organizationId }).from(deviceAssignments).innerJoin(devices, eq(deviceAssignments.deviceId, devices.id)).where(eq(deviceAssignments.kind, "rental")).orderBy(desc(deviceAssignments.createdAt));
  let queued = 0;
  let skipped = 0;
  for (const row of assignments) {
    const assignment = row.assignment;
    if (assignment.returnedAt || assignment.unlinkedAt) continue;
    const level = rentalNotificationLevel(assignment.rentTo, now);
    if (!level) continue;
    const idempotencyKey = `rental:${assignment.id}:${level}:${now}`;
    const existing = (await db.select({ id: notifications.id }).from(notifications).where(eq(notifications.idempotencyKey, idempotencyKey)).limit(1))[0];
    if (existing) {
      skipped += 1;
      continue;
    }
    const channel = "in_app" as const;
    await db.insert(notifications).values({
      organizationId: row.organizationId,
      patientId: assignment.patientId,
      deviceAssignmentId: assignment.id,
      category: "rental",
      level,
      channel,
      mode: "auto",
      status: "queued",
      idempotencyKey,
      detail: { rentTo: assignment.rentTo, stage: level, generatedOn: now },
      sentAt: new Date(),
    });
    await appendAuditLog({ organizationId: row.organizationId, patientId: assignment.patientId, action: "notification_queued", targetType: "rental_notification", targetId: idempotencyKey, detail: { assignmentId: assignment.id, level, channel } });
    queued += 1;
  }
  return { now, queued, skipped };
}
