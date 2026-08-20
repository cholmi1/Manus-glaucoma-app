CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`actorUserId` int,
	`patientId` int,
	`action` varchar(48) NOT NULL,
	`targetType` varchar(48) NOT NULL,
	`targetId` varchar(80),
	`detail` json,
	`ipHash` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dashboardPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`patientColumns` json NOT NULL,
	`patientFilters` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dashboardPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboardPreferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `deviceAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`patientId` int NOT NULL,
	`kind` enum('rental','owned') NOT NULL,
	`rentFrom` varchar(10),
	`rentTo` varchar(10),
	`returnedAt` timestamp,
	`linkedAt` timestamp,
	`unlinkedAt` timestamp,
	`assignedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deviceAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deviceStatusHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`previousStatus` varchar(24),
	`nextStatus` varchar(24) NOT NULL,
	`reason` varchar(240),
	`changedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deviceStatusHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`serial` varchar(40) NOT NULL,
	`name` varchar(96) NOT NULL,
	`model` varchar(40) NOT NULL DEFAULT 'CVT200',
	`ownership` enum('org','patient') NOT NULL,
	`usage` enum('clinic','home') NOT NULL DEFAULT 'home',
	`status` enum('active','maintenance','inactive','blocked') NOT NULL DEFAULT 'active',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `devices_serial_unique` UNIQUE(`serial`)
);
--> statement-breakpoint
CREATE TABLE `doseEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`patientId` int NOT NULL,
	`prescriptionId` int NOT NULL,
	`scheduledDate` varchar(10) NOT NULL,
	`scheduledTime` varchar(5) NOT NULL,
	`eye` enum('OD','OS') NOT NULL,
	`taken` boolean NOT NULL DEFAULT false,
	`takenAt` timestamp,
	`source` enum('manual','device','offline_sync') NOT NULL DEFAULT 'manual',
	`idempotencyKey` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `doseEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `dose_events_schedule_uq` UNIQUE(`prescriptionId`,`scheduledDate`,`scheduledTime`,`eye`),
	CONSTRAINT `dose_events_idempotency_uq` UNIQUE(`patientId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `iopMeasurements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`patientId` int NOT NULL,
	`deviceId` int,
	`idempotencyKey` varchar(96) NOT NULL,
	`measuredAt` timestamp NOT NULL,
	`eye` enum('OD','OS') NOT NULL,
	`valueMmhg` decimal(4,1) NOT NULL,
	`quality` enum('excellent','good','retake') NOT NULL DEFAULT 'good',
	`source` enum('auto','manual','offline_sync') NOT NULL,
	`context` varchar(48),
	`isExcluded` boolean NOT NULL DEFAULT false,
	`excludedByUserId` int,
	`excludedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `iopMeasurements_id` PRIMARY KEY(`id`),
	CONSTRAINT `iop_measurements_idempotency_uq` UNIQUE(`patientId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `iopTargets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`targetOd` decimal(4,1) NOT NULL,
	`targetOs` decimal(4,1) NOT NULL,
	`effectiveFrom` varchar(10) NOT NULL,
	`setByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `iopTargets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`patientId` int NOT NULL,
	`deviceAssignmentId` int,
	`category` enum('rental','measurement','adherence') NOT NULL,
	`level` enum('d3','d1','d0','overdue','blocked') NOT NULL,
	`channel` enum('in_app','push','sms','call') NOT NULL DEFAULT 'in_app',
	`mode` enum('auto','manual') NOT NULL DEFAULT 'auto',
	`status` enum('queued','sent','failed','skipped') NOT NULL DEFAULT 'queued',
	`idempotencyKey` varchar(140) NOT NULL,
	`detail` json,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `notifications_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`country` varchar(2) NOT NULL DEFAULT 'KR',
	`timezone` varchar(64) NOT NULL DEFAULT 'Asia/Seoul',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int,
	`publicId` varchar(24) NOT NULL,
	`chartNumber` varchar(48),
	`diagnosis` varchar(160),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patients_id` PRIMARY KEY(`id`),
	CONSTRAINT `patients_publicId_unique` UNIQUE(`publicId`),
	CONSTRAINT `patients_org_user_uq` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `prescriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`patientId` int NOT NULL,
	`medicineName` varchar(120) NOT NULL,
	`ingredient` varchar(160),
	`eye` enum('OD','OS','both') NOT NULL,
	`scheduleTimes` json NOT NULL,
	`isPrn` boolean NOT NULL DEFAULT false,
	`startDate` varchar(10) NOT NULL,
	`endDate` varchar(10),
	`prescribedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prescriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('patient','physician','educator','admin') NOT NULL DEFAULT 'patient';--> statement-breakpoint
ALTER TABLE `users` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `failedLoginCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lockedUntil` timestamp;--> statement-breakpoint
CREATE INDEX `audit_logs_patient_time_idx` ON `auditLogs` (`patientId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_time_idx` ON `auditLogs` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `device_assignments_patient_idx` ON `deviceAssignments` (`patientId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `device_assignments_device_idx` ON `deviceAssignments` (`deviceId`,`returnedAt`,`unlinkedAt`);--> statement-breakpoint
CREATE INDEX `device_history_device_idx` ON `deviceStatusHistory` (`deviceId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `dose_events_patient_date_idx` ON `doseEvents` (`patientId`,`scheduledDate`);--> statement-breakpoint
CREATE INDEX `iop_measurements_patient_time_idx` ON `iopMeasurements` (`patientId`,`measuredAt`);--> statement-breakpoint
CREATE INDEX `iop_targets_patient_date_idx` ON `iopTargets` (`patientId`,`effectiveFrom`);--> statement-breakpoint
CREATE INDEX `patients_org_active_idx` ON `patients` (`organizationId`,`isActive`);--> statement-breakpoint
CREATE INDEX `prescriptions_patient_idx` ON `prescriptions` (`patientId`,`startDate`);--> statement-breakpoint
CREATE INDEX `users_org_role_idx` ON `users` (`organizationId`,`role`);