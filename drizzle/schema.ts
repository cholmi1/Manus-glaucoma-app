import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const appRoles = ["patient", "physician", "educator", "admin"] as const;
export const eyes = ["OD", "OS"] as const;

export const appRoleEnum = pgEnum("app_role", appRoles);
export const eyeEnum = pgEnum("eye", eyes);
export const deviceOwnershipEnum = pgEnum("device_ownership", ["org", "patient"]);
export const deviceUsageEnum = pgEnum("device_usage", ["clinic", "home"]);
export const deviceStatusEnum = pgEnum("device_status", ["active", "maintenance", "inactive", "blocked"]);
export const measurementQualityEnum = pgEnum("measurement_quality", ["excellent", "good", "retake"]);
export const measurementSourceEnum = pgEnum("measurement_source", ["auto", "manual", "offline_sync"]);
export const doseSourceEnum = pgEnum("dose_source", ["manual", "device", "offline_sync"]);
export const prescriptionEyeEnum = pgEnum("prescription_eye", ["OD", "OS", "both"]);
export const assignmentKindEnum = pgEnum("assignment_kind", ["rental", "owned"]);
export const notificationCategoryEnum = pgEnum("notification_category", ["rental", "measurement", "adherence"]);
export const notificationLevelEnum = pgEnum("notification_level", ["d3", "d1", "d0", "overdue", "blocked"]);
export const notificationChannelEnum = pgEnum("notification_channel", ["in_app", "push", "sms", "call"]);
export const notificationModeEnum = pgEnum("notification_mode", ["auto", "manual"]);
export const notificationStatusEnum = pgEnum("notification_status", ["queued", "sent", "failed", "skipped"]);

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  country: varchar("country", { length: 2 }).notNull().default("KR"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Seoul"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** `id` is the Supabase Auth user UUID (`auth.users.id`). */
export const users = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  organizationId: integer("organization_id"),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: appRoleEnum("role").notNull().default("patient"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("profiles_org_role_idx").on(table.organizationId, table.role)]);

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  userId: uuid("user_id"),
  publicId: varchar("public_id", { length: 24 }).notNull().unique(),
  chartNumber: varchar("chart_number", { length: 48 }),
  diagnosis: varchar("diagnosis", { length: 160 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("patients_org_user_uq").on(table.organizationId, table.userId), index("patients_org_active_idx").on(table.organizationId, table.isActive)]);

export const iopTargets = pgTable("iop_targets", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  targetOd: numeric("target_od", { precision: 4, scale: 1 }).notNull(),
  targetOs: numeric("target_os", { precision: 4, scale: 1 }).notNull(),
  effectiveFrom: varchar("effective_from", { length: 10 }).notNull(),
  setByUserId: uuid("set_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("iop_targets_patient_date_idx").on(table.patientId, table.effectiveFrom)]);

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  serial: varchar("serial", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 96 }).notNull(),
  model: varchar("model", { length: 40 }).notNull().default("CVT200"),
  ownership: deviceOwnershipEnum("ownership").notNull(),
  usage: deviceUsageEnum("usage").notNull().default("home"),
  status: deviceStatusEnum("status").notNull().default("active"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const deviceAssignments = pgTable("device_assignments", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull(),
  patientId: integer("patient_id").notNull(),
  kind: assignmentKindEnum("kind").notNull(),
  rentFrom: varchar("rent_from", { length: 10 }),
  rentTo: varchar("rent_to", { length: 10 }),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  linkedAt: timestamp("linked_at", { withTimezone: true }),
  unlinkedAt: timestamp("unlinked_at", { withTimezone: true }),
  assignedByUserId: uuid("assigned_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("device_assignments_patient_idx").on(table.patientId, table.createdAt), index("device_assignments_device_idx").on(table.deviceId, table.returnedAt, table.unlinkedAt)]);

export const deviceStatusHistory = pgTable("device_status_history", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull(),
  previousStatus: varchar("previous_status", { length: 24 }),
  nextStatus: varchar("next_status", { length: 24 }).notNull(),
  reason: varchar("reason", { length: 240 }),
  changedByUserId: uuid("changed_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("device_history_device_idx").on(table.deviceId, table.createdAt)]);

export const iopMeasurements = pgTable("iop_measurements", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  patientId: integer("patient_id").notNull(),
  deviceId: integer("device_id"),
  idempotencyKey: varchar("idempotency_key", { length: 96 }).notNull(),
  measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
  eye: eyeEnum("eye").notNull(),
  valueMmhg: numeric("value_mmhg", { precision: 4, scale: 1 }).notNull(),
  quality: measurementQualityEnum("quality").notNull().default("good"),
  source: measurementSourceEnum("source").notNull(),
  context: varchar("context", { length: 48 }),
  isExcluded: boolean("is_excluded").notNull().default(false),
  excludedByUserId: uuid("excluded_by_user_id"),
  excludedAt: timestamp("excluded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("iop_measurements_idempotency_uq").on(table.patientId, table.idempotencyKey), index("iop_measurements_patient_time_idx").on(table.patientId, table.measuredAt)]);

export const prescriptions = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  patientId: integer("patient_id").notNull(),
  medicineName: varchar("medicine_name", { length: 120 }).notNull(),
  ingredient: varchar("ingredient", { length: 160 }),
  eye: prescriptionEyeEnum("eye").notNull(),
  scheduleTimes: jsonb("schedule_times").$type<string[]>().notNull(),
  isPrn: boolean("is_prn").notNull().default(false),
  startDate: varchar("start_date", { length: 10 }).notNull(),
  endDate: varchar("end_date", { length: 10 }),
  prescribedByUserId: uuid("prescribed_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("prescriptions_patient_idx").on(table.patientId, table.startDate)]);

export const doseEvents = pgTable("dose_events", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  patientId: integer("patient_id").notNull(),
  prescriptionId: integer("prescription_id").notNull(),
  scheduledDate: varchar("scheduled_date", { length: 10 }).notNull(),
  scheduledTime: varchar("scheduled_time", { length: 5 }).notNull(),
  eye: eyeEnum("eye").notNull(),
  taken: boolean("taken").notNull().default(false),
  takenAt: timestamp("taken_at", { withTimezone: true }),
  source: doseSourceEnum("source").notNull().default("manual"),
  idempotencyKey: varchar("idempotency_key", { length: 96 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("dose_events_schedule_uq").on(table.prescriptionId, table.scheduledDate, table.scheduledTime, table.eye), uniqueIndex("dose_events_idempotency_uq").on(table.patientId, table.idempotencyKey), index("dose_events_patient_date_idx").on(table.patientId, table.scheduledDate)]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  patientId: integer("patient_id").notNull(),
  deviceAssignmentId: integer("device_assignment_id"),
  category: notificationCategoryEnum("category").notNull(),
  level: notificationLevelEnum("level").notNull(),
  channel: notificationChannelEnum("channel").notNull().default("in_app"),
  mode: notificationModeEnum("mode").notNull().default("auto"),
  status: notificationStatusEnum("status").notNull().default("queued"),
  idempotencyKey: varchar("idempotency_key", { length: 140 }).notNull().unique(),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  actorUserId: uuid("actor_user_id"),
  patientId: integer("patient_id"),
  action: varchar("action", { length: 48 }).notNull(),
  targetType: varchar("target_type", { length: 48 }).notNull(),
  targetId: varchar("target_id", { length: 80 }),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  ipHash: varchar("ip_hash", { length: 128 }),
  previousHash: varchar("previous_hash", { length: 64 }),
  entryHash: varchar("entry_hash", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("audit_logs_patient_time_idx").on(table.patientId, table.createdAt), index("audit_logs_actor_time_idx").on(table.actorUserId, table.createdAt)]);

export const dashboardPreferences = pgTable("dashboard_preferences", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  patientColumns: jsonb("patient_columns").$type<string[]>().notNull(),
  patientFilters: jsonb("patient_filters").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AppRole = (typeof appRoles)[number];
