import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Optional isolated PostgreSQL verifier; no project/runtime dependency or hosted writes.
// Supply the absolute entrypoint of an installed @electric-sql/pglite package.
if (!process.env.PHASE4_PGLITE_MODULE) throw new Error('Set PHASE4_PGLITE_MODULE to an installed @electric-sql/pglite entrypoint');
const { PGlite } = await import(pathToFileURL(process.env.PHASE4_PGLITE_MODULE).href);
const db = new PGlite();
try {
  // Minimal Supabase role/auth scaffolding, not a replacement for hosted acceptance.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    grant usage on schema public to service_role;
    alter default privileges in schema public grant all on tables to service_role, anon, authenticated;`);
  for (const file of (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await db.exec(await readFile(new URL('../supabase/tests/phase04.sql', import.meta.url), 'utf8'));
  console.log('Phase 4 migration and storage assertions passed on isolated PostgreSQL (PGlite). Hosted Supabase acceptance remains required.');
} finally { await db.close(); }
