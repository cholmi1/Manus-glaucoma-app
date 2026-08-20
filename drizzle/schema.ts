import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
  text,
} from "drizzle-orm/mysql-core";

export const appRoles = ["patient", "physician", "educator", "admin"] as const;
export const eyes = ["OD", "OS"] as const;

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  country: varchar("country", { length: 2 }).notNull().default("KR"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Seoul"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  organizationId: int("organizationId"),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", appRoles).default("patient").notNull(),
  isActive: boolean("isActive").notNull().default(true),
  failedLoginCount: int("failedLoginCount").notNull().default(0),
  lockedUntil: timestamp("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, table => [index("users_org_role_idx").on(table.organizationId, table.role)]);

export const patients = mysqlTable("patients", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId"),
  publicId: varchar("publicId", { length: 24 }).notNull().unique(),
  chartNumber: varchar("chartNumber", { length: 48 }),
  diagnosis: varchar("diagnosis", { length: 160 }),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("patients_org_user_uq").on(table.organizationId, table.userId),
  index("patients_org_active_idx").on(table.organizationId, table.isActive),
]);

export const iopTargets = mysqlTable("iopTargets", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  targetOd: decimal("targetOd", { precision: 4, scale: 1 }).notNull(),
  targetOs: decimal("targetOs", { precision: 4, scale: 1 }).notNull(),
  effectiveFrom: varchar("effectiveFrom", { length: 10 }).notNull(),
  setByUserId: int("setByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("iop_targets_patient_date_idx").on(table.patientId, table.effectiveFrom)]);

export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  serial: varchar("serial", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 96 }).notNull(),
  model: varchar("model", { length: 40 }).notNull().default("CVT200"),
  ownership: mysqlEnum("ownership", ["org", "patient"]).notNull(),
  usage: mysqlEnum("usage", ["clinic", "home"]).notNull().default("home"),
  status: mysqlEnum("status", ["active", "maintenance", "inactive", "blocked"]).notNull().default("active"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const deviceAssignments = mysqlTable("deviceAssignments", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  patientId: int("patientId").notNull(),
  kind: mysqlEnum("kind", ["rental", "owned"]).notNull(),
  rentFrom: varchar("rentFrom", { length: 10 }),
  rentTo: varchar("rentTo", { length: 10 }),
  returnedAt: timestamp("returnedAt"),
  linkedAt: timestamp("linkedAt"),
  unlinkedAt: timestamp("unlinkedAt"),
  assignedByUserId: int("assignedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("device_assignments_patient_idx").on(table.patientId, table.createdAt),
  index("device_assignments_device_idx").on(table.deviceId, table.returnedAt, table.unlinkedAt),
]);

export const deviceStatusHistory = mysqlTable("deviceStatusHistory", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  previousStatus: varchar("previousStatus", { length: 24 }),
  nextStatus: varchar("nextStatus", { length: 24 }).notNull(),
  reason: varchar("reason", { length: 240 }),
  changedByUserId: int("changedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("device_history_device_idx").on(table.deviceId, table.createdAt)]);

export const iopMeasurements = mysqlTable("iopMeasurements", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  patientId: int("patientId").notNull(),
  deviceId: int("deviceId"),
  idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull(),
  measuredAt: timestamp("measuredAt").notNull(),
  eye: mysqlEnum("eye", eyes).notNull(),
  valueMmhg: decimal("valueMmhg", { precision: 4, scale: 1 }).notNull(),
  quality: mysqlEnum("quality", ["excellent", "good", "retake"]).notNull().default("good"),
  source: mysqlEnum("source", ["auto", "manual", "offline_sync"]).notNull(),
  context: varchar("context", { length: 48 }),
  isExcluded: boolean("isExcluded").notNull().default(false),
  excludedByUserId: int("excludedByUserId"),
  excludedAt: timestamp("excludedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("iop_measurements_idempotency_uq").on(table.patientId, table.idempotencyKey),
  index("iop_measurements_patient_time_idx").on(table.patientId, table.measuredAt),
]);

export const prescriptions = mysqlTable("prescriptions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  patientId: int("patientId").notNull(),
  medicineName: varchar("medicineName", { length: 120 }).notNull(),
  ingredient: varchar("ingredient", { length: 160 }),
  eye: mysqlEnum("eye", ["OD", "OS", "both"]).notNull(),
  scheduleTimes: json("scheduleTimes").$type<string[]>().notNull(),
  isPrn: boolean("isPrn").notNull().default(false),
  startDate: varchar("startDate", { length: 10 }).notNull(),
  endDate: varchar("endDate", { length: 10 }),
  prescribedByUserId: int("prescribedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("prescriptions_patient_idx").on(table.patientId, table.startDate)]);

export const doseEvents = mysqlTable("doseEvents", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  patientId: int("patientId").notNull(),
  prescriptionId: int("prescriptionId").notNull(),
  scheduledDate: varchar("scheduledDate", { length: 10 }).notNull(),
  scheduledTime: varchar("scheduledTime", { length: 5 }).notNull(),
  eye: mysqlEnum("eye", eyes).notNull(),
  taken: boolean("taken").notNull().default(false),
  takenAt: timestamp("takenAt"),
  source: mysqlEnum("source", ["manual", "device", "offline_sync"]).notNull().default("manual"),
  idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("dose_events_schedule_uq").on(table.prescriptionId, table.scheduledDate, table.scheduledTime, table.eye),
  uniqueIndex("dose_events_idempotency_uq").on(table.patientId, table.idempotencyKey),
  index("dose_events_patient_date_idx").on(table.patientId, table.scheduledDate),
]);

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  patientId: int("patientId").notNull(),
  deviceAssignmentId: int("deviceAssignmentId"),
  category: mysqlEnum("category", ["rental", "measurement", "adherence"]).notNull(),
  level: mysqlEnum("level", ["d3", "d1", "d0", "overdue", "blocked"]).notNull(),
  channel: mysqlEnum("channel", ["in_app", "push", "sms", "call"]).notNull().default("in_app"),
  mode: mysqlEnum("mode", ["auto", "manual"]).notNull().default("auto"),
  status: mysqlEnum("status", ["queued", "sent", "failed", "skipped"]).notNull().default("queued"),
  idempotencyKey: varchar("idempotencyKey", { length: 140 }).notNull().unique(),
  detail: json("detail").$type<Record<string, unknown>>(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  actorUserId: int("actorUserId"),
  patientId: int("patientId"),
  action: varchar("action", { length: 48 }).notNull(),
  targetType: varchar("targetType", { length: 48 }).notNull(),
  targetId: varchar("targetId", { length: 80 }),
  detail: json("detail").$type<Record<string, unknown>>(),
  ipHash: varchar("ipHash", { length: 128 }),
  previousHash: varchar("previousHash", { length: 64 }),
  entryHash: varchar("entryHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("audit_logs_patient_time_idx").on(table.patientId, table.createdAt), index("audit_logs_actor_time_idx").on(table.actorUserId, table.createdAt)]);

export const dashboardPreferences = mysqlTable("dashboardPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  patientColumns: json("patientColumns").$type<string[]>().notNull(),
  patientFilters: json("patientFilters").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AppRole = (typeof appRoles)[number];
