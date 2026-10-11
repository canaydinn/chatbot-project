-- Araştırma şeması. Hafta 5, kullanıcı kararıyla V0/V1 haftasıdır.
-- İçerik docs/HAFTALIK_ICERIK.md dosyasından alınmıştır.
-- Etik onay alanları boş bırakıldı. Değer uydurulmadı.
-- Para kolonu yok. Puan toplamı tam sayıdır: 100000 = 100 puan.
-- auth.users ve auth.uid() Supabase'te vardır. Bu dosya auth.uid() fonksiyonunu yazmaz.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    drop trigger if exists on_auth_user_created on auth.users;
  end if;
end $$;

drop table if exists public.ai_usage_events cascade;
drop table if exists public.ai_budget_reservations cascade;
drop table if exists public.ai_budget_policies cascade;
drop table if exists public.ai_pricing_versions cascade;
drop table if exists public.expert_assignments cascade;
drop table if exists public.blinded_plan_links cascade;
drop table if exists public.blinded_plans cascade;
drop table if exists public.missing_observations cascade;
drop table if exists public.formative_feedback cascade;
drop table if exists public.criterion_scores cascade;
drop table if exists public.submissions cascade;
drop table if exists public.submission_drafts cascade;
drop table if exists public.consent_events cascade;
drop table if exists public.identity_links cascade;
drop table if exists public.participant_status_events cascade;
drop table if exists public.research_participants cascade;
drop table if exists public.final_criteria cascade;
drop table if exists public.rubric_versions cascade;
drop table if exists public.cycle_dimensions cascade;
drop table if exists public.plan_sections cascade;
drop table if exists public.study_weeks cascade;
drop table if exists public.study_settings cascade;
drop table if exists public.legacy_sheet_import cascade;
drop table if exists public.profiles cascade;

drop function if exists public.weighted_total_milli(integer[], integer[]);
drop function if exists public.require_v0_before_v1();
drop function if exists public.reject_update_delete();
drop function if exists public.my_research_code();
drop function if exists public.current_role();
drop function if exists public.handle_new_user();

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

grant usage on schema public to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'STUDENT'
    check (role in ('STUDENT', 'INSTRUCTOR', 'ADMIN', 'EXPERT_EVALUATOR', 'RESEARCH_ANALYST')),
  full_name text,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table public.participants (
  research_code text primary key,
  study_condition text not null check (study_condition in ('CONTROL', 'RAG_ASSISTED')),
  form_sequence text check (form_sequence in ('AB', 'BA')),
  status text not null default 'ACTIVE' check (status in (
    'ACTIVE', 'TEMPORARILY_INACTIVE', 'COURSE_WITHDRAWN', 'RESEARCH_WITHDRAWN', 'COMPLETED'
  )),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.research_identity_map (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  research_code text not null unique references public.participants (research_code),
  linked_at timestamptz not null default now()
);

create table public.ethics_settings (
  id integer primary key default 1 check (id = 1),
  board_name text,
  approval_date date,
  approval_number text,
  protocol_version text,
  consent_document_version text,
  retention_period text,
  data_controller text,
  research_contact text,
  research_starts_on date,
  research_ends_on date,
  authorized_processors text,
  ai_providers text,
  enrollment_open boolean not null default false,
  constraint enrollment_requires_ethics check (
    enrollment_open = false
    or (
      board_name is not null
      and approval_date is not null
      and approval_number is not null
      and protocol_version is not null
      and consent_document_version is not null
      and retention_period is not null
      and data_controller is not null
      and research_contact is not null
      and research_starts_on is not null
      and research_ends_on is not null
      and authorized_processors is not null
      and ai_providers is not null
    )
  )
);

insert into public.ethics_settings (id) values (1);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_version text not null,
  decision text not null check (decision in ('ACCEPTED', 'DECLINED', 'WITHDRAWN')),
  recorded_at timestamptz not null default now(),
  prior_consent_id uuid references public.consents (id),
  check (
    (decision = 'WITHDRAWN' and prior_consent_id is not null)
    or (decision in ('ACCEPTED', 'DECLINED') and prior_consent_id is null)
  )
);

create table public.weeks (
  week_number integer primary key check (week_number between 1 and 10),
  title text not null,
  is_active boolean not null default false,
  is_v0_v1 boolean not null
);

create unique index weeks_single_active on public.weeks ((true)) where is_active;

create table public.weekly_form_fields (
  id uuid primary key default gen_random_uuid(),
  week_number integer not null references public.weeks (week_number),
  position integer not null check (position > 0),
  label text not null,
  unique (week_number, position)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  research_code text not null references public.participants (research_code),
  week_number integer not null references public.weeks (week_number),
  version_kind text not null check (version_kind in ('V0', 'V1', 'FINAL')),
  content jsonb not null,
  submitted_at timestamptz not null default now(),
  rubric_version text not null,
  unique (research_code, week_number, version_kind)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  research_code text not null references public.participants (research_code),
  week_number integer references public.weeks (week_number),
  event_type text not null,
  message text,
  model_response text,
  model_name text,
  prompt_version text,
  retrieved_chunk_ids text[] not null default '{}',
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  recorded_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  research_code text not null references public.participants (research_code),
  submission_id uuid not null references public.submissions (id),
  evaluator_type text not null check (evaluator_type in ('LLM', 'EXPERT', 'INSTRUCTOR')),
  dimension_scores jsonb not null,
  total_score integer not null,
  rationale text not null,
  rubric_version text not null,
  recorded_at timestamptz not null default now()
);

comment on column public.scores.total_score is
  'Binlik puan. 100000 = 100. Tam sayı. Kayan nokta değil. Mikro USD değil.';

create table public.missing_data_log (
  id uuid primary key default gen_random_uuid(),
  research_code text not null references public.participants (research_code),
  study_condition text not null check (study_condition in ('CONTROL', 'RAG_ASSISTED')),
  week_number integer references public.weeks (week_number),
  assessment_type text not null,
  version_kind text check (version_kind in ('V0', 'V1', 'FINAL')),
  expected_submission boolean not null,
  actual_submission boolean not null,
  completion_status text not null check (completion_status in ('MISSING', 'PARTIAL', 'SUBMITTED')),
  missing_reason text check (missing_reason in (
    'NOT_SUBMITTED', 'PARTIAL_SUBMISSION', 'TECHNICAL_FAILURE', 'ABSENT',
    'COURSE_WITHDRAWAL', 'RESEARCH_WITHDRAWAL', 'EVALUATION_FAILURE', 'OTHER'
  )),
  missing_reason_source text,
  technical_incident_id text,
  recorded_at timestamptz not null default now(),
  check (completion_status <> 'MISSING' or actual_submission = false),
  check (
    (completion_status = 'SUBMITTED' and missing_reason is null)
    or (completion_status in ('MISSING', 'PARTIAL') and missing_reason is not null)
  ),
  check (missing_reason is null or missing_reason_source is not null)
);

create table public.legacy_sheet_import (
  id uuid primary key default gen_random_uuid(),
  email text,
  first_name text,
  last_name text,
  raw_row jsonb not null,
  source_spreadsheet_id text,
  imported_at timestamptz not null default now()
);

insert into public.weeks (week_number, title, is_active, is_v0_v1) values
  (1, 'Girişimci ve araştırma çerçevesi', false, true),
  (2, 'Değer önerisi ve iş modeli', false, false),
  (3, 'Pazar evreni ve bölge', false, false),
  (4, 'Rekabet ve anket tasarımı', false, false),
  (5, 'Tek müşteri anketi', false, true),
  (6, 'Veri analizi, pazarlama ve teknik tanım', false, false),
  (7, 'Operasyon ve geliştirme', false, false),
  (8, 'Organizasyon ve finansal model', false, false),
  (9, 'Finansal fizibilite ve finansman', false, true),
  (10, 'Sonuç ve bütünsel denetim', false, false);

insert into public.weekly_form_fields (week_number, position, label) values
  (1, 1, 'Girişim adı ve aşaması'),
  (1, 2, 'Kurucu/ekip katkısı ve kaynakları'),
  (1, 3, 'Problem ve etkilenen aday müşteri'),
  (1, 4, 'Başlangıç bölgesi ve mevcut alternatifler'),
  (1, 5, 'İlk çözüm hipotezi'),
  (1, 6, 'Misyon, vizyon, değerler ve planlanan yapı'),
  (1, 7, 'Kısa, orta, uzun vadeli ölçülebilir hedefler'),
  (2, 1, 'Hedef müşteri sonucu ve değer hipotezi'),
  (2, 2, 'Ürün/hizmet birimi ve kapsamı'),
  (2, 3, 'Dahil/hariç özellikler ve kullanım koşulları'),
  (2, 4, 'Ödeyen kişi, gelir türü ve ücretlendirme birimi'),
  (2, 5, 'Beklenen kullanım/tekrar sıklığı'),
  (2, 6, 'Yenilik, koruma ve kuruluş gereksinimleri'),
  (2, 7, 'Kaynak açıkları ve ilk uygulama adımları'),
  (3, 1, 'Coğrafi hizmet alanı'),
  (3, 2, 'Aday müşteri evreni ve dahil olma koşulları'),
  (3, 3, 'Kaynaklı evren büyüklüğü ve tarih'),
  (3, 4, 'Pazar eğilimleri ve dayanakları'),
  (3, 5, 'TAM/SAM/SOM koşullu hesabı ve paydaları'),
  (3, 6, 'Kritik dönüşüm oranları ve varsayımlar'),
  (3, 7, 'Ankette doğrulanacak bilgi boşlukları'),
  (4, 1, 'Doğrudan/dolaylı rakip ve alternatifler'),
  (4, 2, 'Rakip karşılaştırma ölçütleri ve kaynakları'),
  (4, 3, 'Farklılaşma ve rekabet engelleri'),
  (4, 4, 'Anketin amacı ve hedef evreni'),
  (4, 5, 'Soru metinleri, türleri ve kodları'),
  (4, 6, 'Dallanma, uygunluk ve fiyat soruları'),
  (4, 7, 'Örnekleme, dağıtım ve veri koruma planı'),
  (4, 8, 'Anket prova kontrolü'),
  (5, 1, 'Kullanılan anket sürümü'),
  (5, 2, 'Saha başlangıç/bitiş tarihleri'),
  (5, 3, 'Dağıtım kanalı ve örnekleme yöntemi'),
  (5, 4, 'Ulaşılan kişi ve yanıt sayıları'),
  (5, 5, 'Uygun, elenen ve eksik yanıt sayıları'),
  (5, 6, 'Anonimleştirilmiş veri seti'),
  (5, 7, 'Saha kısıtları ve olası örneklem yanlılığı'),
  (6, 1, 'Veri temizleme ve filtreleme kuralları'),
  (6, 2, 'Segment, sorun, erişim ve fiyat analizleri'),
  (6, 3, 'Paydalar, oranlar ve örneklem sınırlılıkları'),
  (6, 4, 'Hedef segment ve konumlandırma'),
  (6, 5, 'Fiyat ve gerekçesi'),
  (6, 6, 'Dağıtım, tanıtım, satış ve müşteri ilişkileri'),
  (6, 7, 'Dönemlik müşteri/satış tahmini'),
  (6, 8, 'Teknik ürün/hizmet birimi ve kalite koşulları'),
  (7, 1, 'Uçtan uca iş akışı ve sorumlular'),
  (7, 2, 'İşlem süreleri, kaynaklar ve kapasite hesabı'),
  (7, 3, 'Darboğazlar, arıza ve kesinti payı'),
  (7, 4, 'Tedarikçiler, alternatifler ve servis koşulları'),
  (7, 5, 'Kalite kontrol ve hata düzeltme süreci'),
  (7, 6, 'Kuruluş yeri seçenekleri ve seçim gerekçesi'),
  (7, 7, 'Geliştirme aşamaları, kilometre taşları ve kaynaklar'),
  (8, 1, 'Organizasyon yapısı ve görev dağılımı'),
  (8, 2, 'Pozisyon tanımları ve personel gereksinimi'),
  (8, 3, 'İşgücü maliyeti ve dayanakları'),
  (8, 4, 'Kuruluş/yatırım giderleri'),
  (8, 5, 'Sabit ve değişken işletme giderleri'),
  (8, 6, 'Birim ekonomi ve satış varsayımları'),
  (8, 7, 'Aylık gelir–gider modeli'),
  (8, 8, 'Tahsilat, ödeme, nakit akışı ve takvim'),
  (9, 1, 'Katkı payı ve başa baş hesabı'),
  (9, 2, 'Yıllık kâr/zarar ve nakit değerlendirmesi'),
  (9, 3, 'Yatırım değerlendirme göstergeleri'),
  (9, 4, 'Hesap girdileri, yöntemleri ve dönemler'),
  (9, 5, 'Finansman gereksinimi ve kaynak seçenekleri'),
  (9, 6, 'Finansman zamanlaması ve sahiplik etkisi'),
  (9, 7, 'Duyarlılık, riskler ve kritik eşikler'),
  (9, 8, 'Devam/revizyon/erteleme kararı'),
  (10, 1, 'Yatırımcı/yönetici özeti'),
  (10, 2, 'Güncel problem–müşteri–çözüm ve pazar'),
  (10, 3, 'SWOT analizi'),
  (10, 4, 'Pazar–satış–kapasite tutarlılık kontrolü'),
  (10, 5, 'Fiyat–maliyet–kârlılık tutarlılık kontrolü'),
  (10, 6, 'Kuruluş–finansman–takvim tutarlılık kontrolü'),
  (10, 7, 'Kritik varsayımlar ve çözülmemiş riskler'),
  (10, 8, 'Nihai girişim kararı ve gerekçesi'),
  (10, 9, 'A–F bütünleşik plan ve kaynak ekleri');

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.my_research_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.research_code
  from public.research_identity_map m
  where m.user_id = auth.uid()
$$;

create or replace function public.reject_update_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Bu kayıt ekleme tabanlıdır ve değiştirilemez';
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or length(trim(new.email)) = 0 then
    raise exception 'E-posta olmadan profil açılamaz';
  end if;
  insert into public.profiles (id, email, role)
  values (new.id, lower(trim(new.email)), 'STUDENT');
  return new;
end;
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from pg_roles
    where rolname = current_user
      and (rolsuper or rolbypassrls)
  ) then
    return new;
  end if;
  if new.id is distinct from old.id then
    raise exception 'Profil kimliği değiştirilemez';
  end if;
  if new.role is distinct from old.role and public.current_app_role() is distinct from 'ADMIN' then
    raise exception 'Rol yalnızca ADMIN tarafından değiştirilebilir';
  end if;
  if new.email is distinct from old.email and public.current_app_role() is distinct from 'ADMIN' then
    raise exception 'E-posta yalnızca ADMIN tarafından değiştirilebilir';
  end if;
  return new;
end;
$$;

create or replace function public.assert_research_enrollment_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.ethics_settings e
    where e.id = 1
      and e.enrollment_open
      and e.board_name is not null
      and e.approval_date is not null
      and e.approval_number is not null
      and e.protocol_version is not null
      and e.consent_document_version is not null
      and e.retention_period is not null
      and e.data_controller is not null
      and e.research_contact is not null
      and e.research_starts_on is not null
      and e.research_ends_on is not null
      and e.authorized_processors is not null
      and e.ai_providers is not null
  ) then
    raise exception 'Etik ayarları doldurulmadan araştırma kaydı açılamaz';
  end if;
  return new;
end;
$$;

create or replace function public.stamp_withdrawal()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('COURSE_WITHDRAWN', 'RESEARCH_WITHDRAWN') and new.withdrawn_at is null then
    if tg_op = 'INSERT' then
      new.withdrawn_at := now();
    elsif new.status is distinct from old.status then
      new.withdrawn_at := now();
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.require_v0_before_v1()
returns trigger
language plpgsql
as $$
begin
  if new.version_kind = 'V1' and not exists (
    select 1
    from public.submissions s
    where s.research_code = new.research_code
      and s.week_number = new.week_number
      and s.version_kind = 'V0'
  ) then
    raise exception 'V1, bir V0 olmadan yazılamaz';
  end if;
  return new;
end;
$$;

create or replace function public.compute_total_milli(dimensions jsonb)
returns integer
language plpgsql
immutable
as $$
declare
  weights jsonb;
  weight integer;
  score integer;
  total integer := 0;
  key text;
begin
  if dimensions is null or jsonb_typeof(dimensions) <> 'object' then
    raise exception 'Boyut puanları nesne olmalı';
  end if;

  if jsonb_exists(dimensions, 'CYCLE_A') then
    weights := '{"CYCLE_A":15,"CYCLE_B":25,"CYCLE_C":20,"CYCLE_D":25,"CYCLE_E":15}'::jsonb;
  elsif jsonb_exists(dimensions, 'PROBLEM_VALUE') then
    weights := '{"PROBLEM_VALUE":15,"EVIDENCE":15,"MARKET":15,"REVENUE":15,"OPERATIONS":10,"FINANCE":15,"RISK":5,"COHERENCE":10}'::jsonb;
  else
    raise exception 'Boyut anahtarları CYCLE_ veya final ölçüt kodu olmalı';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(dimensions) as given(key)
    where not jsonb_exists(weights, given.key)
  ) or exists (
    select 1
    from jsonb_object_keys(weights) as expected(key)
    where not jsonb_exists(dimensions, expected.key)
  ) then
    raise exception 'Boyut kümesi rubrikle eşleşmiyor';
  end if;

  for key in select jsonb_object_keys(weights)
  loop
    weight := (weights ->> key)::integer;
    score := (dimensions ->> key)::integer;
    if score is null or score < 0 or score > 4 then
      raise exception 'Puan 0 ile 4 arasında olmalı';
    end if;
    total := total + (score * weight * 1000) / 4;
  end loop;

  return total;
end;
$$;

create or replace function public.scores_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_code text;
  submission_week integer;
  submission_version text;
begin
  select s.research_code, s.week_number, s.version_kind
    into submission_code, submission_week, submission_version
  from public.submissions s
  where s.id = new.submission_id;

  if submission_code is null then
    raise exception 'Gönderim bulunamadı';
  end if;
  if new.research_code is distinct from submission_code then
    raise exception 'Puan katılımcısı gönderimle eşleşmiyor';
  end if;

  if exists (
    select 1
    from public.missing_data_log m
    where m.research_code = new.research_code
      and m.week_number is not distinct from submission_week
      and (m.version_kind is null or m.version_kind = submission_version)
      and m.completion_status = 'MISSING'
  ) then
    raise exception 'Eksik gözleme puan yazılamaz';
  end if;

  new.total_score := public.compute_total_milli(new.dimension_scores);
  return new;
end;
$$;

create or replace function public.missing_matches_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual text;
begin
  select p.study_condition into actual
  from public.participants p
  where p.research_code = new.research_code;
  if actual is null then
    raise exception 'Katılımcı bulunamadı';
  end if;
  if actual is distinct from new.study_condition then
    raise exception 'Eksik kayıt koşulu katılımcıyla eşleşmiyor';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

create trigger participants_stamp_withdrawal
  before insert or update on public.participants
  for each row execute function public.stamp_withdrawal();

create trigger participants_require_ethics
  before insert on public.participants
  for each row execute function public.assert_research_enrollment_open();

create trigger identity_require_ethics
  before insert on public.research_identity_map
  for each row execute function public.assert_research_enrollment_open();

create trigger consents_require_ethics
  before insert on public.consents
  for each row execute function public.assert_research_enrollment_open();

create trigger consents_append_only
  before update or delete on public.consents
  for each row execute function public.reject_update_delete();

create trigger submissions_require_v0
  before insert on public.submissions
  for each row execute function public.require_v0_before_v1();

create trigger submissions_append_only
  before update or delete on public.submissions
  for each row execute function public.reject_update_delete();

create trigger events_append_only
  before update or delete on public.events
  for each row execute function public.reject_update_delete();

create trigger scores_before_insert
  before insert on public.scores
  for each row execute function public.scores_before_insert();

create trigger scores_append_only
  before update or delete on public.scores
  for each row execute function public.reject_update_delete();

create trigger missing_matches_participant
  before insert on public.missing_data_log
  for each row execute function public.missing_matches_participant();

create trigger missing_append_only
  before update or delete on public.missing_data_log
  for each row execute function public.reject_update_delete();

create trigger legacy_append_only
  before update or delete on public.legacy_sheet_import
  for each row execute function public.reject_update_delete();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.current_app_role() from public;
revoke all on function public.my_research_code() from public;
revoke all on function public.compute_total_milli(jsonb) from public;
revoke all on function public.scores_before_insert() from public;
revoke all on function public.assert_research_enrollment_open() from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.my_research_code() to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.research_identity_map enable row level security;
alter table public.research_identity_map force row level security;
alter table public.participants enable row level security;
alter table public.participants force row level security;
alter table public.consents enable row level security;
alter table public.consents force row level security;
alter table public.ethics_settings enable row level security;
alter table public.ethics_settings force row level security;
alter table public.weeks enable row level security;
alter table public.weeks force row level security;
alter table public.weekly_form_fields enable row level security;
alter table public.weekly_form_fields force row level security;
alter table public.submissions enable row level security;
alter table public.submissions force row level security;
alter table public.events enable row level security;
alter table public.events force row level security;
alter table public.scores enable row level security;
alter table public.scores force row level security;
alter table public.missing_data_log enable row level security;
alter table public.missing_data_log force row level security;
alter table public.legacy_sheet_import enable row level security;
alter table public.legacy_sheet_import force row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.current_app_role() in ('ADMIN', 'INSTRUCTOR')
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (
    id = auth.uid()
    or public.current_app_role() = 'ADMIN'
  )
  with check (
    public.current_app_role() = 'ADMIN'
    or (id = auth.uid() and role = public.current_app_role())
  );

create policy identity_admin_select on public.research_identity_map
  for select to authenticated
  using (public.current_app_role() = 'ADMIN');

create policy identity_admin_insert on public.research_identity_map
  for insert to authenticated
  with check (public.current_app_role() = 'ADMIN');

create policy identity_admin_update on public.research_identity_map
  for update to authenticated
  using (public.current_app_role() = 'ADMIN')
  with check (public.current_app_role() = 'ADMIN');

create policy identity_admin_delete on public.research_identity_map
  for delete to authenticated
  using (public.current_app_role() = 'ADMIN');

create policy participants_staff_select on public.participants
  for select to authenticated
  using (public.current_app_role() in ('ADMIN', 'INSTRUCTOR', 'RESEARCH_ANALYST'));

create policy participants_staff_insert on public.participants
  for insert to authenticated
  with check (public.current_app_role() in ('ADMIN', 'INSTRUCTOR'));

create policy participants_staff_update on public.participants
  for update to authenticated
  using (public.current_app_role() in ('ADMIN', 'INSTRUCTOR'))
  with check (public.current_app_role() in ('ADMIN', 'INSTRUCTOR'));

create policy consents_select on public.consents
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.current_app_role() in ('ADMIN', 'INSTRUCTOR')
  );

create policy consents_insert on public.consents
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.current_app_role() in ('ADMIN', 'INSTRUCTOR')
  );

create policy ethics_staff_select on public.ethics_settings
  for select to authenticated
  using (public.current_app_role() in ('ADMIN', 'INSTRUCTOR'));

create policy ethics_staff_update on public.ethics_settings
  for update to authenticated
  using (public.current_app_role() in ('ADMIN', 'INSTRUCTOR'))
  with check (public.current_app_role() in ('ADMIN', 'INSTRUCTOR'));

create policy weeks_select on public.weeks
  for select to authenticated
  using (
    public.current_app_role() in ('ADMIN', 'INSTRUCTOR', 'RESEARCH_ANALYST', 'EXPERT_EVALUATOR')
    or (public.current_app_role() = 'STUDENT' and is_active)
  );

create policy weeks_staff_update on public.weeks
  for update to authenticated
  using (public.current_app_role() in ('ADMIN', 'INSTRUCTOR'))
  with check (public.current_app_role() in ('ADMIN', 'INSTRUCTOR'));

create policy fields_select on public.weekly_form_fields
  for select to authenticated
  using (
    public.current_app_role() in ('ADMIN', 'INSTRUCTOR', 'RESEARCH_ANALYST', 'EXPERT_EVALUATOR')
    or (
      public.current_app_role() = 'STUDENT'
      and exists (
        select 1
        from public.weeks w
        where w.week_number = weekly_form_fields.week_number
          and w.is_active
      )
    )
  );

create policy submissions_select on public.submissions
  for select to authenticated
  using (
    research_code = public.my_research_code()
    or public.current_app_role() in ('ADMIN', 'INSTRUCTOR', 'RESEARCH_ANALYST')
  );

create policy submissions_insert on public.submissions
  for insert to authenticated
  with check (
    (
      public.current_app_role() = 'STUDENT'
      and research_code = public.my_research_code()
    )
    or public.current_app_role() in ('ADMIN', 'INSTRUCTOR')
  );

create policy events_select on public.events
  for select to authenticated
  using (
    research_code = public.my_research_code()
    or public.current_app_role() in ('ADMIN', 'INSTRUCTOR')
  );

create policy events_insert on public.events
  for insert to authenticated
  with check (
    (
      public.current_app_role() = 'STUDENT'
      and research_code = public.my_research_code()
    )
    or public.current_app_role() in ('ADMIN', 'INSTRUCTOR')
  );

create policy scores_staff_select on public.scores
  for select to authenticated
  using (public.current_app_role() in ('ADMIN', 'INSTRUCTOR', 'RESEARCH_ANALYST'));

create policy scores_staff_insert on public.scores
  for insert to authenticated
  with check (public.current_app_role() in ('ADMIN', 'INSTRUCTOR'));

create policy missing_staff_select on public.missing_data_log
  for select to authenticated
  using (public.current_app_role() in ('ADMIN', 'INSTRUCTOR', 'RESEARCH_ANALYST'));

create policy missing_staff_insert on public.missing_data_log
  for insert to authenticated
  with check (public.current_app_role() in ('ADMIN', 'INSTRUCTOR'));

create policy legacy_admin_select on public.legacy_sheet_import
  for select to authenticated
  using (public.current_app_role() = 'ADMIN');

create policy legacy_admin_insert on public.legacy_sheet_import
  for insert to authenticated
  with check (public.current_app_role() = 'ADMIN');

grant select, insert, update, delete on all tables in schema public to authenticated;

revoke update, delete on
  public.submissions,
  public.events,
  public.scores,
  public.consents,
  public.missing_data_log,
  public.legacy_sheet_import
from authenticated;

revoke insert, update, delete on public.ethics_settings from authenticated;
grant update on public.ethics_settings to authenticated;
