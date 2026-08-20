import postgres from "postgres";
import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { createContext } from "./_core/context";
import { appRouter } from "./routers";
import { getSupabaseAuthClient } from "./supabase";

const databaseUrl = process.env.SUPABASE_DB_URL;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TestRole = "physician" | "educator";

async function createTemporaryAuthUser(role: TestRole, password?: string) {
  const email = `rls-${role}-${crypto.randomUUID()}@example.com`;
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, email_confirm: true, ...(password ? { password } : {}) }),
  });
  const payload = await response.json() as { id?: string; message?: string };
  if (!response.ok || !payload.id) {
    throw new Error(`임시 ${role} Auth 사용자 생성 실패: ${payload.message ?? response.status}`);
  }
  return { id: payload.id, email };
}

async function deleteTemporaryAuthUser(userId: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`임시 Auth 사용자 삭제 실패: ${response.status}`);
  }
}

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

  it("physician은 같은 기관 환자에 접근하고 educator는 임상 환자 접근이 차단된다", async () => {
    expect(databaseUrl).toBeTruthy();
    expect(supabaseUrl).toBeTruthy();
    expect(serviceRoleKey).toBeTruthy();

    const sql = postgres(databaseUrl!, { prepare: false, ssl: "require", max: 1 });
    const temporaryUsers: Array<{ id: string; email: string }> = [];
    try {
      const targets = await sql`
        select p.id as patient_id, p.organization_id
        from public.patients p
        join public.profiles profile on profile.id = p.user_id
        where profile.role = 'patient' and profile.is_active = true
        order by p.created_at asc
        limit 1
      `;
      const target = targets[0];
      expect(target).toBeTruthy();

      const physician = await createTemporaryAuthUser("physician");
      const educator = await createTemporaryAuthUser("educator");
      temporaryUsers.push(physician, educator);

      await sql`
        insert into public.profiles (id, organization_id, name, email, role, is_active)
        values
          (${physician.id}, ${target!.organization_id}, 'RLS Test Physician', ${physician.email}, 'physician'::public.app_role, true),
          (${educator.id}, ${target!.organization_id}, 'RLS Test Educator', ${educator.email}, 'educator'::public.app_role, true)
      `;

      const physicianPatients = await asAuthenticated(physician.id, tx => tx`select id from public.patients`);
      expect(physicianPatients.map(row => row.id)).toContain(target!.patient_id);
      const physicianCanManage = await asAuthenticated(physician.id, tx => tx`select private.can_manage_clinical_data() as allowed`);
      expect(physicianCanManage[0]?.allowed).toBe(true);

      const educatorPatients = await asAuthenticated(educator.id, tx => tx`select id from public.patients`);
      expect(educatorPatients.map(row => row.id)).not.toContain(target!.patient_id);
      const educatorCanManage = await asAuthenticated(educator.id, tx => tx`select private.can_manage_clinical_data() as allowed`);
      expect(educatorCanManage[0]?.allowed).toBe(false);
    } finally {
      await sql.end({ timeout: 5 });
      await Promise.all(temporaryUsers.map(user => deleteTemporaryAuthUser(user.id)));
    }
  }, 45_000);

  it("새 Supabase 세션은 기본 patient 프로필·기관·환자 작업공간을 자동으로 만든다", async () => {
    expect(databaseUrl).toBeTruthy();
    expect(supabaseUrl).toBeTruthy();
    expect(serviceRoleKey).toBeTruthy();

    const password = `RlsTest!${crypto.randomUUID()}`;
    const temporaryUser = await createTemporaryAuthUser("educator", password);
    const sql = postgres(databaseUrl!, { prepare: false, ssl: "require", max: 1 });
    try {
      const { data, error } = await getSupabaseAuthClient().auth.signInWithPassword({
        email: temporaryUser.email,
        password,
      });
      expect(error).toBeNull();
      expect(data.session?.access_token).toBeTruthy();

      const context = await createContext({
        req: { headers: { authorization: `Bearer ${data.session!.access_token}` } } as Request,
        res: {} as Response,
      });
      expect(context.user).toMatchObject({ id: temporaryUser.id, role: "patient", isActive: true });
      expect(context.user?.organizationId).toBeTruthy();

      const caller = appRouter.createCaller(context);
      const workspace = await caller.auth.bootstrap();
      expect(workspace).toMatchObject({ role: "patient", organizationId: context.user!.organizationId });

      const patientRows = await sql`
        select id, organization_id, user_id
        from public.patients
        where user_id = ${temporaryUser.id}
        limit 1
      `;
      expect(patientRows).toHaveLength(1);
      expect(patientRows[0]?.organization_id).toBe(context.user!.organizationId);

      const patientScopedRows = await asAuthenticated(temporaryUser.id, tx => tx`select id from public.patients`);
      expect(patientScopedRows.map(row => row.id)).toEqual([patientRows[0]!.id]);
    } finally {
      await sql`delete from public.patients where user_id = ${temporaryUser.id}`;
      await sql`delete from public.profiles where id = ${temporaryUser.id}`;
      await sql.end({ timeout: 5 });
      await deleteTemporaryAuthUser(temporaryUser.id);
    }
  }, 45_000);
});
