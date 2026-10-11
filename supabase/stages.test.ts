import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const STUDENT = "00000000-0000-4000-8000-000000000011";

async function database() {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key, email text);
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  for (const file of [
    "supabase/migrations/20261011180000_research_schema.sql",
    "supabase/migrations/20261011220000_v0_v1_lock.sql",
  ]) {
    await db.exec(readFileSync(path.join(process.cwd(), file), "utf8"));
  }
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
    insert into auth.users (id, email) values ('${STUDENT}', 'student@example.test');
    insert into public.participants (research_code, study_condition, status) values
      ('RAG1', 'RAG_ASSISTED', 'ACTIVE'),
      ('CTL1', 'CONTROL', 'ACTIVE');
    update public.weeks set v0_minutes = 10, v1_minutes = 10 where week_number = 1;
  `);
  return db;
}

describe("V0 V1 kilidi", () => {
  it("süre bitince taslağı kilitler ve puan yazmaz", async () => {
    const db = await database();
    const opened = await db.query<{ open_v0_stage: string }>(
      `select public.open_v0_stage('RAG1', 1, '2026-03-01T10:00:00Z') as open_v0_stage`,
    );
    assert.equal(opened.rows[0].open_v0_stage, "opened");
    await db.exec(`
      insert into public.events (research_code, week_number, event_type, message)
      values ('RAG1', 1, 'FORM_DRAFT', '{"fields":{"a":"müşteri cümlesi"}}');
    `);
    const closed = await db.query<{ close_elapsed_stage: string }>(
      `select public.close_elapsed_stage('RAG1', 1, '2026-03-01T10:11:00Z') as close_elapsed_stage`,
    );
    assert.equal(closed.rows[0].close_elapsed_stage, "locked-draft");
    const submission = await db.query<{
      submission_status: string;
      revision_duration_seconds: number;
      ai_interaction_count: number;
    }>(
      `select submission_status, revision_duration_seconds, ai_interaction_count
       from public.submissions
       where research_code = 'RAG1' and version_kind = 'V0'`,
    );
    assert.equal(submission.rows[0].submission_status, "TIMED_OUT");
    assert.equal(submission.rows[0].revision_duration_seconds, 660);
    assert.equal(submission.rows[0].ai_interaction_count, 0);
    const scores = await db.query(`select id from public.scores`);
    assert.equal(scores.rows.length, 0);
    const stage = await db.query<{ stage: string }>(
      `select stage from public.participant_week_stages
       where research_code = 'RAG1'
       order by recorded_at desc
       limit 1`,
    );
    assert.equal(stage.rows[0].stage, "V1_OPEN");
  });

  it("taslak yoksa eksik kayıt yazar ve fark için V1 açmaz", async () => {
    const db = await database();
    await db.query(`select public.open_v0_stage('CTL1', 1, '2026-03-01T10:00:00Z')`);
    const closed = await db.query<{ close_elapsed_stage: string }>(
      `select public.close_elapsed_stage('CTL1', 1, '2026-03-01T10:11:00Z') as close_elapsed_stage`,
    );
    assert.equal(closed.rows[0].close_elapsed_stage, "missing");
    const missing = await db.query<{ missing_reason: string }>(
      `select missing_reason from public.missing_data_log where research_code = 'CTL1'`,
    );
    assert.equal(missing.rows[0].missing_reason, "NOT_SUBMITTED");
    const submissions = await db.query(
      `select id from public.submissions where research_code = 'CTL1'`,
    );
    assert.equal(submissions.rows.length, 0);
    const v1 = await db.query(
      `select id from public.participant_week_stages
       where research_code = 'CTL1' and stage = 'V1_OPEN'`,
    );
    assert.equal(v1.rows.length, 0);
    const scores = await db.query(`select id from public.scores`);
    assert.equal(scores.rows.length, 0);
  });

  it("kilitli gönderimi değiştirmez", async () => {
    const db = await database();
    await db.query(`select public.open_v0_stage('RAG1', 1, '2026-03-01T10:00:00Z')`);
    await db.query(
      `select public.record_version_submission(
        'RAG1', 1, '{"fields":{"a":"ilk"}}'::jsonb, 'kısa özet', '2026-03-01T10:05:00Z'
      )`,
    );
    await assert.rejects(
      () =>
        db.exec(
          `update public.submissions set content = '{"fields":{"a":"değişti"}}'::jsonb
           where research_code = 'RAG1'`,
        ),
      /değiştirilemez/,
    );
  });

  it("kota yarışında limiti aşmaz", async () => {
    const db = await database();
    const first = await db.query<{ consume_rag_quota: number | null }>(
      `select public.consume_rag_quota('RAG1', 1, 1) as consume_rag_quota`,
    );
    const second = await db.query<{ consume_rag_quota: number | null }>(
      `select public.consume_rag_quota('RAG1', 1, 1) as consume_rag_quota`,
    );
    assert.equal(first.rows[0].consume_rag_quota, 0);
    assert.equal(second.rows[0].consume_rag_quota, null);
    const used = await db.query<{ used_count: number }>(
      `select used_count from public.ai_request_quotas where research_code = 'RAG1'`,
    );
    assert.equal(used.rows[0].used_count, 1);
  });

  it("dakika boşken V0 açmaz", async () => {
    const db = await database();
    const opened = await db.query<{ open_v0_stage: string }>(
      `select public.open_v0_stage('RAG1', 5, '2026-03-01T10:00:00Z') as open_v0_stage`,
    );
    assert.equal(opened.rows[0].open_v0_stage, "closed");
  });
});
