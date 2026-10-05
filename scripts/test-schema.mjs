// Requires a running Docker engine. Creates/removes only its own disposable
// PostgreSQL container; never uses .env.local or hosted Supabase credentials.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const container = `trackly-schema-${randomUUID()}`;
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `docker exited ${result.status}`);
  return result.stdout.trim();
}
function sql(database, source) {
  return docker(["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], source);
}
const file = (name) => readFileSync(new URL(`../supabase/${name}`, import.meta.url), "utf8");
const bootstrap = `
  create schema auth; create schema storage; create schema extensions;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(text) returns text[] language sql immutable as
    $$ select string_to_array($1, '/') $$;
  grant usage on schema public, auth, storage to authenticated, anon;
`;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const row = "33333333-3333-4333-8333-333333333333";
const inspect = `select json_build_object(
  'columns', (select json_agg(r order by attnum) from (
    select a.attnum, a.attname, format_type(a.atttypid,a.atttypmod) as type,
      a.attnotnull, pg_get_expr(d.adbin,d.adrelid) as expression
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid='public.items'::regclass and a.attnum>0 and not a.attisdropped) r),
  'constraints', (select json_agg(r order by conname) from (
    select conname, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.items'::regclass) r),
  'indexes', (select json_agg(r order by indexname) from (
    select indexname,indexdef from pg_indexes where schemaname='public' and tablename='items') r),
  'policies', (select json_agg(r order by schemaname,tablename,policyname) from (
    select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies
    where schemaname in ('public','storage')) r),
  'functions', (select json_agg(r order by proname) from (
    select proname, provolatile, prosecdef, proconfig,
      regexp_replace(pg_get_functiondef(p.oid),'\\s+',' ','g') as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') r),
  'triggers', (select json_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger
    where tgrelid='public.items'::regclass and not tgisinternal),
  'rls', (select relrowsecurity from pg_class where oid='public.items'::regclass),
  'bucket', (select row_to_json(b) from storage.buckets b where id='avatars')
);`;

let started = false;
try {
  docker(["info", "--format", "{{.ServerVersion}}"]);
  console.log("Starting disposable PostgreSQL 17 container (may pull the image)…");
  docker(["run", "--detach", "--rm", "--name", container, "--tmpfs", "/var/lib/postgresql/data", "-e", "POSTGRES_PASSWORD=local_fixture_only", "postgres:17"]);
  started = true;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { docker(["exec", container, "pg_isready", "-U", "postgres"]); ready = true; break; } catch { await delay(500); }
  }
  assert.ok(ready, "Postgres did not become ready");
  sql("postgres", "create role authenticated; create role anon; create database fresh; create database upgraded;");
  for (const db of ["fresh", "upgraded"]) sql(db, bootstrap);
  sql("fresh", file("schema.sql"));
  for (const name of ["0001_init.sql", "0002_hardening.sql", "0003_account_deletion.sql"]) sql("upgraded", file(`migrations/${name}`));
  assert.deepEqual(JSON.parse(sql("fresh", inspect)), JSON.parse(sql("upgraded", inspect)));
  console.log("PASS fresh schema equals ordered migrations: columns, constraints, indexes, policies, functions, triggers, bucket limits");
  for (const db of ["fresh", "upgraded"]) {
    sql(db, `insert into auth.users values ('${owner}'), ('${other}');
      insert into public.items(id,user_id,title,url,tags,notes,created_at,updated_at)
      values ('${row}','${owner}','日本語','https://example.com',array['tag,one','tag two'],'notes','2025-01-01','2025-01-02');
      grant select,insert,update,delete on public.items,storage.objects to authenticated;
    `);
    assert.equal(sql(db, `select search_text from items where id='${row}';`), "日本語 notes tag,one tag two");
    const original = sql(db, "select row_to_json(i) from items i;");
    // Only replay a current-state script or the final migration, never restore the old RPC.
    sql(db, db === "fresh" ? file("schema.sql") : file("migrations/0003_account_deletion.sql"));
    assert.equal(sql(db, "select row_to_json(i) from items i;"), original);
    assert.equal(sql(db, "select to_regprocedure('public.delete_current_user()') is null;"), "t");
    const asOther = `set role authenticated; set request.jwt.claim.sub='${other}';`;
    assert.equal(sql(db, `${asOther} select count(*) from public.items;`), "0");
    assert.equal(sql(db, `${asOther} with changed as (update items set title='stolen' where id='${row}' returning id) select count(*) from changed;`), "0");
    assert.equal(sql(db, `${asOther} with removed as (delete from items where id='${row}' returning id) select count(*) from removed;`), "0");
    assert.throws(() => sql(db, `${asOther} insert into items(user_id,title,url) values ('${owner}','forged','https://example.com');`), /row-level security/);
    assert.throws(() => sql(db, `insert into items(user_id,title,url,kind,status) values ('${owner}','bad','https://example.com','course','interview');`), /items_status_check/);
    assert.throws(() => sql(db, `insert into items(user_id,title,url) values ('${owner}',repeat('x',301),'https://example.com');`), /items_title_len_check/);
    sql(db, `delete from auth.users where id='${owner}';`);
    assert.equal(sql(db, "select count(*) from items;"), "0");
  }
  console.log("PASS generated text, safe reapplication, timestamp preservation, ownership isolation, constraints, cascade deletion, and absent deletion RPC");
} finally {
  if (started) docker(["rm", "--force", container]);
}
