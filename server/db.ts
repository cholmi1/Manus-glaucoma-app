import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, organizations, patients, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
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
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
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
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("데이터베이스 연결을 사용할 수 없습니다.");
  return db;
}

export async function ensureServiceWorkspace(userId: number) {
  const db = await requireDb();
  const existingOrg = (await db.select().from(organizations).limit(1))[0];
  let organization = existingOrg;
  if (!organization) {
    await db.insert(organizations).values({ name: "안압케어 의료기관" });
    organization = (await db.select().from(organizations).limit(1))[0];
  }
  if (!organization) throw new Error("기관 초기화에 실패했습니다.");

  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) throw new Error("사용자를 찾을 수 없습니다.");
  if (!user.organizationId) {
    await db.update(users).set({ organizationId: organization.id }).where(eq(users.id, userId));
  }
  if (user.role === "patient") {
    const patient = (await db.select().from(patients).where(and(eq(patients.organizationId, organization.id), eq(patients.userId, userId))).limit(1))[0];
    if (!patient) {
      await db.insert(patients).values({
        organizationId: organization.id,
        userId,
        publicId: `P-${String(userId).padStart(6, "0")}`,
      });
    }
  }
  return organization;
}

export async function getPatientForUser(userId: number, organizationId: number) {
  const db = await requireDb();
  return (await db.select().from(patients).where(and(eq(patients.userId, userId), eq(patients.organizationId, organizationId))).limit(1))[0];
}

export async function listOrganizationUsers(organizationId: number) {
  const db = await requireDb();
  return db.select().from(users).where(eq(users.organizationId, organizationId)).orderBy(desc(users.createdAt));
}
