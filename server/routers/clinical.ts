import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import {
  dashboardPreferences,
  deviceAssignments,
  devices,
  deviceStatusHistory,
  doseEvents,
  iopMeasurements,
  iopTargets,
  notifications,
  patients,
  prescriptions,
} from "../../drizzle/schema";
import { appendAuditLog } from "../audit";
import { ensureServiceWorkspace, getPatientForUser, requireDb } from "../db";
import { calculateAdherence, deduplicateByIdempotency } from "../domain";
import { clinicianProcedure, protectedProcedure, router } from "../_core/trpc";

const eyeSchema = z.enum(["OD", "OS"]);
const dateInput = z.coerce.date();

function forbidden(message = "요청한 환자 정보에 접근할 권한이 없습니다.") {
  return new TRPCError({ code: "FORBIDDEN", message });
}

async function resolveWorkspace(actorId: string) {
  return ensureServiceWorkspace(actorId);
}

async function assertPatientAccess(input: { actor: { id: string; role: string }; patientId: number; organizationId: number }) {
  const db = await requireDb();
  const patient = (await db.select().from(patients).where(and(eq(patients.id, input.patientId), eq(patients.organizationId, input.organizationId))).limit(1))[0];
  if (!patient) throw forbidden("현재 기관에 등록된 환자를 찾을 수 없습니다.");
  if (input.actor.role === "patient") {
    const ownPatient = await getPatientForUser(input.actor.id, input.organizationId);
    if (!ownPatient || ownPatient.id !== input.patientId) throw forbidden();
  } else if (input.actor.role !== "physician" && input.actor.role !== "admin") {
    throw forbidden("이 역할은 진료 기록에 접근할 수 없습니다.");
  }
  return patient;
}

async function currentPatientId(actor: { id: string; role: string }, organizationId: number) {
  if (actor.role !== "patient") return null;
  const patient = await getPatientForUser(actor.id, organizationId);
  if (!patient) throw forbidden("환자 프로필을 초기화한 뒤 다시 시도해 주세요.");
  return patient.id;
}

function todayKst() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function rentalLevel(rentTo: string | null, now = todayKst()) {
  if (!rentTo) return null;
  const diff = Math.round((Date.parse(`${rentTo}T00:00:00Z`) - Date.parse(`${now}T00:00:00Z`)) / 86_400_000);
  if (diff < -3) return "blocked" as const;
  if (diff < 0) return "overdue" as const;
  if (diff === 0) return "d0" as const;
  if (diff === 1) return "d1" as const;
  if (diff === 3) return "d3" as const;
  return null;
}

export const clinicalRouter = router({
  patient: router({
    home: protectedProcedure.query(async ({ ctx }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      const patientId = await currentPatientId(actor, organization.id);
      if (!patientId) throw forbidden("patient 역할에서만 환자 홈을 조회할 수 있습니다.");
      const db = await requireDb();
      const target = (await db.select().from(iopTargets).where(eq(iopTargets.patientId, patientId)).orderBy(desc(iopTargets.effectiveFrom)).limit(1))[0] ?? null;
      const measurements = await db.select().from(iopMeasurements).where(and(eq(iopMeasurements.patientId, patientId), eq(iopMeasurements.isExcluded, false))).orderBy(desc(iopMeasurements.measuredAt)).limit(2);
      const todayEvents = await db.select().from(doseEvents).where(and(eq(doseEvents.patientId, patientId), eq(doseEvents.scheduledDate, todayKst()))).orderBy(asc(doseEvents.scheduledTime));
      const activeAssignment = (await db.select().from(deviceAssignments).where(and(eq(deviceAssignments.patientId, patientId), eq(deviceAssignments.kind, "rental"))).orderBy(desc(deviceAssignments.createdAt)).limit(1))[0] ?? null;
      const rentLevel = activeAssignment && !activeAssignment.returnedAt ? rentalLevel(activeAssignment.rentTo) : null;
      const latest = new Map(measurements.map(item => [item.eye, Number(item.valueMmhg)]));
      const actions = [
        rentLevel ? { urgency: rentLevel === "blocked" || rentLevel === "overdue" ? "critical" : "warning", title: rentLevel === "blocked" ? "기기 수신이 중단되었습니다" : "대여 기기 반납 일정을 확인해 주세요", cta: "기기 상태 확인" } : null,
        target && (latest.get("OD") ?? 0) > Number(target.targetOd) ? { urgency: "critical", title: "목표 안압보다 높은 기록이 있습니다", cta: "측정 이력 확인" } : null,
        todayEvents.find(event => !event.taken) ? { urgency: "today", title: "오늘 예정된 점안이 남아 있습니다", cta: "점안 기록" } : null,
      ].filter(Boolean);
      await appendAuditLog({ organizationId: organization.id, actorUserId: actor.id, patientId, action: "view", targetType: "patient_home", targetId: String(patientId) });
      return { patientId, target, measurements, todayEvents, priorityAction: actions[0] ?? { urgency: "normal", title: "오늘의 관리가 완료되었습니다", cta: "측정 이력 보기" } };
    }),
  }),

  dashboard: router({
    riskQueue: clinicianProcedure.query(async ({ ctx }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      const db = await requireDb();
      const orgPatients = await db.select().from(patients).where(and(eq(patients.organizationId, organization.id), eq(patients.isActive, true))).limit(100);
      const queue = await Promise.all(orgPatients.map(async patient => {
        const [target, latestMeasurements, assignment, todayDoses] = await Promise.all([
          db.select().from(iopTargets).where(eq(iopTargets.patientId, patient.id)).orderBy(desc(iopTargets.effectiveFrom)).limit(1),
          db.select().from(iopMeasurements).where(and(eq(iopMeasurements.patientId, patient.id), eq(iopMeasurements.isExcluded, false))).orderBy(desc(iopMeasurements.measuredAt)).limit(2),
          db.select().from(deviceAssignments).where(and(eq(deviceAssignments.patientId, patient.id), eq(deviceAssignments.kind, "rental"))).orderBy(desc(deviceAssignments.createdAt)).limit(1),
          db.select().from(doseEvents).where(and(eq(doseEvents.patientId, patient.id), eq(doseEvents.scheduledDate, todayKst()))),
        ]);
        const rental = assignment[0] && !assignment[0].returnedAt ? rentalLevel(assignment[0].rentTo) : null;
        const targetValue = target[0] ?? null;
        const latest = latestMeasurements[0] ?? null;
        const iopOverTarget = latest && targetValue && ((latest.eye === "OD" && Number(latest.valueMmhg) > Number(targetValue.targetOd)) || (latest.eye === "OS" && Number(latest.valueMmhg) > Number(targetValue.targetOs)));
        const missedToday = todayDoses.some(dose => !dose.taken);
        const tier: "즉시 조치" | "오늘 예정" | "모니터링" = rental === "blocked" || rental === "overdue" || iopOverTarget ? "즉시 조치" : rental === "d0" || rental === "d1" || rental === "d3" || missedToday ? "오늘 예정" : "모니터링";
        const reason = rental ? `기기 ${rental}` : iopOverTarget ? "목표 안압 초과" : missedToday ? "오늘 예정 점안 미완료" : "최근 기록 모니터링";
        return { patientId: patient.id, publicId: patient.publicId, tier, reason, rentalLevel: rental, latestMeasurement: latest, target: targetValue, missedToday };
      }));
      const order = { "즉시 조치": 0, "오늘 예정": 1, "모니터링": 2 } as const;
      return queue.sort((a, b) => order[a.tier] - order[b.tier]);
    }),
    preferences: router({
      get: clinicianProcedure.query(async ({ ctx }) => {
        const actor = ctx.user!;
        const db = await requireDb();
        return (await db.select().from(dashboardPreferences).where(eq(dashboardPreferences.userId, actor.id)).limit(1))[0] ?? { patientColumns: ["patient", "risk", "latestIop", "target", "device"], patientFilters: { tier: "all" } };
      }),
      save: clinicianProcedure.input(z.object({ patientColumns: z.array(z.string().min(1)).min(1).max(8), patientFilters: z.record(z.string(), z.unknown()) })).mutation(async ({ ctx, input }) => {
        const actor = ctx.user!;
        const db = await requireDb();
        await db.insert(dashboardPreferences).values({ userId: actor.id, patientColumns: input.patientColumns, patientFilters: input.patientFilters }).onConflictDoUpdate({ target: dashboardPreferences.userId, set: { patientColumns: input.patientColumns, patientFilters: input.patientFilters, updatedAt: new Date() } });
        return { success: true } as const;
      }),
    }),
  }),

  measurements: router({
    upload: protectedProcedure.input(z.object({
      patientId: z.number().int().positive(),
      deviceId: z.number().int().positive().nullable().optional(),
      items: z.array(z.object({
        idempotencyKey: z.string().min(8).max(96),
        measuredAt: dateInput,
        eye: eyeSchema,
        valueMmhg: z.number().min(1).max(80),
        quality: z.enum(["excellent", "good", "retake"]).default("good"),
        source: z.enum(["auto", "manual", "offline_sync"]),
        context: z.string().max(48).optional(),
      })).min(1).max(100),
    })).mutation(async ({ ctx, input }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      await assertPatientAccess({ actor, patientId: input.patientId, organizationId: organization.id });
      const db = await requireDb();
      if (input.deviceId) {
        const assignment = (await db.select().from(deviceAssignments).where(and(eq(deviceAssignments.deviceId, input.deviceId), eq(deviceAssignments.patientId, input.patientId))).orderBy(desc(deviceAssignments.createdAt)).limit(1))[0];
        const level = assignment && !assignment.returnedAt && !assignment.unlinkedAt ? rentalLevel(assignment.rentTo) : null;
        if (level === "blocked") {
          await appendAuditLog({ organizationId: organization.id, actorUserId: actor.id, patientId: input.patientId, action: "measurement_rejected", targetType: "device", targetId: String(input.deviceId), detail: { reason: "rental_blocked" } });
          return { stored: 0, rejected: input.items.length, reason: "RENTAL_BLOCKED" as const };
        }
      }
      const uniqueItems = deduplicateByIdempotency(input.items);
      for (const item of uniqueItems) {
        await db.insert(iopMeasurements).values({
          organizationId: organization.id,
          patientId: input.patientId,
          deviceId: input.deviceId ?? null,
          idempotencyKey: item.idempotencyKey,
          measuredAt: item.measuredAt,
          eye: item.eye,
          valueMmhg: String(item.valueMmhg),
          quality: item.quality,
          source: item.source,
          context: item.context ?? null,
        }).onConflictDoNothing({ target: [iopMeasurements.patientId, iopMeasurements.idempotencyKey] });
      }
      await appendAuditLog({ organizationId: organization.id, actorUserId: actor.id, patientId: input.patientId, action: "measurement_upload", targetType: "iop_measurement", detail: { count: uniqueItems.length, duplicateCount: input.items.length - uniqueItems.length, source: uniqueItems[0]?.source } });
      return { stored: uniqueItems.length, rejected: 0, reason: null };
    }),
    list: protectedProcedure.input(z.object({ patientId: z.number().int().positive(), from: dateInput.optional(), to: dateInput.optional(), includeExcluded: z.boolean().optional().default(false) })).query(async ({ ctx, input }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      await assertPatientAccess({ actor, patientId: input.patientId, organizationId: organization.id });
      if (input.includeExcluded && actor.role !== "physician" && actor.role !== "admin") throw forbidden("제외 기록은 의료진만 조회할 수 있습니다.");
      const clauses = [eq(iopMeasurements.patientId, input.patientId)];
      if (!input.includeExcluded) clauses.push(eq(iopMeasurements.isExcluded, false));
      if (input.from) clauses.push(gte(iopMeasurements.measuredAt, input.from));
      if (input.to) clauses.push(lte(iopMeasurements.measuredAt, input.to));
      const db = await requireDb();
      const results = await db.select().from(iopMeasurements).where(and(...clauses)).orderBy(desc(iopMeasurements.measuredAt));
      await appendAuditLog({ organizationId: organization.id, actorUserId: actor.id, patientId: input.patientId, action: "view", targetType: "iop_measurement_list" });
      return results;
    }),
    exclude: clinicianProcedure.input(z.object({ measurementId: z.number().int().positive(), reason: z.string().min(3).max(240) })).mutation(async ({ ctx, input }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      const db = await requireDb();
      const measurement = (await db.select().from(iopMeasurements).where(eq(iopMeasurements.id, input.measurementId)).limit(1))[0];
      if (!measurement || measurement.organizationId !== organization.id) throw forbidden("현재 기관의 측정 기록을 찾을 수 없습니다.");
      await db.update(iopMeasurements).set({ isExcluded: true, excludedByUserId: actor.id, excludedAt: new Date() }).where(eq(iopMeasurements.id, input.measurementId));
      await appendAuditLog({ organizationId: organization.id, actorUserId: actor.id, patientId: measurement.patientId, action: "exclude", targetType: "iop_measurement", targetId: String(input.measurementId), detail: { reason: input.reason } });
      return { success: true } as const;
    }),
  }),

  doses: router({
    sync: protectedProcedure.input(z.object({ patientId: z.number().int().positive(), events: z.array(z.object({ prescriptionId: z.number().int().positive(), scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), scheduledTime: z.string().regex(/^\d{2}:\d{2}$/), eye: eyeSchema, taken: z.boolean(), takenAt: dateInput.nullable().optional(), source: z.enum(["manual", "device", "offline_sync"]), idempotencyKey: z.string().min(8).max(96) })).min(1).max(200) })).mutation(async ({ ctx, input }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      await assertPatientAccess({ actor, patientId: input.patientId, organizationId: organization.id });
      const db = await requireDb();
      const activePrescriptions = await db.select({ id: prescriptions.id }).from(prescriptions).where(and(eq(prescriptions.patientId, input.patientId), eq(prescriptions.organizationId, organization.id)));
      const allowed = new Set(activePrescriptions.map(item => item.id));
      const uniqueEvents = deduplicateByIdempotency(input.events);
      if (uniqueEvents.some(event => !allowed.has(event.prescriptionId))) throw forbidden("현재 환자의 처방에 속하지 않는 점안 이벤트가 포함되어 있습니다.");
      for (const event of uniqueEvents) {
        await db.insert(doseEvents).values({ organizationId: organization.id, patientId: input.patientId, prescriptionId: event.prescriptionId, scheduledDate: event.scheduledDate, scheduledTime: event.scheduledTime, eye: event.eye, taken: event.taken, takenAt: event.taken ? (event.takenAt ?? new Date()) : null, source: event.source, idempotencyKey: event.idempotencyKey }).onConflictDoUpdate({ target: [doseEvents.patientId, doseEvents.idempotencyKey], set: { taken: event.taken, takenAt: event.taken ? (event.takenAt ?? new Date()) : null, source: event.source, updatedAt: new Date() } });
      }
      await appendAuditLog({ organizationId: organization.id, actorUserId: actor.id, patientId: input.patientId, action: "dose_sync", targetType: "dose_event", detail: { count: uniqueEvents.length, duplicateCount: input.events.length - uniqueEvents.length } });
      return { synced: uniqueEvents.length };
    }),
    adherence: protectedProcedure.input(z.object({ patientId: z.number().int().positive(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(async ({ ctx, input }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      await assertPatientAccess({ actor, patientId: input.patientId, organizationId: organization.id });
      const db = await requireDb();
      const events = await db.select().from(doseEvents).where(and(eq(doseEvents.patientId, input.patientId), gte(doseEvents.scheduledDate, input.from), lte(doseEvents.scheduledDate, input.to)));
      return calculateAdherence(events);
    }),
  }),

  prescriptions: router({
    list: protectedProcedure.input(z.object({ patientId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      await assertPatientAccess({ actor, patientId: input.patientId, organizationId: organization.id });
      const db = await requireDb();
      return db.select().from(prescriptions).where(and(eq(prescriptions.patientId, input.patientId), eq(prescriptions.organizationId, organization.id))).orderBy(desc(prescriptions.createdAt));
    }),
    create: clinicianProcedure.input(z.object({ patientId: z.number().int().positive(), medicineName: z.string().min(1).max(120), ingredient: z.string().max(160).optional(), eye: z.enum(["OD", "OS", "both"]), scheduleTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(8), isPrn: z.boolean().default(false), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })).mutation(async ({ ctx, input }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      await assertPatientAccess({ actor, patientId: input.patientId, organizationId: organization.id });
      const db = await requireDb();
      const [created] = await db.insert(prescriptions).values({ organizationId: organization.id, patientId: input.patientId, medicineName: input.medicineName, ingredient: input.ingredient ?? null, eye: input.eye, scheduleTimes: input.scheduleTimes, isPrn: input.isPrn, startDate: input.startDate, endDate: input.endDate ?? null, prescribedByUserId: actor.id }).returning({ id: prescriptions.id });
      await appendAuditLog({ organizationId: organization.id, actorUserId: actor.id, patientId: input.patientId, action: "prescription_created", targetType: "prescription", targetId: String(created.id) });
      return { id: created.id };
    }),
  }),

  targets: router({
    latest: protectedProcedure.input(z.object({ patientId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      await assertPatientAccess({ actor, patientId: input.patientId, organizationId: organization.id });
      const db = await requireDb();
      return (await db.select().from(iopTargets).where(eq(iopTargets.patientId, input.patientId)).orderBy(desc(iopTargets.effectiveFrom)).limit(1))[0] ?? null;
    }),
    set: clinicianProcedure.input(z.object({ patientId: z.number().int().positive(), targetOd: z.number().min(1).max(80), targetOs: z.number().min(1).max(80), effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).mutation(async ({ ctx, input }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      await assertPatientAccess({ actor, patientId: input.patientId, organizationId: organization.id });
      const db = await requireDb();
      const [created] = await db.insert(iopTargets).values({ patientId: input.patientId, targetOd: String(input.targetOd), targetOs: String(input.targetOs), effectiveFrom: input.effectiveFrom, setByUserId: actor.id }).returning({ id: iopTargets.id });
      await appendAuditLog({ organizationId: organization.id, actorUserId: actor.id, patientId: input.patientId, action: "target_iop_set", targetType: "iop_target", targetId: String(created.id), detail: { targetOd: input.targetOd, targetOs: input.targetOs } });
      return { id: created.id };
    }),
  }),

  devices: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      const db = await requireDb();
      const ownPatient = await currentPatientId(actor, organization.id);
      const conditions = [eq(devices.organizationId, organization.id)];
      if (ownPatient) conditions.push(eq(deviceAssignments.patientId, ownPatient));
      const rows = await db.select({ assignment: deviceAssignments, device: devices }).from(deviceAssignments).innerJoin(devices, eq(deviceAssignments.deviceId, devices.id)).where(and(...conditions)).orderBy(desc(deviceAssignments.createdAt));
      return rows.map(row => ({ assignment: row.assignment, device: row.device, rentalLevel: row.assignment.kind === "rental" && !row.assignment.returnedAt ? rentalLevel(row.assignment.rentTo) : null }));
    }),
    updateStatus: clinicianProcedure.input(z.object({ deviceId: z.number().int().positive(), status: z.enum(["active", "maintenance", "inactive", "blocked"]), reason: z.string().max(240).optional() })).mutation(async ({ ctx, input }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      const db = await requireDb();
      const device = (await db.select().from(devices).where(and(eq(devices.id, input.deviceId), eq(devices.organizationId, organization.id))).limit(1))[0];
      if (!device) throw forbidden("현재 기관의 기기를 찾을 수 없습니다.");
      await db.update(devices).set({ status: input.status }).where(eq(devices.id, input.deviceId));
      await db.insert(deviceStatusHistory).values({ deviceId: input.deviceId, previousStatus: device.status, nextStatus: input.status, reason: input.reason ?? null, changedByUserId: actor.id });
      await appendAuditLog({ organizationId: organization.id, actorUserId: actor.id, action: "device_status_changed", targetType: "device", targetId: String(input.deviceId), detail: { previousStatus: device.status, nextStatus: input.status, reason: input.reason } });
      return { success: true } as const;
    }),
  }),

  notifications: router({
    mine: protectedProcedure.query(async ({ ctx }) => {
      const actor = ctx.user!;
      const organization = await resolveWorkspace(actor.id);
      const ownPatient = await currentPatientId(actor, organization.id);
      const db = await requireDb();
      const rows = await db.select().from(notifications).where(ownPatient ? eq(notifications.patientId, ownPatient) : eq(notifications.organizationId, organization.id)).orderBy(desc(notifications.createdAt)).limit(50);
      return rows;
    }),
  }),
});
