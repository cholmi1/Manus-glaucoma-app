import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, organizations, patients, users } from "../drizzle/schema";

let client: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!db && process.env.SUPABASE_DB_URL) {
    try {
      // Supabase Transaction pooler is incompatible with prepared statements.
      client = postgres(process.env.SUPABASE_DB_URL, { prepare: false, max: 5, ssl: "require" });
      db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Supabase PostgreSQL 연결에 실패했습니다:", error);
      db = null;
    }
  }
  return db;
}

export async function requireDb() {
  const connection = await getDb();
  if (!connection) throw new Error("Supabase PostgreSQL 연결을 사용할 수 없습니다.");
  return connection;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) throw new Error("Supabase Auth 사용자 ID가 필요합니다.");
  const connection = await requireDb();
  await connection.insert(users).values(user).onConflictDoUpdate({
    target: users.id,
    set: {
      name: user.name ?? null,
      email: user.email ?? null,
      organizationId: user.organizationId ?? null,
      lastSignedIn: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function getUserById(id: string) {
  const connection = await requireDb();
  return (await connection.select().from(users).where(eq(users.id, id)).limit(1))[0];
}

export async function provisionSupabaseUser(input: { id: string; email?: string | null; name?: string | null }) {
  const existing = await getUserById(input.id);
  if (existing) {
    await upsertUser({ ...existing, name: input.name ?? existing.name, email: input.email ?? existing.email, lastSignedIn: new Date() });
    return (await getUserById(input.id))!;
  }
  const connection = await requireDb();
  let organization = (await connection.select().from(organizations).limit(1))[0];
  if (!organization) organization = (await connection.insert(organizations).values({ name: "안압케어 의료기관" }).returning())[0];
  if (!organization) throw new Error("기관 초기화에 실패했습니다.");
  const firstProfile = await connection.select({ id: users.id }).from(users).limit(1);
  await upsertUser({
    id: input.id,
    organizationId: organization.id,
    name: input.name ?? null,
    email: input.email ?? null,
    role: firstProfile.length === 0 ? "admin" : "patient",
  });
  return (await getUserById(input.id))!;
}

export async function ensureServiceWorkspace(userId: string) {
  const connection = await requireDb();
  const existingOrganization = (await connection.select().from(organizations).limit(1))[0];
  let organization = existingOrganization;
  if (!organization) {
    organization = (await connection.insert(organizations).values({ name: "안압케어 의료기관" }).returning())[0];
  }
  if (!organization) throw new Error("기관 초기화에 실패했습니다.");

  const user = await getUserById(userId);
  if (!user) throw new Error("Supabase Auth 사용자 프로필을 찾을 수 없습니다.");
  if (!user.organizationId) await connection.update(users).set({ organizationId: organization.id, updatedAt: new Date() }).where(eq(users.id, userId));
  if (user.role === "patient") {
    const patient = (await connection.select().from(patients).where(and(eq(patients.organizationId, organization.id), eq(patients.userId, userId))).limit(1))[0];
    if (!patient) await connection.insert(patients).values({ organizationId: organization.id, userId, publicId: `P-${userId.slice(0, 8).toUpperCase()}` });
  }
  return organization;
}

export async function getPatientForUser(userId: string, organizationId: number) {
  const connection = await requireDb();
  return (await connection.select().from(patients).where(and(eq(patients.userId, userId), eq(patients.organizationId, organizationId))).limit(1))[0];
}

export async function listOrganizationUsers(organizationId: number) {
  const connection = await requireDb();
  return connection.select().from(users).where(eq(users.organizationId, organizationId)).orderBy(desc(users.createdAt));
}

export async function closeDb() {
  if (client) await client.end({ timeout: 5 });
  client = null;
  db = null;
}
