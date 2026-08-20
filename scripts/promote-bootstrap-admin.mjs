import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DB_URL;
if (!databaseUrl) throw new Error("SUPABASE_DB_URL is required");
const adminEmail = process.env.SUPABASE_BOOTSTRAP_ADMIN_EMAIL;
if (!adminEmail) throw new Error("SUPABASE_BOOTSTRAP_ADMIN_EMAIL is required");

const sql = postgres(databaseUrl, { prepare: false, ssl: "require", max: 1 });
try {
  const profiles = await sql`select id, role from public.profiles where email = ${adminEmail} limit 1`;
  if (profiles.length === 0) {
    console.log("Skipped: sign in with the selected email once before promoting it.");
  } else if (profiles[0].role === "patient") {
    await sql`update public.profiles set role = 'admin', updated_at = now() where id = ${profiles[0].id}`;
    console.log("Promoted the selected bootstrap profile to admin.");
  } else {
    console.log("Skipped: bootstrap profile already has an administrative role.");
  }
} finally {
  await sql.end({ timeout: 5 });
}
