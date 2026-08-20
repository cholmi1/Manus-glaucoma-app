import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { auditLogs } from "../drizzle/schema";
import { getDb } from "./db";

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

export function createAuditEntryHash(input: { previousHash: string | null; organizationId: number; actorUserId: string | null; patientId: number | null; action: string; targetType: string; targetId: string | null; detail: Record<string, unknown> }) {
  const payload = [input.previousHash ?? "GENESIS", input.organizationId, input.actorUserId ?? "", input.patientId ?? "", input.action, input.targetType, input.targetId ?? "", stableJson(input.detail)].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export async function appendAuditLog(input: {
  organizationId: number;
  actorUserId?: string | null;
  patientId?: number | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: Record<string, unknown>;
  ipHash?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("데이터베이스 연결을 사용할 수 없습니다.");
  const detail = input.detail ?? {};
  const previous = (await db.select({ entryHash: auditLogs.entryHash }).from(auditLogs).where(eq(auditLogs.organizationId, input.organizationId)).orderBy(desc(auditLogs.id)).limit(1))[0];
  const previousHash = previous?.entryHash ?? null;
  const entryHash = createAuditEntryHash({
    previousHash,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? null,
    patientId: input.patientId ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    detail,
  });
  await db.insert(auditLogs).values({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? null,
    patientId: input.patientId ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    detail,
    ipHash: input.ipHash ?? null,
    previousHash,
    entryHash,
  });
}
