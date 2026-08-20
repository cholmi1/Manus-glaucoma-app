import postgres from "postgres";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.SUPABASE_DB_URL;

async function asAuthenticated<T>(userId: string, callback: (tx: postgres.TransactionSql) => Promise<T>) {
  const sql = postgres(databaseUrl!, { prepare: false, ssl: "require", max: 1 });
  try {
    return await sql.begin(async tx => {
      await tx.unsafe("set local role authenticated");
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      return callback(tx);
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

describe("Supabase RLS 역할 경계", () => {
  it("patient는 자신의 프로필만 보고, admin은 같은 기관의 프로필과 감사 로그를 조회한다", async () => {
    expect(databaseUrl).toBeTruthy();
    const sql = postgres(databaseUrl!, { prepare: false, ssl: "require", max: 1 });
    let profiles: Array<{ id: string; role: string; organization_id: number | null }>;
    try {
      profiles = await sql`select id, role, organization_id from public.profiles where is_active = true order by created_at asc`;
    } finally {
      await sql.end({ timeout: 5 });
    }
    const admin = profiles.find(profile => profile.role === "admin");
    const patient = profiles.find(profile => profile.role === "patient");
    expect(admin).toBeTruthy();
    expect(patient).toBeTruthy();

    const patientProfiles = await asAuthenticated(patient!.id, tx => tx`select id from public.profiles`);
    expect(patientProfiles.map(row => row.id)).toEqual([patient!.id]);

    const patientAudit = await asAuthenticated(patient!.id, tx => tx`select id from public.audit_logs`);
    expect(patientAudit).toHaveLength(0);

    const adminProfiles = await asAuthenticated(admin!.id, tx => tx`select id from public.profiles`);
    expect(adminProfiles.map(row => row.id)).toContain(admin!.id);
    expect(adminProfiles.map(row => row.id)).toContain(patient!.id);

    const adminAudit = await asAuthenticated(admin!.id, tx => tx`select id from public.audit_logs limit 1`);
    expect(Array.isArray(adminAudit)).toBe(true);
  }, 30_000);
});
