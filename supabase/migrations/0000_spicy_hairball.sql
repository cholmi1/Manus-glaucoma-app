CREATE TYPE "public"."app_role" AS ENUM('patient', 'physician', 'educator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."assignment_kind" AS ENUM('rental', 'owned');--> statement-breakpoint
CREATE TYPE "public"."device_ownership" AS ENUM('org', 'patient');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('active', 'maintenance', 'inactive', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."device_usage" AS ENUM('clinic', 'home');--> statement-breakpoint
CREATE TYPE "public"."dose_source" AS ENUM('manual', 'device', 'offline_sync');--> statement-breakpoint
CREATE TYPE "public"."eye" AS ENUM('OD', 'OS');--> statement-breakpoint
CREATE TYPE "public"."measurement_quality" AS ENUM('excellent', 'good', 'retake');--> statement-breakpoint
CREATE TYPE "public"."measurement_source" AS ENUM('auto', 'manual', 'offline_sync');--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM('rental', 'measurement', 'adherence');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'push', 'sms', 'call');--> statement-breakpoint
CREATE TYPE "public"."notification_level" AS ENUM('d3', 'd1', 'd0', 'overdue', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."notification_mode" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."prescription_eye" AS ENUM('OD', 'OS', 'both');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"actor_user_id" uuid,
	"patient_id" integer,
	"action" varchar(48) NOT NULL,
	"target_type" varchar(48) NOT NULL,
	"target_id" varchar(80),
	"detail" jsonb,
	"ip_hash" varchar(128),
	"previous_hash" varchar(64),
	"entry_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"patient_columns" jsonb NOT NULL,
	"patient_filters" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "device_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"kind" "assignment_kind" NOT NULL,
	"rent_from" varchar(10),
	"rent_to" varchar(10),
	"returned_at" timestamp with time zone,
	"linked_at" timestamp with time zone,
	"unlinked_at" timestamp with time zone,
	"assigned_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"previous_status" varchar(24),
	"next_status" varchar(24) NOT NULL,
	"reason" varchar(240),
	"changed_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"serial" varchar(40) NOT NULL,
	"name" varchar(96) NOT NULL,
	"model" varchar(40) DEFAULT 'CVT200' NOT NULL,
	"ownership" "device_ownership" NOT NULL,
	"usage" "device_usage" DEFAULT 'home' NOT NULL,
	"status" "device_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_serial_unique" UNIQUE("serial")
);
--> statement-breakpoint
CREATE TABLE "dose_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"prescription_id" integer NOT NULL,
	"scheduled_date" varchar(10) NOT NULL,
	"scheduled_time" varchar(5) NOT NULL,
	"eye" "eye" NOT NULL,
	"taken" boolean DEFAULT false NOT NULL,
	"taken_at" timestamp with time zone,
	"source" "dose_source" DEFAULT 'manual' NOT NULL,
	"idempotency_key" varchar(96) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iop_measurements" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"device_id" integer,
	"idempotency_key" varchar(96) NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"eye" "eye" NOT NULL,
	"value_mmhg" numeric(4, 1) NOT NULL,
	"quality" "measurement_quality" DEFAULT 'good' NOT NULL,
	"source" "measurement_source" NOT NULL,
	"context" varchar(48),
	"is_excluded" boolean DEFAULT false NOT NULL,
	"excluded_by_user_id" uuid,
	"excluded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iop_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"target_od" numeric(4, 1) NOT NULL,
	"target_os" numeric(4, 1) NOT NULL,
	"effective_from" varchar(10) NOT NULL,
	"set_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"device_assignment_id" integer,
	"category" "notification_category" NOT NULL,
	"level" "notification_level" NOT NULL,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"mode" "notification_mode" DEFAULT 'auto' NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"idempotency_key" varchar(140) NOT NULL,
	"detail" jsonb,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"country" varchar(2) DEFAULT 'KR' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Seoul' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" uuid,
	"public_id" varchar(24) NOT NULL,
	"chart_number" varchar(48),
	"diagnosis" varchar(160),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"medicine_name" varchar(120) NOT NULL,
	"ingredient" varchar(160),
	"eye" "prescription_eye" NOT NULL,
	"schedule_times" jsonb NOT NULL,
	"is_prn" boolean DEFAULT false NOT NULL,
	"start_date" varchar(10) NOT NULL,
	"end_date" varchar(10),
	"prescribed_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" integer,
	"name" text,
	"email" varchar(320),
	"role" "app_role" DEFAULT 'patient' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_signed_in" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_logs_patient_time_idx" ON "audit_logs" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_time_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "device_assignments_patient_idx" ON "device_assignments" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "device_assignments_device_idx" ON "device_assignments" USING btree ("device_id","returned_at","unlinked_at");--> statement-breakpoint
CREATE INDEX "device_history_device_idx" ON "device_status_history" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dose_events_schedule_uq" ON "dose_events" USING btree ("prescription_id","scheduled_date","scheduled_time","eye");--> statement-breakpoint
CREATE UNIQUE INDEX "dose_events_idempotency_uq" ON "dose_events" USING btree ("patient_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "dose_events_patient_date_idx" ON "dose_events" USING btree ("patient_id","scheduled_date");--> statement-breakpoint
CREATE UNIQUE INDEX "iop_measurements_idempotency_uq" ON "iop_measurements" USING btree ("patient_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "iop_measurements_patient_time_idx" ON "iop_measurements" USING btree ("patient_id","measured_at");--> statement-breakpoint
CREATE INDEX "iop_targets_patient_date_idx" ON "iop_targets" USING btree ("patient_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_org_user_uq" ON "patients" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "patients_org_active_idx" ON "patients" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "prescriptions_patient_idx" ON "prescriptions" USING btree ("patient_id","start_date");--> statement-breakpoint
CREATE INDEX "profiles_org_role_idx" ON "profiles" USING btree ("organization_id","role");