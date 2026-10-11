import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const STUDENT = "00000000-0000-4000-8000-000000000001";
const STUDENT2 = "00000000-0000-4000-8000-000000000002";
const INSTRUCTOR = "00000000-0000-4000-8000-000000000003";
const ADMIN = "00000000-0000-4000-8000-000000000004";
const EXPERT = "00000000-0000-4000-8000-000000000005";
const ANALYST = "00000000-0000-4000-8000-000000000006";

const TABLES = [
  "profiles",
  "research_identity_map",
  "participants",
  "consents",
  "ethics_settings",
  "weeks",
  "weekly_form_fields",
  "submissions",
  "events",
  "scores",
  "missing_data_log",
  "legacy_sheet_import",
] as const;

const WEEKLY_SCORES = {
  CYCLE_A: 4,
  CYCLE_B: 3,
  CYCLE_C: 2,
  CYCLE_D: 1,
  CYCLE_E: 0,
};

describe("RLS", () => {
  it("her tabloyu rol bazında sınırlar ve öğrenciye puan döndürmez", async () => {
    const db = new PGlite();
    await db.exec(`
      create schema if not exists auth;
      create table auth.users (
        id uuid primary key,
        email text
      );
      create or replace function auth.uid() returns uuid
      language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
    `);
    const migration = readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261011180000_research_schema.sql"),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(`
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      grant authenticated to current_user;
      grant anon to current_user;
    `);

    await expectMessage(
      db,
      `insert into public.participants (research_code, study_condition) values ('P0', 'CONTROL')`,
      "Etik ayarları",
    );
    await expectMessage(
      db,
      `update public.ethics_settings set enrollment_open = true where id = 1`,
      "enrollment_requires_ethics",
    );

    await db.exec(`
      update public.ethics_settings set
        board_name = 'TEST',
        approval_date = '2026-01-01',
        approval_number = 'TEST',
        protocol_version = 'TEST',
        consent_document_version = 'TEST',
        retention_period = 'TEST',
        data_controller = 'TEST',
        research_contact = 'TEST',
        research_starts_on = '2026-01-01',
        research_ends_on = '2026-12-31',
        authorized_processors = 'TEST',
        ai_providers = 'TEST',
        enrollment_open = true
      where id = 1;

      insert into auth.users (id, email) values
        ('${STUDENT}', 'student@example.test'),
        ('${STUDENT2}', 'student2@example.test'),
        ('${INSTRUCTOR}', 'instructor@example.test'),
        ('${ADMIN}', 'admin@example.test'),
        ('${EXPERT}', 'expert@example.test'),
        ('${ANALYST}', 'analyst@example.test');

      update public.profiles set role = 'INSTRUCTOR' where id = '${INSTRUCTOR}';
      update public.profiles set role = 'ADMIN' where id = '${ADMIN}';
      update public.profiles set role = 'EXPERT_EVALUATOR' where id = '${EXPERT}';
      update public.profiles set role = 'RESEARCH_ANALYST' where id = '${ANALYST}';

      insert into public.participants (research_code, study_condition, form_sequence, status) values
        ('P1', 'RAG_ASSISTED', 'AB', 'ACTIVE'),
        ('P2', 'CONTROL', 'BA', 'ACTIVE');
      insert into public.research_identity_map (user_id, research_code) values
        ('${STUDENT}', 'P1');
      insert into public.consents (user_id, document_version, decision) values
        ('${STUDENT}', 'TEST', 'ACCEPTED');
      update public.weeks set is_active = true where week_number = 1;
      insert into public.submissions (research_code, week_number, version_kind, content, rubric_version) values
        ('P1', 1, 'V0', '{"plan":"taslak"}'::jsonb, 'rubric-test');
      insert into public.events (
        research_code, week_number, event_type, message, model_response, model_name,
        prompt_version, retrieved_chunk_ids, latency_ms
      ) values (
        'P1', 1, 'chat', 'soru', 'yanıt', 'gpt-4o-mini', 'p1', array['chunk-1'], 12
      );
      insert into public.missing_data_log (
        research_code, study_condition, week_number, assessment_type, version_kind,
        expected_submission, actual_submission, completion_status, missing_reason, missing_reason_source
      ) values (
        'P2', 'CONTROL', 3, 'WEEKLY', 'V0', true, false, 'MISSING', 'NOT_SUBMITTED', 'TEST'
      );
      insert into public.legacy_sheet_import (email, first_name, last_name, raw_row) values
        ('ada@example.test', 'Ada', 'Lovelace', '{"puan_a":"80"}'::jsonb);
    `);

    const submission = await db.query<{ id: string }>(
      `select id from public.submissions where research_code = 'P1'`,
    );
    const submissionId = submission.rows[0].id;
    await db.query(
      `insert into public.scores (
         research_code, submission_id, evaluator_type, dimension_scores, total_score, rationale, rubric_version
       ) values ($1, $2, 'LLM', $3::jsonb, 1, 'gerekce', 'rubric-test')`,
      ["P1", submissionId, JSON.stringify(WEEKLY_SCORES)],
    );
    const stored = await db.query<{ total_score: number }>(
      `select total_score from public.scores where submission_id = $1`,
      [submissionId],
    );
    assert.equal(stored.rows[0].total_score, 50000);

    const tables = await db.query<{ relname: string; rls: boolean; forced: boolean }>(`
      select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `);
    assert.deepEqual(
      tables.rows.map((row) => row.relname),
      [...TABLES].sort(),
    );
    assert.equal(tables.rows.every((row) => row.rls && row.forced), true);

    const floats = await db.query<{ n: number }>(`
      select count(*)::int as n
      from information_schema.columns
      where table_schema = 'public'
        and data_type in ('double precision', 'real', 'numeric')
    `);
    assert.equal(floats.rows[0].n, 0);

    const week5 = await db.query<{ is_v0_v1: boolean }>(
      `select is_v0_v1 from public.weeks where week_number = 5`,
    );
    assert.equal(week5.rows[0].is_v0_v1, true);

    const fieldCounts = await db.query<{ week_number: number; n: number }>(`
      select week_number, count(*)::int as n
      from public.weekly_form_fields
      group by week_number
      order by week_number
    `);
    assert.deepEqual(
      fieldCounts.rows.map((row) => row.n),
      [7, 7, 7, 8, 7, 8, 7, 8, 8, 9],
    );

    const expected: Record<string, Record<(typeof TABLES)[number], number>> = {
      [STUDENT]: {
        profiles: 1,
        research_identity_map: 0,
        participants: 0,
        consents: 1,
        ethics_settings: 0,
        weeks: 1,
        weekly_form_fields: 7,
        submissions: 1,
        events: 1,
        scores: 0,
        missing_data_log: 0,
        legacy_sheet_import: 0,
      },
      [INSTRUCTOR]: {
        profiles: 6,
        research_identity_map: 0,
        participants: 2,
        consents: 1,
        ethics_settings: 1,
        weeks: 10,
        weekly_form_fields: 76,
        submissions: 1,
        events: 1,
        scores: 1,
        missing_data_log: 1,
        legacy_sheet_import: 0,
      },
      [ADMIN]: {
        profiles: 6,
        research_identity_map: 1,
        participants: 2,
        consents: 1,
        ethics_settings: 1,
        weeks: 10,
        weekly_form_fields: 76,
        submissions: 1,
        events: 1,
        scores: 1,
        missing_data_log: 1,
        legacy_sheet_import: 1,
      },
      [EXPERT]: {
        profiles: 1,
        research_identity_map: 0,
        participants: 0,
        consents: 0,
        ethics_settings: 0,
        weeks: 10,
        weekly_form_fields: 76,
        submissions: 0,
        events: 0,
        scores: 0,
        missing_data_log: 0,
        legacy_sheet_import: 0,
      },
      [ANALYST]: {
        profiles: 1,
        research_identity_map: 0,
        participants: 2,
        consents: 0,
        ethics_settings: 0,
        weeks: 10,
        weekly_form_fields: 76,
        submissions: 1,
        events: 0,
        scores: 1,
        missing_data_log: 1,
        legacy_sheet_import: 0,
      },
    };

    for (const [userId, counts] of Object.entries(expected)) {
      for (const table of TABLES) {
        const actual = await asUser(db, userId, async () => count(db, table));
        assert.equal(actual, counts[table], `${userId} ${table}`);
      }
    }

    const leaked = await asUser(db, STUDENT, async () => {
      const joined = await db.query<{ n: number }>(`
        select count(s.id)::int as n
        from public.submissions sub
        left join public.scores s on s.submission_id = sub.id
        where s.total_score is not null
      `);
      const direct = await db.query<{ n: number }>(`
        with visible as (select total_score, dimension_scores from public.scores)
        select count(*)::int as n from visible
      `);
      const hiddenWeek = await db.query<{ n: number }>(
        `select count(*)::int as n from public.weeks where week_number = 5`,
      );
      const ownCode = await db.query<{ code: string | null }>(
        `select public.my_research_code() as code`,
      );
      return {
        joined: joined.rows[0].n,
        direct: direct.rows[0].n,
        hiddenWeek: hiddenWeek.rows[0].n,
        ownCode: ownCode.rows[0].code,
      };
    });
    assert.equal(leaked.joined, 0);
    assert.equal(leaked.direct, 0);
    assert.equal(leaked.hiddenWeek, 0);
    assert.equal(leaked.ownCode, "P1");

    await asUser(db, STUDENT, () =>
      expectMessage(
        db,
        `insert into public.scores (
           research_code, submission_id, evaluator_type, dimension_scores, total_score, rationale, rubric_version
         ) values ('P1', '${submissionId}', 'LLM', '${JSON.stringify(WEEKLY_SCORES)}'::jsonb, 1, 'x', 'rubric-test')`,
        "row-level security",
      ),
    );
    await asUser(db, STUDENT, () =>
      expectMessage(
        db,
        `insert into public.participants (research_code, study_condition) values ('P3', 'CONTROL')`,
        "row-level security",
      ),
    );
    await asUser(db, INSTRUCTOR, () =>
      expectMessage(
        db,
        `insert into public.research_identity_map (user_id, research_code) values ('${STUDENT2}', 'P2')`,
        "row-level security",
      ),
    );
    await asUser(db, STUDENT, () =>
      expectMessage(
        db,
        `update public.profiles set role = 'ADMIN' where id = '${STUDENT}'`,
        "Rol yalnızca ADMIN",
      ),
    );

    await expectMessage(
      db,
      `insert into public.submissions (research_code, week_number, version_kind, content, rubric_version)
       values ('P1', 4, 'V1', '{}'::jsonb, 'rubric-test')`,
      "V0 olmadan",
    );
    await expectMessage(
      db,
      `update public.submissions set content = '{}'::jsonb where research_code = 'P1'`,
      "değiştirilemez",
    );
    await expectMessage(
      db,
      `delete from public.scores`,
      "değiştirilemez",
    );

    await db.exec(`
      insert into public.submissions (research_code, week_number, version_kind, content, rubric_version)
      values ('P1', 2, 'V0', '{}'::jsonb, 'rubric-test');
      insert into public.missing_data_log (
        research_code, study_condition, week_number, assessment_type, version_kind,
        expected_submission, actual_submission, completion_status, missing_reason, missing_reason_source
      ) values (
        'P1', 'RAG_ASSISTED', 2, 'WEEKLY', 'V0', true, false, 'MISSING', 'NOT_SUBMITTED', 'TEST'
      );
    `);
    const blocked = await db.query<{ id: string }>(
      `select id from public.submissions where research_code = 'P1' and week_number = 2`,
    );
    await expectMessage(
      db,
      `insert into public.scores (
         research_code, submission_id, evaluator_type, dimension_scores, total_score, rationale, rubric_version
       ) values (
         'P1', '${blocked.rows[0].id}', 'LLM', '${JSON.stringify(WEEKLY_SCORES)}'::jsonb, 0, 'yok', 'rubric-test'
       )`,
      "Eksik gözleme puan yazılamaz",
    );

    await db.exec("set role anon");
    try {
      await expectMessage(db, `select count(*) from public.scores`, "permission denied");
    } finally {
      await db.exec("reset role");
    }
    await db.close();
  });
});

async function count(db: PGlite, table: (typeof TABLES)[number]): Promise<number> {
  const result = await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
  return result.rows[0].n;
}

async function asUser<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

async function expectMessage(db: PGlite, sql: string, text: string): Promise<void> {
  let message = "";
  try {
    await db.exec(sql);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert.match(message, new RegExp(text));
}
