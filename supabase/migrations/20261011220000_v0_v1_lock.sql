-- V0/V1 süre kilidi ve haftalık soru hakkı.
-- Dakika kolonları boş bırakılır. Süre uydurulmaz.

alter table public.weeks
  add column v0_minutes integer,
  add column v1_minutes integer;

alter table public.weeks
  add constraint weeks_stage_minutes check (
    (v0_minutes is null and v1_minutes is null)
    or (v0_minutes = v1_minutes and v0_minutes > 0)
  );

alter table public.submissions
  add column submission_status text not null default 'SUBMITTED'
    check (submission_status in ('SUBMITTED', 'TIMED_OUT')),
  add column revision_duration_seconds integer
    check (revision_duration_seconds is null or revision_duration_seconds >= 0),
  add column revision_summary text,
  add column ai_interaction_count integer
    check (ai_interaction_count is null or ai_interaction_count >= 0);

create table public.participant_week_stages (
  id uuid primary key default gen_random_uuid(),
  research_code text not null references public.participants (research_code),
  week_number integer not null references public.weeks (week_number),
  stage text not null check (stage in ('V0_OPEN', 'V0_LOCKED', 'V1_OPEN', 'V1_LOCKED')),
  opened_at timestamptz not null,
  closes_at timestamptz not null,
  recorded_at timestamptz not null default now()
);

create table public.ai_request_quotas (
  research_code text not null references public.participants (research_code),
  week_number integer not null references public.weeks (week_number),
  request_limit integer not null check (request_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  primary key (research_code, week_number),
  check (used_count <= request_limit)
);

create or replace function public.open_v0_stage(
  p_code text,
  p_week integer,
  p_now timestamptz default now()
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ready boolean;
  minutes integer;
begin
  select w.is_v0_v1 and w.v0_minutes is not null and w.v1_minutes is not null,
         w.v0_minutes
    into ready, minutes
  from public.weeks w
  where w.week_number = p_week;

  if ready is not true then
    return 'closed';
  end if;

  if exists (
    select 1
    from public.participant_week_stages s
    where s.research_code = p_code and s.week_number = p_week
  ) then
    return 'exists';
  end if;

  insert into public.participant_week_stages (
    research_code, week_number, stage, opened_at, closes_at, recorded_at
  ) values (
    p_code, p_week, 'V0_OPEN', p_now, p_now + (minutes * interval '1 minute'), p_now
  );
  return 'opened';
end;
$$;

create or replace function public.close_elapsed_stage(
  p_code text,
  p_week integer,
  p_now timestamptz default now()
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_stage text;
  opened timestamptz;
  closes timestamptz;
  draft text;
  has_draft boolean := false;
  version text;
  condition text;
  minutes integer;
  ai_count integer;
  duration integer;
begin
  select s.stage, s.opened_at, s.closes_at
    into current_stage, opened, closes
  from public.participant_week_stages s
  where s.research_code = p_code and s.week_number = p_week
  order by s.recorded_at desc
  limit 1;

  if current_stage is null or current_stage not in ('V0_OPEN', 'V1_OPEN') then
    return 'idle';
  end if;
  if p_now < closes then
    return 'open';
  end if;

  version := case when current_stage = 'V0_OPEN' then 'V0' else 'V1' end;

  select e.message into draft
  from public.events e
  where e.research_code = p_code
    and e.week_number = p_week
    and e.event_type = 'FORM_DRAFT'
  order by e.recorded_at desc
  limit 1;

  if draft is not null then
    begin
      select exists (
        select 1
        from jsonb_each_text(coalesce((draft::jsonb) -> 'fields', '{}'::jsonb)) as field
        where length(btrim(field.value)) > 0
      ) into has_draft;
    exception when others then
      has_draft := false;
    end;
  end if;

  select p.study_condition into condition
  from public.participants p
  where p.research_code = p_code;

  duration := greatest(0, floor(extract(epoch from (p_now - opened)))::integer);
  select count(*)::integer into ai_count
  from public.events e
  where e.research_code = p_code
    and e.week_number = p_week
    and e.event_type = 'RAG_REQUEST'
    and e.recorded_at <= p_now;

  if has_draft and not exists (
    select 1 from public.submissions s
    where s.research_code = p_code
      and s.week_number = p_week
      and s.version_kind = version
  ) then
    insert into public.submissions (
      research_code, week_number, version_kind, content, rubric_version,
      submission_status, revision_duration_seconds, revision_summary,
      ai_interaction_count, submitted_at
    ) values (
      p_code, p_week, version, draft::jsonb, 'UNSET',
      'TIMED_OUT', duration, null, ai_count, p_now
    );
  elsif not has_draft then
    insert into public.missing_data_log (
      research_code, study_condition, week_number, assessment_type, version_kind,
      expected_submission, actual_submission, completion_status,
      missing_reason, missing_reason_source
    ) values (
      p_code, condition, p_week, 'WEEKLY', version,
      true, false, 'MISSING', 'NOT_SUBMITTED', 'SERVER_TIMEOUT'
    );
  end if;

  insert into public.participant_week_stages (
    research_code, week_number, stage, opened_at, closes_at, recorded_at
  ) values (
    p_code,
    p_week,
    case when version = 'V0' then 'V0_LOCKED' else 'V1_LOCKED' end,
    p_now,
    p_now,
    p_now
  );

  if version = 'V0' and has_draft then
    select w.v0_minutes into minutes
    from public.weeks w
    where w.week_number = p_week;
    if minutes is not null then
      insert into public.participant_week_stages (
        research_code, week_number, stage, opened_at, closes_at, recorded_at
      ) values (
        p_code, p_week, 'V1_OPEN', p_now, p_now + (minutes * interval '1 minute'),
        p_now + interval '1 millisecond'
      );
    end if;
  end if;

  if has_draft then
    return 'locked-draft';
  end if;
  return 'missing';
end;
$$;

create or replace function public.record_version_submission(
  p_code text,
  p_week integer,
  p_content jsonb,
  p_summary text,
  p_now timestamptz default now()
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_stage text;
  opened timestamptz;
  closes timestamptz;
  version text;
  minutes integer;
  ai_count integer;
  duration integer;
begin
  if p_summary is null or length(btrim(p_summary)) = 0 then
    raise exception 'Revizyon özeti gerekli';
  end if;

  select s.stage, s.opened_at, s.closes_at
    into current_stage, opened, closes
  from public.participant_week_stages s
  where s.research_code = p_code and s.week_number = p_week
  order by s.recorded_at desc
  limit 1;

  if current_stage = 'V0_OPEN' then
    version := 'V0';
  elsif current_stage = 'V1_OPEN' then
    version := 'V1';
  else
    raise exception 'kilitli gönderim değiştirilemez';
  end if;

  if p_now >= closes then
    raise exception 'süre bitti';
  end if;

  duration := greatest(0, floor(extract(epoch from (p_now - opened)))::integer);
  select count(*)::integer into ai_count
  from public.events e
  where e.research_code = p_code
    and e.week_number = p_week
    and e.event_type = 'RAG_REQUEST'
    and e.recorded_at <= p_now;

  insert into public.submissions (
    research_code, week_number, version_kind, content, rubric_version,
    submission_status, revision_duration_seconds, revision_summary,
    ai_interaction_count, submitted_at
  ) values (
    p_code, p_week, version, p_content, 'UNSET',
    'SUBMITTED', duration, btrim(p_summary), ai_count, p_now
  );

  insert into public.participant_week_stages (
    research_code, week_number, stage, opened_at, closes_at, recorded_at
  ) values (
    p_code,
    p_week,
    case when version = 'V0' then 'V0_LOCKED' else 'V1_LOCKED' end,
    p_now,
    p_now,
    p_now
  );

  if version = 'V0' then
    select w.v0_minutes into minutes
    from public.weeks w
    where w.week_number = p_week;
    insert into public.participant_week_stages (
      research_code, week_number, stage, opened_at, closes_at, recorded_at
    ) values (
      p_code, p_week, 'V1_OPEN', p_now, p_now + (minutes * interval '1 minute'),
      p_now + interval '1 millisecond'
    );
  end if;

  return version;
end;
$$;

create or replace function public.consume_rag_quota(
  p_code text,
  p_week integer,
  p_limit integer
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining integer;
begin
  if p_limit is null or p_limit < 1 then
    return null;
  end if;

  insert into public.ai_request_quotas (research_code, week_number, request_limit, used_count)
  values (p_code, p_week, p_limit, 0)
  on conflict (research_code, week_number) do nothing;

  update public.ai_request_quotas
  set used_count = used_count + 1
  where research_code = p_code
    and week_number = p_week
    and used_count < request_limit
  returning request_limit - used_count into remaining;

  return remaining;
end;
$$;

create or replace function public.stage_clock(p_code text, p_week integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'stage', s.stage,
    'seconds_remaining',
      case
        when s.stage in ('V0_OPEN', 'V1_OPEN') then
          greatest(0, floor(extract(epoch from (s.closes_at - now())))::integer)
        else null
      end,
    'minutes_ready', w.v0_minutes is not null and w.v1_minutes is not null,
    'is_v0_v1', w.is_v0_v1
  )
  from public.weeks w
  left join lateral (
    select stage, closes_at
    from public.participant_week_stages
    where research_code = p_code and week_number = p_week
    order by recorded_at desc
    limit 1
  ) s on true
  where w.week_number = p_week;
$$;

create trigger stages_append_only
  before update or delete on public.participant_week_stages
  for each row execute function public.reject_update_delete();

revoke update, delete on public.participant_week_stages from authenticated;
revoke all on public.ai_request_quotas from anon, authenticated;

alter table public.participant_week_stages enable row level security;
alter table public.participant_week_stages force row level security;
alter table public.ai_request_quotas enable row level security;
alter table public.ai_request_quotas force row level security;

create policy stages_staff_select on public.participant_week_stages
  for select to authenticated
  using (public.current_app_role() in ('ADMIN', 'INSTRUCTOR', 'RESEARCH_ANALYST'));

create policy quotas_staff_select on public.ai_request_quotas
  for select to authenticated
  using (public.current_app_role() in ('ADMIN', 'INSTRUCTOR', 'RESEARCH_ANALYST'));

revoke all on function public.open_v0_stage(text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.close_elapsed_stage(text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.record_version_submission(text, integer, jsonb, text, timestamptz) from public, anon, authenticated;
revoke all on function public.consume_rag_quota(text, integer, integer) from public, anon, authenticated;
revoke all on function public.stage_clock(text, integer) from public, anon, authenticated;
