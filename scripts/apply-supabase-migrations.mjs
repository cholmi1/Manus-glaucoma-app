import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DB_URL;
if (!databaseUrl) throw new Error("SUPABASE_DB_URL is required");

const sql = postgres(databaseUrl, { prepare: false, ssl: "require", max: 1 });
const directory = path.resolve("supabase/migrations");

try {
  await sql`create table if not exists public.app_schema_migrations (filename text primary key, checksum text not null, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql`select filename from public.app_schema_migrations`).map(row => row.filename));
  const files = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const content = (await readFile(path.join(directory, file), "utf8")).replaceAll("--> statement-breakpoint", "");
    const checksum = createHash("sha256").update(content).digest("hex");
    await sql.begin(async transaction => {
      await transaction.unsafe(content);
      await transaction`insert into public.app_schema_migrations (filename, checksum) values (${file}, ${checksum})`;
    });
    console.log(`Applied ${file}`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
