import { describe, expect, it } from "vitest";
import postgres from "postgres";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.SUPABASE_DB_URL;
const bootstrapAdminEmail = process.env.SUPABASE_BOOTSTRAP_ADMIN_EMAIL;

describe("Supabase 연결 자격 증명", () => {
  it("공개 키와 서비스 역할 키로 최소 Auth API 요청을 인증한다", async () => {
    expect(supabaseUrl).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(publishableKey).toBeTruthy();
    expect(serviceRoleKey).toBeTruthy();
    expect(databaseUrl).toMatch(/^postgres(?:ql)?:\/\//);

    const settings = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: publishableKey! } });
    expect(settings.status).toBe(200);

    const users = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: { apikey: serviceRoleKey!, Authorization: `Bearer ${serviceRoleKey}` },
    });
    expect(users.status).toBe(200);
  }, 15_000);

  it("Transaction pooler 연결 문자열로 최소 PostgreSQL 요청을 인증한다", async () => {
    const sql = postgres(databaseUrl!, { prepare: false, ssl: "require", max: 1 });
    try {
      const result = await sql`select 1 as connected`;
      expect(result[0]?.connected).toBe(1);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }, 15_000);

  it("로그인한 Supabase Auth 사용자의 역할 프로필과 환자 프로필을 생성한다", async () => {
    const sql = postgres(databaseUrl!, { prepare: false, ssl: "require", max: 1 });
    try {
      const profiles = await sql`select id, organization_id, role, is_active from public.profiles order by created_at desc limit 1`;
      expect(profiles.length).toBeGreaterThan(0);
      expect(profiles[0]?.organization_id).toBeTruthy();
      expect(["patient", "physician", "educator", "admin"]).toContain(profiles[0]?.role);
      expect(profiles[0]?.is_active).toBe(true);

      const patients = await sql`select id from public.patients where user_id = ${profiles[0]?.id} limit 1`;
      expect(patients.length).toBe(1);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }, 15_000);

  it("입력한 초기 운영자 이메일이 Supabase 프로필과 일치한다", async () => {
    expect(bootstrapAdminEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    const sql = postgres(databaseUrl!, { prepare: false, ssl: "require", max: 1 });
    try {
      const profiles = await sql`select id, role from public.profiles where email = ${bootstrapAdminEmail} limit 1`;
      expect(profiles.length).toBe(1);
      expect(profiles[0]?.role).toBe("admin");
    } finally {
      await sql.end({ timeout: 5 });
    }
  }, 15_000);
});
