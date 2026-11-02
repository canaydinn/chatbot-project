-- Araştırma platformu şeması.
-- Bu dosya bir Supabase projesi açmaz. Bölge seçimi ve yurt dışı aktarım
-- hukuki onay olmadan uygulanmamalıdır.
-- Olay, puan ve kilitli gönderim kayıtları ekleme tabanlıdır.

create or replace function public.reject_update_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Bu kayıt ekleme tabanlıdır ve değiştirilemez';
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'STUDENT'
    check (role in ('STUDENT', 'INSTRUCTOR', 'ADMIN', 'EXPERT_EVALUATOR', 'RESEARCH_ANALYST')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_role() from public;
grant execute on function public.current_role() to authenticated;

create policy profiles_select_own_or_staff
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.current_role() in ('INSTRUCTOR', 'ADMIN')
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), 'STUDENT');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tek satır. Kayıt alma, aşağıdaki karar alanları dolmadan açılamaz.
create table public.study_settings (
  id integer primary key default 1 check (id = 1),
  active_week integer check (active_week between 1 and 10),
  -- V0, REVISION veya TEST. V0/V1 haftalarında REVISION yazılmadıkça yapay zeka kapalıdır.
  ai_phase text not null default 'V0' check (ai_phase in ('V0', 'REVISION', 'TEST')),
  control_feedback_source text,
  transfer_evaluator text,
  statistics_stack text check (statistics_stack in ('PYTHON', 'R') or statistics_stack is null),
  ethics_board_name text,
  ethics_approval_number text,
  ethics_approval_date date,
  consent_document_version text,
  content_conflict_resolved boolean not null default false,
  research_enrollment_open boolean not null default false,
  constraint enrollment_blocked_until_decisions check (
    research_enrollment_open = false
    or (
      control_feedback_source is not null
      and transfer_evaluator is not null
      and statistics_stack is not null
      and ethics_approval_number is not null
      and consent_document_version is not null
      and content_conflict_resolved = true
    )
  )
);

insert into public.study_settings (id) values (1);

alter table public.study_settings enable row level security;

create policy study_settings_staff_read
  on public.study_settings
  for select
  to authenticated
  using (public.current_role() in ('INSTRUCTOR', 'ADMIN'));

create table public.study_weeks (
  week_number integer primary key check (week_number between 1 and 10),
  title text not null,
  v0_v1_required boolean not null,
  deliverable text not null,
  form_fields jsonb not null,
  -- IMPORTED_FROM_FILE veya PENDING_APPROVAL. Çapa metinleri burada yoktur.
  content_status text not null check (content_status in ('IMPORTED_FROM_FILE', 'PENDING_APPROVAL'))
);

insert into public.study_weeks (week_number, title, v0_v1_required, deliverable, form_fields, content_status)
values
  (1, 'Girişimci ve araştırma çerçevesi', true, 'A.1, A.2, A.6 taslağı',
    '["Girişim adı ve aşaması","Kurucu/ekip katkısı ve kaynakları","Problem ve etkilenen aday müşteri","Başlangıç bölgesi ve mevcut alternatifler","İlk çözüm hipotezi","Misyon, vizyon, değerler ve planlanan yapı","Kısa, orta, uzun vadeli ölçülebilir hedefler"]'::jsonb,
    'IMPORTED_FROM_FILE'),
  (2, 'Değer önerisi ve iş modeli', false, 'A.3–A.5 ve güncellenmiş A bölümü',
    '["Hedef müşteri sonucu ve değer hipotezi","Ürün/hizmet birimi ve kapsamı","Dahil/hariç özellikler ve kullanım koşulları","Ödeyen kişi, gelir türü ve ücretlendirme birimi","Beklenen kullanım/tekrar sıklığı","Yenilik, koruma ve kuruluş gereksinimleri","Kaynak açıkları ve ilk uygulama adımları"]'::jsonb,
    'IMPORTED_FROM_FILE'),
  (3, 'Pazar evreni ve bölge', false, 'B.1 ve pazar hesap ekleri',
    '["Coğrafi hizmet alanı","Aday müşteri evreni ve dahil olma koşulları","Kaynaklı evren büyüklüğü ve tarih","Pazar eğilimleri ve dayanakları","TAM/SAM/SOM koşullu hesabı ve paydaları","Kritik dönüşüm oranları ve varsayımlar","Ankette doğrulanacak bilgi boşlukları"]'::jsonb,
    'IMPORTED_FROM_FILE'),
  (4, 'Rekabet ve anket tasarımı', false, 'B.2–B.3 taslağı ve anket dosyası',
    '["Doğrudan/dolaylı rakip ve alternatifler","Rakip karşılaştırma ölçütleri ve kaynakları","Farklılaşma ve rekabet engelleri","Anketin amacı ve hedef evreni","Soru metinleri, türleri ve kodları","Dallanma, uygunluk ve fiyat soruları","Örnekleme, dağıtım ve veri koruma planı","Anket prova kontrolü"]'::jsonb,
    'IMPORTED_FROM_FILE'),
  (5, 'Tek müşteri anketi', true, 'B.3 veri toplama kaydı ve analiz için veri seti',
    '["Kullanılan anket sürümü","Saha başlangıç/bitiş tarihleri","Dağıtım kanalı ve örnekleme yöntemi","Ulaşılan kişi ve yanıt sayıları","Uygun, elenen ve eksik yanıt sayıları","Anonimleştirilmiş veri seti","Saha kısıtları ve olası örneklem yanlılığı"]'::jsonb,
    'PENDING_APPROVAL'),
  (6, 'Veri analizi, pazarlama ve teknik tanım', false, 'B.4 ve C.1; güncellenmiş pazar varsayımları',
    '["Veri temizleme ve filtreleme kuralları","Segment, sorun, erişim ve fiyat analizleri","Paydalar, oranlar ve örneklem sınırlılıkları","Hedef segment ve konumlandırma","Fiyat ve gerekçesi","Dağıtım, tanıtım, satış ve müşteri ilişkileri","Dönemlik müşteri/satış tahmini","Teknik ürün/hizmet birimi ve kalite koşulları"]'::jsonb,
    'IMPORTED_FROM_FILE'),
  (7, 'Operasyon ve geliştirme', false, 'C.2–C.4 operasyon planı',
    '["Uçtan uca iş akışı ve sorumlular","İşlem süreleri, kaynaklar ve kapasite hesabı","Darboğazlar, arıza ve kesinti payı","Tedarikçiler, alternatifler ve servis koşulları","Kalite kontrol ve hata düzeltme süreci","Kuruluş yeri seçenekleri ve seçim gerekçesi","Geliştirme aşamaları, kilometre taşları ve kaynaklar"]'::jsonb,
    'IMPORTED_FROM_FILE'),
  (8, 'Organizasyon ve finansal model', false, 'D, E.1–E.4 ve A.5 güncellemesi',
    '["Organizasyon yapısı ve görev dağılımı","Pozisyon tanımları ve personel gereksinimi","İşgücü maliyeti ve dayanakları","Kuruluş/yatırım giderleri","Sabit ve değişken işletme giderleri","Birim ekonomi ve satış varsayımları","Aylık gelir–gider modeli","Tahsilat, ödeme, nakit akışı ve takvim"]'::jsonb,
    'IMPORTED_FROM_FILE'),
  (9, 'Finansal fizibilite ve finansman', true, 'E.5–E.9 ve güncellenmiş A.6',
    '["Katkı payı ve başa baş hesabı","Yıllık kâr/zarar ve nakit değerlendirmesi","Yatırım değerlendirme göstergeleri","Hesap girdileri, yöntemleri ve dönemler","Finansman gereksinimi ve kaynak seçenekleri","Finansman zamanlaması ve sahiplik etkisi","Duyarlılık, riskler ve kritik eşikler","Devam/revizyon/erteleme kararı"]'::jsonb,
    'PENDING_APPROVAL'),
  (10, 'Sonuç ve bütünsel denetim', false, 'F.1–F.2, nihai A–F iş planı',
    '["Yatırımcı/yönetici özeti","Güncel problem–müşteri–çözüm ve pazar","SWOT analizi","Pazar–satış–kapasite tutarlılık kontrolü","Fiyat–maliyet–kârlılık tutarlılık kontrolü","Kuruluş–finansman–takvim tutarlılık kontrolü","Kritik varsayımlar ve çözülmemiş riskler","Nihai girişim kararı ve gerekçesi","A–F bütünleşik plan ve kaynak ekleri"]'::jsonb,
    'IMPORTED_FROM_FILE');

alter table public.study_weeks enable row level security;

create policy study_weeks_read_active
  on public.study_weeks
  for select
  to authenticated
  using (
    public.current_role() in ('INSTRUCTOR', 'ADMIN', 'RESEARCH_ANALYST')
    or week_number = (select active_week from public.study_settings where id = 1)
  );

-- İş planı bölümleri, haftalık döngü boyutlarından ayrıdır.
create table public.plan_sections (
  code text primary key check (code in ('PLAN_A', 'PLAN_B', 'PLAN_C', 'PLAN_D', 'PLAN_E', 'PLAN_F')),
  title text not null
);

insert into public.plan_sections (code, title) values
  ('PLAN_A', 'Genel Bilgiler'),
  ('PLAN_B', 'Pazar Analizi'),
  ('PLAN_C', 'Teknik Analiz'),
  ('PLAN_D', 'Organizasyonel Analiz'),
  ('PLAN_E', 'Finansal Analiz'),
  ('PLAN_F', 'Sonuç');

create table public.cycle_dimensions (
  code text primary key check (code in ('CYCLE_A', 'CYCLE_B', 'CYCLE_C', 'CYCLE_D', 'CYCLE_E', 'CYCLE_F')),
  title text not null,
  weight_points integer not null check (weight_points >= 0),
  scored boolean not null
);

insert into public.cycle_dimensions (code, title, weight_points, scored) values
  ('CYCLE_A', 'Soruyu tanımla', 15, true),
  ('CYCLE_B', 'Kanıt topla', 25, true),
  ('CYCLE_C', 'Kararı gerekçelendir', 20, true),
  ('CYCLE_D', 'İş planı bölümünü geliştir', 25, true),
  ('CYCLE_E', 'Tutarlılığı ve revizyonları denetle', 15, true),
  ('CYCLE_F', 'Değerlendir ve geri bildirim ver', 0, false);

create table public.rubric_versions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('WEEKLY', 'FINAL', 'TRANSFER')),
  status text not null check (status in ('DRAFT', 'FROZEN')),
  anchor_status text not null default 'ONAY_BEKLIYOR',
  created_at timestamptz not null default now()
);

insert into public.rubric_versions (kind, status, anchor_status) values
  ('WEEKLY', 'DRAFT', 'ONAY_BEKLIYOR'),
  ('FINAL', 'DRAFT', 'ONAY_BEKLIYOR'),
  ('TRANSFER', 'DRAFT', 'ONAY_BEKLIYOR');

create table public.final_criteria (
  code text primary key,
  title text not null,
  weight_percent integer not null check (weight_percent > 0)
);

insert into public.final_criteria (code, title, weight_percent) values
  ('PROBLEM_VALUE', 'Problem ve değer mantığı', 15),
  ('EVIDENCE', 'Kanıt kalitesi', 15),
  ('MARKET', 'Pazar gerçekçiliği', 15),
  ('REVENUE', 'Ticarileşme ve gelir modeli', 15),
  ('OPERATIONS', 'Operasyonel uygulanabilirlik', 10),
  ('FINANCE', 'Finansal uygulanabilirlik', 15),
  ('RISK', 'Risk ve varsayım yönetimi', 5),
  ('COHERENCE', 'Bölümler arası tutarlılık', 10);

create table public.research_participants (
  research_code text primary key,
  study_condition text not null check (study_condition in ('CONTROL', 'RAG_ASSISTED')),
  form_sequence text check (form_sequence in ('AB', 'BA')),
  randomization_seed text not null,
  created_at timestamptz not null default now()
);

create table public.participant_status_events (
  id uuid primary key default gen_random_uuid(),
  research_code text not null references public.research_participants (research_code),
  status text not null check (status in (
    'ACTIVE', 'TEMPORARILY_INACTIVE', 'COURSE_WITHDRAWN', 'RESEARCH_WITHDRAWN', 'COMPLETED'
  )),
  recorded_at timestamptz not null default now()
);

create trigger participant_status_events_immutable
  before update or delete on public.participant_status_events
  for each row execute function public.reject_update_delete();

create table public.identity_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  research_code text not null unique references public.research_participants (research_code),
  linked_at timestamptz not null default now()
);

alter table public.identity_links enable row level security;
-- Kimlik eşleşmesi için authenticated politikası yok. Hizmet rolü RLS dışındadır.

create or replace function public.my_research_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select research_code
  from public.identity_links
  where user_id = auth.uid()
$$;

revoke all on function public.my_research_code() from public;
grant execute on function public.my_research_code() to authenticated;

create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_version text not null,
  decision text not null check (decision in ('ACCEPTED', 'DECLINED', 'WITHDRAWN')),
  recorded_at timestamptz not null default now()
);

create trigger consent_events_immutable
  before update or delete on public.consent_events
  for each row execute function public.reject_update_delete();

alter table public.consent_events enable row level security;

create policy consent_select_own
  on public.consent_events
  for select
  to authenticated
  using (user_id = auth.uid() or public.current_role() in ('INSTRUCTOR', 'ADMIN'));

create table public.submission_drafts (
  id uuid primary key default gen_random_uuid(),
  research_code text not null references public.research_participants (research_code),
  week_number integer not null check (week_number between 1 and 10),
  version_kind text not null check (version_kind in ('V0', 'V1', 'WEEKLY')),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (research_code, week_number, version_kind)
);

alter table public.submission_drafts enable row level security;

create policy drafts_own_student
  on public.submission_drafts
  for all
  to authenticated
  using (
    research_code = public.my_research_code()
    and public.current_role() = 'STUDENT'
  )
  with check (
    research_code = public.my_research_code()
    and public.current_role() = 'STUDENT'
  );

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  research_code text not null references public.research_participants (research_code),
  week_number integer not null check (week_number between 1 and 10),
  version_kind text not null check (version_kind in ('V0', 'V1', 'WEEKLY')),
  content jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (research_code, week_number, version_kind)
);

create or replace function public.require_v0_before_v1()
returns trigger
language plpgsql
as $$
begin
  if new.version_kind = 'V1' and not exists (
    select 1
    from public.submissions
    where research_code = new.research_code
      and week_number = new.week_number
      and version_kind = 'V0'
  ) then
    raise exception 'V1, kilitli bir V0 olmadan yazılamaz';
  end if;
  return new;
end;
$$;

create trigger submissions_require_v0
  before insert on public.submissions
  for each row execute function public.require_v0_before_v1();

create trigger submissions_immutable
  before update or delete on public.submissions
  for each row execute function public.reject_update_delete();

alter table public.submissions enable row level security;

create policy submissions_select_own
  on public.submissions
  for select
  to authenticated
  using (
    research_code = public.my_research_code()
    or public.current_role() in ('INSTRUCTOR', 'ADMIN')
  );

-- Sayısal puanlar. Eksik gözlem bu tabloya yazılmaz.
create table public.criterion_scores (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions (id),
  research_code text not null,
  rubric_version_id uuid not null references public.rubric_versions (id),
  criterion_code text not null,
  score_0_to_4 smallint not null check (score_0_to_4 between 0 and 4),
  rationale text not null,
  evaluator_kind text not null check (evaluator_kind in ('LLM', 'EXPERT', 'INSTRUCTOR')),
  model_id text,
  prompt_version text,
  recorded_at timestamptz not null default now()
);

create trigger criterion_scores_immutable
  before update or delete on public.criterion_scores
  for each row execute function public.reject_update_delete();

alter table public.criterion_scores enable row level security;

create policy criterion_scores_staff_only
  on public.criterion_scores
  for select
  to authenticated
  using (public.current_role() in ('INSTRUCTOR', 'ADMIN', 'RESEARCH_ANALYST'));

create table public.formative_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions (id),
  research_code text not null,
  body text not null,
  source text not null,
  model_id text,
  prompt_version text,
  recorded_at timestamptz not null default now()
);

create trigger formative_feedback_immutable
  before update or delete on public.formative_feedback
  for each row execute function public.reject_update_delete();

alter table public.formative_feedback enable row level security;

create policy formative_feedback_own_or_staff
  on public.formative_feedback
  for select
  to authenticated
  using (
    research_code = public.my_research_code()
    or public.current_role() in ('INSTRUCTOR', 'ADMIN')
  );

create table public.missing_observations (
  id uuid primary key default gen_random_uuid(),
  research_code text not null,
  week_number integer,
  assessment_type text not null,
  version_kind text,
  completion_status text not null check (completion_status in ('MISSING', 'PARTIAL')),
  missing_reason text not null check (missing_reason in (
    'NOT_SUBMITTED', 'PARTIAL_SUBMISSION', 'TECHNICAL_FAILURE', 'ABSENT',
    'COURSE_WITHDRAWAL', 'RESEARCH_WITHDRAWAL', 'EVALUATION_FAILURE', 'OTHER'
  )),
  missing_reason_source text not null,
  technical_incident_id text,
  recorded_at timestamptz not null default now()
);

create trigger missing_observations_immutable
  before update or delete on public.missing_observations
  for each row execute function public.reject_update_delete();

alter table public.missing_observations enable row level security;

create policy missing_observations_staff
  on public.missing_observations
  for select
  to authenticated
  using (public.current_role() in ('INSTRUCTOR', 'ADMIN', 'RESEARCH_ANALYST'));

create table public.blinded_plans (
  blinded_plan_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id),
  content jsonb not null,
  created_at timestamptz not null default now()
);

create table public.blinded_plan_links (
  blinded_plan_id uuid primary key references public.blinded_plans (blinded_plan_id),
  research_code text not null,
  study_condition text not null
);

alter table public.blinded_plan_links enable row level security;

create table public.expert_assignments (
  id uuid primary key default gen_random_uuid(),
  expert_user_id uuid not null references auth.users (id),
  blinded_plan_id uuid not null references public.blinded_plans (blinded_plan_id),
  unique (expert_user_id, blinded_plan_id)
);

alter table public.blinded_plans enable row level security;
alter table public.expert_assignments enable row level security;

create policy blinded_plans_assigned_expert
  on public.blinded_plans
  for select
  to authenticated
  using (
    exists (
      select 1 from public.expert_assignments a
      where a.blinded_plan_id = blinded_plans.blinded_plan_id
        and a.expert_user_id = auth.uid()
    )
    or public.current_role() in ('ADMIN', 'RESEARCH_ANALYST')
  );

create policy expert_assignments_own
  on public.expert_assignments
  for select
  to authenticated
  using (
    expert_user_id = auth.uid()
    or public.current_role() in ('ADMIN')
  );

create table public.ai_pricing_versions (
  id uuid primary key default gen_random_uuid(),
  model_id text not null,
  billing_mode text not null check (billing_mode in ('STANDARD', 'BATCH')),
  input_micro_usd_per_million bigint not null check (input_micro_usd_per_million >= 0),
  output_micro_usd_per_million bigint not null check (output_micro_usd_per_million >= 0),
  effective_on date not null,
  source_url text not null,
  unique (model_id, billing_mode, effective_on)
);

-- 10 Ekim 2026 resmi fiyatları. 1 USD = 1000000 mikro USD. 272 bin altı bağlam.
insert into public.ai_pricing_versions (
  model_id, billing_mode, input_micro_usd_per_million, output_micro_usd_per_million, effective_on, source_url
) values
  ('gpt-5.4', 'STANDARD', 2500000, 15000000, '2026-10-10', 'https://developers.openai.com/api/docs/pricing'),
  ('gpt-5.4', 'BATCH', 1250000, 7500000, '2026-10-10', 'https://developers.openai.com/api/docs/pricing'),
  ('gpt-5.4-nano', 'STANDARD', 200000, 1250000, '2026-10-10', 'https://developers.openai.com/api/docs/pricing'),
  ('gpt-4o-mini', 'STANDARD', 150000, 600000, '2026-10-10', 'https://developers.openai.com/api/docs/pricing'),
  ('claude-sonnet-5-5', 'STANDARD', 2000000, 10000000, '2026-10-10', 'https://platform.claude.com/docs/en/about-claude/pricing'),
  ('claude-sonnet-5-5', 'BATCH', 1000000, 5000000, '2026-10-10', 'https://platform.claude.com/docs/en/about-claude/pricing'),
  ('text-embedding-3-small', 'STANDARD', 20000, 0, '2026-10-10', 'https://developers.openai.com/api/docs/pricing');

create table public.ai_budget_policies (
  id integer primary key default 1 check (id = 1),
  global_cap_micro_usd bigint not null check (global_cap_micro_usd = 50000000),
  rag_cap_micro_usd bigint not null,
  weekly_eval_cap_micro_usd bigint not null,
  transfer_eval_cap_micro_usd bigint not null,
  final_eval_cap_micro_usd bigint not null,
  contingency_cap_micro_usd bigint not null,
  emergency_stop boolean not null default false,
  constraint caps_sum_to_global check (
    rag_cap_micro_usd + weekly_eval_cap_micro_usd + transfer_eval_cap_micro_usd
      + final_eval_cap_micro_usd + contingency_cap_micro_usd = global_cap_micro_usd
  )
);

insert into public.ai_budget_policies (
  id, global_cap_micro_usd, rag_cap_micro_usd, weekly_eval_cap_micro_usd,
  transfer_eval_cap_micro_usd, final_eval_cap_micro_usd, contingency_cap_micro_usd
) values (
  1, 50000000, 30000000, 6000000, 4000000, 6000000, 4000000
);

alter table public.ai_budget_policies enable row level security;

create policy budget_staff_read
  on public.ai_budget_policies
  for select
  to authenticated
  using (public.current_role() in ('INSTRUCTOR', 'ADMIN'));

create table public.ai_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  model_id text not null,
  reserved_micro_usd bigint not null check (reserved_micro_usd >= 0),
  status text not null check (status in ('RESERVED', 'RECONCILED', 'RELEASED')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.ai_budget_reservations (id),
  category text not null,
  model_id text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  actual_micro_usd bigint not null check (actual_micro_usd >= 0),
  recorded_at timestamptz not null default now()
);

create trigger ai_usage_events_immutable
  before update or delete on public.ai_usage_events
  for each row execute function public.reject_update_delete();

alter table public.ai_usage_events enable row level security;

create policy ai_usage_staff_read
  on public.ai_usage_events
  for select
  to authenticated
  using (public.current_role() in ('INSTRUCTOR', 'ADMIN'));

create table public.legacy_sheet_import (
  id uuid primary key default gen_random_uuid(),
  email text,
  first_name text,
  last_name text,
  raw_row jsonb not null,
  imported_at timestamptz not null default now()
);

alter table public.legacy_sheet_import enable row level security;

create policy legacy_import_admin
  on public.legacy_sheet_import
  for select
  to authenticated
  using (public.current_role() = 'ADMIN');

-- Ağırlıklı toplam, 100 puanın binde biri cinsinden tam sayıdır. Azami 100000.
create or replace function public.weighted_total_milli(scores integer[], weights integer[])
returns integer
language plpgsql
immutable
as $$
declare
  i integer;
  total integer := 0;
begin
  if array_length(scores, 1) is distinct from array_length(weights, 1) then
    raise exception 'Puan ve ağırlık sayısı eşleşmiyor';
  end if;
  for i in 1..array_length(scores, 1) loop
    if scores[i] < 0 or scores[i] > 4 then
      raise exception 'Puan 0 ile 4 arasında olmalı';
    end if;
    total := total + (scores[i] * weights[i] * 1000) / 4;
  end loop;
  return total;
end;
$$;
