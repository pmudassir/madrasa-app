create extension if not exists pgcrypto;

create or replace function public.current_madrasa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select madrasa_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.current_user_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(full_name, 'System')
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create table if not exists public.collectors (
  id uuid primary key default gen_random_uuid(),
  madrasa_id uuid not null references public.madrasas(id) on delete cascade,
  name text not null,
  phone text,
  whatsapp_no text,
  notes text,
  opening_balance numeric(12, 2) not null default 0,
  current_balance numeric(12, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.collector_transfers (
  id uuid primary key default gen_random_uuid(),
  madrasa_id uuid not null references public.madrasas(id) on delete cascade,
  transfer_no text not null,
  from_collector_id uuid not null references public.collectors(id) on delete restrict,
  to_collector_id uuid not null references public.collectors(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  transfer_date date not null,
  note text,
  receipt_pdf_path text,
  created_at timestamptz not null default now(),
  unique (madrasa_id, transfer_no),
  check (from_collector_id <> to_collector_id)
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  madrasa_id uuid not null references public.madrasas(id) on delete cascade,
  head_name text not null,
  phone_no text,
  whatsapp_no text,
  job text,
  financial_grade text not null check (financial_grade in ('A', 'B', 'C', 'D')),
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  relation text not null,
  age integer check (age is null or age >= 0),
  phone_no text,
  status text not null default 'none' check (status in ('working', 'studying', 'none')),
  class_or_work_details text,
  created_at timestamptz not null default now()
);

create table if not exists public.number_sequences (
  id uuid primary key default gen_random_uuid(),
  madrasa_id uuid not null references public.madrasas(id) on delete cascade,
  sequence_type text not null,
  last_value bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (madrasa_id, sequence_type)
);

create table if not exists public.student_fee_dues (
  id uuid primary key default gen_random_uuid(),
  madrasa_id uuid not null references public.madrasas(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_type text not null check (fee_type in ('admission', 'monthly')),
  due_month integer check (due_month is null or due_month between 1 and 12),
  due_year integer check (due_year is null or due_year >= 2000),
  due_amount numeric(12, 2) not null default 0,
  collected_amount numeric(12, 2) not null default 0,
  outstanding_amount numeric(12, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_fee_dues_monthly_unique
  on public.student_fee_dues(student_id, fee_type, due_year, due_month)
  where fee_type = 'monthly';

create unique index if not exists student_fee_dues_admission_unique
  on public.student_fee_dues(student_id, fee_type)
  where fee_type = 'admission';

create index if not exists collectors_madrasa_id_idx on public.collectors(madrasa_id);
create index if not exists collector_transfers_madrasa_id_idx on public.collector_transfers(madrasa_id, transfer_date desc);
create index if not exists families_madrasa_id_idx on public.families(madrasa_id);
create index if not exists family_members_family_id_idx on public.family_members(family_id);
create index if not exists student_fee_dues_madrasa_id_idx on public.student_fee_dues(madrasa_id, due_year desc, due_month desc);

alter table public.students
  add column if not exists admission_no text,
  add column if not exists admission_date date,
  add column if not exists admission_fee numeric(12, 2) not null default 0,
  add column if not exists monthly_fee numeric(12, 2) not null default 0,
  add column if not exists father_name text,
  add column if not exists mother_name text,
  add column if not exists phone_no text,
  add column if not exists class_level text;

alter table public.events
  add column if not exists host text,
  add column if not exists scholar_name text;

alter table public.donations
  add column if not exists status text not null default 'collected' check (status in ('offered', 'collected')),
  add column if not exists collected_by_collector_id uuid references public.collectors(id) on delete set null,
  add column if not exists receipt_no text,
  add column if not exists receipt_pdf_path text,
  add column if not exists offered_at date,
  add column if not exists collected_at date;

alter table public.expenses
  add column if not exists paid_by_collector_id uuid references public.collectors(id) on delete set null;

alter table public.fee_payments
  add column if not exists due_id uuid references public.student_fee_dues(id) on delete set null,
  add column if not exists collected_by_collector_id uuid references public.collectors(id) on delete set null,
  add column if not exists receipt_no text,
  add column if not exists receipt_pdf_path text,
  add column if not exists billing_month integer,
  add column if not exists billing_year integer,
  add column if not exists fee_type text check (fee_type in ('admission', 'monthly')),
  add column if not exists collected_at date;

update public.students
set
  father_name = coalesce(father_name, parent_name),
  phone_no = coalesce(phone_no, parent_phone),
  admission_date = coalesce(admission_date, joined_at::date, created_at::date),
  class_level = coalesce(
    class_level,
    case
      when class in ('1','2','3','4','5','6','7','8','9','10','+1','+2') then class
      when class ilike 'class 1%' then '1'
      when class ilike 'class 2%' then '2'
      when class ilike 'class 3%' then '3'
      when class ilike 'class 4%' then '4'
      when class ilike 'class 5%' then '5'
      when class ilike 'class 6%' then '6'
      when class ilike 'class 7%' then '7'
      when class ilike 'class 8%' then '8'
      when class ilike 'class 9%' then '9'
      when class ilike 'class 10%' then '10'
      else class
    end
  )
where true;

with numbered as (
  select
    id,
    madrasa_id,
    row_number() over (partition by madrasa_id order by created_at, id) as rn
  from public.students
)
update public.students s
set admission_no = coalesce(s.admission_no, 'ADM-' || lpad(numbered.rn::text, 6, '0'))
from numbered
where s.id = numbered.id;

update public.donations
set
  offered_at = coalesce(offered_at, created_at::date),
  collected_at = case
    when status = 'collected' then coalesce(collected_at, created_at::date)
    else collected_at
  end
where true;

update public.fee_payments
set
  collected_at = coalesce(collected_at, fee_date),
  fee_type = coalesce(fee_type, 'monthly'),
  billing_month = coalesce(billing_month, extract(month from fee_date)::int),
  billing_year = coalesce(billing_year, extract(year from fee_date)::int)
where true;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_number_sequences_touch_updated_at on public.number_sequences;
create trigger trg_number_sequences_touch_updated_at
before update on public.number_sequences
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_student_fee_dues_touch_updated_at on public.student_fee_dues;
create trigger trg_student_fee_dues_touch_updated_at
before update on public.student_fee_dues
for each row
execute function public.touch_updated_at();

create or replace function public.write_activity_entry(
  p_madrasa_id uuid,
  p_category text,
  p_description text,
  p_entity_type text default null,
  p_entity_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (
    madrasa_id,
    user_name,
    category,
    description,
    entity_type,
    entity_id
  )
  values (
    p_madrasa_id,
    coalesce(public.current_user_name(), 'System'),
    p_category,
    p_description,
    p_entity_type,
    p_entity_id
  );
end;
$$;

create or replace function public.allocate_next_number(
  p_madrasa_id uuid,
  p_sequence_type text,
  p_prefix text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  insert into public.number_sequences (madrasa_id, sequence_type, last_value)
  values (p_madrasa_id, p_sequence_type, 1)
  on conflict (madrasa_id, sequence_type)
  do update set
    last_value = public.number_sequences.last_value + 1,
    updated_at = now()
  returning last_value into v_next;

  return p_prefix || '-' || lpad(v_next::text, 6, '0');
end;
$$;

create or replace function public.adjust_collector_balance(
  p_collector_id uuid,
  p_delta numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.collectors
  set current_balance = current_balance + p_delta
  where id = p_collector_id;
end;
$$;

create or replace function public.sync_due_status(p_due_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due public.student_fee_dues%rowtype;
begin
  select *
  into v_due
  from public.student_fee_dues
  where id = p_due_id;

  if not found then
    return;
  end if;

  update public.student_fee_dues
  set
    outstanding_amount = greatest(v_due.due_amount - v_due.collected_amount, 0),
    status = case
      when v_due.collected_amount <= 0 then 'pending'
      when v_due.collected_amount >= v_due.due_amount then 'paid'
      else 'partial'
    end
  where id = p_due_id;
end;
$$;

create or replace function public.sync_student_fee_dues(
  p_student_id uuid,
  p_through_year integer,
  p_through_month integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_through_date date;
  v_rows integer := 0;
begin
  select *
  into v_student
  from public.students
  where id = p_student_id;

  if not found then
    raise exception 'Student not found';
  end if;

  if p_through_month < 1 or p_through_month > 12 then
    raise exception 'Invalid month';
  end if;

  v_through_date := make_date(p_through_year, p_through_month, 1);

  if v_student.admission_fee > 0 then
    insert into public.student_fee_dues (
      madrasa_id,
      student_id,
      fee_type,
      due_amount,
      collected_amount,
      outstanding_amount,
      status
    )
    values (
      v_student.madrasa_id,
      v_student.id,
      'admission',
      v_student.admission_fee,
      0,
      v_student.admission_fee,
      'pending'
    )
    on conflict do nothing;
  end if;

  if v_student.monthly_fee > 0 and v_student.admission_date is not null and date_trunc('month', v_student.admission_date)::date <= v_through_date then
    insert into public.student_fee_dues (
      madrasa_id,
      student_id,
      fee_type,
      due_month,
      due_year,
      due_amount,
      collected_amount,
      outstanding_amount,
      status
    )
    select
      v_student.madrasa_id,
      v_student.id,
      'monthly',
      extract(month from gs)::int,
      extract(year from gs)::int,
      v_student.monthly_fee,
      0,
      v_student.monthly_fee,
      'pending'
    from generate_series(
      date_trunc('month', v_student.admission_date)::date,
      v_through_date,
      interval '1 month'
    ) as gs
    on conflict do nothing;
  end if;

  get diagnostics v_rows = row_count;

  return v_rows;
end;
$$;

create or replace function public.sync_madrasa_fee_dues(
  p_madrasa_id uuid,
  p_through_year integer,
  p_through_month integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_total integer := 0;
begin
  if p_madrasa_id is distinct from public.current_madrasa_id() then
    raise exception 'Unauthorized madrasa access';
  end if;

  for v_student in
    select id
    from public.students
    where madrasa_id = p_madrasa_id
      and is_active = true
  loop
    v_total := v_total + public.sync_student_fee_dues(v_student.id, p_through_year, p_through_month);
  end loop;

  return v_total;
end;
$$;

create or replace function public.issue_receipt_number(
  p_sequence_type text,
  p_prefix text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_madrasa_id uuid := public.current_madrasa_id();
  v_receipt_no text;
begin
  if v_madrasa_id is null then
    raise exception 'Profile not found';
  end if;

  if p_sequence_type not in ('fee_receipt', 'donation_receipt', 'collector_transfer') then
    raise exception 'Invalid sequence type';
  end if;

  v_receipt_no := public.allocate_next_number(v_madrasa_id, p_sequence_type, p_prefix);

  return jsonb_build_object(
    'receipt_no', v_receipt_no,
    'madrasa_id', v_madrasa_id
  );
end;
$$;

create or replace function public.create_collector_entry(
  p_name text,
  p_phone text default null,
  p_whatsapp_no text default null,
  p_notes text default null,
  p_opening_balance numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_madrasa_id uuid := public.current_madrasa_id();
  v_row public.collectors%rowtype;
begin
  if v_madrasa_id is null then
    raise exception 'Profile not found';
  end if;

  insert into public.collectors (
    madrasa_id,
    name,
    phone,
    whatsapp_no,
    notes,
    opening_balance,
    current_balance
  )
  values (
    v_madrasa_id,
    trim(p_name),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_whatsapp_no, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(p_opening_balance, 0),
    coalesce(p_opening_balance, 0)
  )
  returning * into v_row;

  perform public.write_activity_entry(v_madrasa_id, 'financial', 'Added collector: ' || v_row.name, 'collector', v_row.id::text);

  return jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'current_balance', v_row.current_balance
  );
end;
$$;

create or replace function public.create_student_admission_entry(
  p_name text,
  p_class_level text,
  p_admission_date date,
  p_admission_fee numeric,
  p_monthly_fee numeric,
  p_father_name text default null,
  p_mother_name text default null,
  p_phone_no text default null,
  p_date_of_birth date default null,
  p_gender text default null,
  p_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_madrasa_id uuid := public.current_madrasa_id();
  v_admission_no text;
  v_row public.students%rowtype;
begin
  if v_madrasa_id is null then
    raise exception 'Profile not found';
  end if;

  if p_class_level not in ('1','2','3','4','5','6','7','8','9','10','+1','+2') then
    raise exception 'Invalid class level';
  end if;

  v_admission_no := public.allocate_next_number(v_madrasa_id, 'admission', 'ADM');

  insert into public.students (
    madrasa_id,
    name,
    class,
    class_level,
    admission_no,
    admission_date,
    admission_fee,
    monthly_fee,
    father_name,
    mother_name,
    phone_no,
    parent_name,
    parent_phone,
    date_of_birth,
    gender,
    address,
    joined_at,
    is_active
  )
  values (
    v_madrasa_id,
    trim(p_name),
    p_class_level,
    p_class_level,
    v_admission_no,
    p_admission_date,
    coalesce(p_admission_fee, 0),
    coalesce(p_monthly_fee, 0),
    nullif(trim(coalesce(p_father_name, '')), ''),
    nullif(trim(coalesce(p_mother_name, '')), ''),
    nullif(trim(coalesce(p_phone_no, '')), ''),
    nullif(trim(coalesce(p_father_name, '')), ''),
    nullif(trim(coalesce(p_phone_no, '')), ''),
    p_date_of_birth,
    nullif(trim(coalesce(p_gender, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    p_admission_date::text,
    true
  )
  returning * into v_row;

  perform public.sync_student_fee_dues(
    v_row.id,
    extract(year from p_admission_date)::int,
    extract(month from p_admission_date)::int
  );

  perform public.write_activity_entry(v_madrasa_id, 'students', 'Added admission: ' || v_row.name || ' (' || v_admission_no || ')', 'student', v_row.id::text);

  return jsonb_build_object(
    'id', v_row.id,
    'admission_no', v_row.admission_no
  );
end;
$$;

create or replace function public.record_fee_payment_entry(
  p_student_id uuid,
  p_due_id uuid,
  p_amount numeric,
  p_collected_by uuid,
  p_collected_at date,
  p_receipt_no text,
  p_receipt_pdf_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due public.student_fee_dues%rowtype;
  v_student public.students%rowtype;
  v_collector public.collectors%rowtype;
  v_receipt_no text;
  v_payment_id uuid;
begin
  select * into v_due from public.student_fee_dues where id = p_due_id;
  if not found then
    raise exception 'Fee due not found';
  end if;

  select * into v_student from public.students where id = p_student_id;
  if not found then
    raise exception 'Student not found';
  end if;

  if v_student.madrasa_id is distinct from public.current_madrasa_id() then
    raise exception 'Unauthorized madrasa access';
  end if;

  if v_due.madrasa_id is distinct from v_student.madrasa_id then
    raise exception 'Due item does not belong to student madrasa';
  end if;

  select * into v_collector from public.collectors where id = p_collected_by and madrasa_id = v_student.madrasa_id;
  if not found then
    raise exception 'Collector not found';
  end if;

  if v_due.student_id <> p_student_id then
    raise exception 'Due item does not belong to student';
  end if;

  if p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  if p_amount > v_due.outstanding_amount then
    raise exception 'Amount exceeds outstanding amount';
  end if;

  if nullif(trim(coalesce(p_receipt_no, '')), '') is null then
    raise exception 'Receipt number is required';
  end if;

  v_receipt_no := trim(p_receipt_no);

  insert into public.fee_payments (
    madrasa_id,
    student_id,
    description,
    amount,
    status,
    fee_date,
    due_id,
    collected_by_collector_id,
    receipt_no,
    receipt_pdf_path,
    billing_month,
    billing_year,
    fee_type,
    collected_at
  )
  values (
    v_student.madrasa_id,
    p_student_id,
    case
      when v_due.fee_type = 'admission' then 'Admission fee'
      else 'Monthly fee'
    end,
    p_amount,
    'paid',
    p_collected_at,
    p_due_id,
    p_collected_by,
    v_receipt_no,
    nullif(trim(coalesce(p_receipt_pdf_path, '')), ''),
    v_due.due_month,
    v_due.due_year,
    v_due.fee_type,
    p_collected_at
  )
  returning id into v_payment_id;

  update public.student_fee_dues
  set collected_amount = collected_amount + p_amount
  where id = p_due_id;

  perform public.sync_due_status(p_due_id);
  perform public.adjust_collector_balance(p_collected_by, p_amount);
  perform public.write_activity_entry(v_student.madrasa_id, 'financial', 'Collected fee ' || v_receipt_no || ' for ' || v_student.name, 'fee_payment', v_payment_id::text);

  return jsonb_build_object(
    'id', v_payment_id,
    'receipt_no', v_receipt_no,
    'madrasa_id', v_student.madrasa_id
  );
end;
$$;

create or replace function public.create_event_entry(
  p_title text,
  p_description text,
  p_event_date date,
  p_host text default null,
  p_scholar_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_madrasa_id uuid := public.current_madrasa_id();
  v_event_id uuid;
begin
  if v_madrasa_id is null then
    raise exception 'Profile not found';
  end if;

  insert into public.events (
    madrasa_id,
    title,
    description,
    event_date,
    host,
    scholar_name
  )
  values (
    v_madrasa_id,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_event_date,
    nullif(trim(coalesce(p_host, '')), ''),
    nullif(trim(coalesce(p_scholar_name, '')), '')
  )
  returning id into v_event_id;

  perform public.write_activity_entry(v_madrasa_id, 'events', 'Created event: ' || p_title, 'event', v_event_id::text);

  return jsonb_build_object('id', v_event_id);
end;
$$;

create or replace function public.create_donation_entry(
  p_event_id uuid,
  p_donor_name text,
  p_amount numeric,
  p_notes text,
  p_status text,
  p_collected_by uuid default null,
  p_effective_date date default null,
  p_receipt_no text default null,
  p_receipt_pdf_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_collector public.collectors%rowtype;
  v_receipt_no text;
  v_donation_id uuid;
  v_effective date := coalesce(p_effective_date, current_date);
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found';
  end if;

  if v_event.madrasa_id is distinct from public.current_madrasa_id() then
    raise exception 'Unauthorized madrasa access';
  end if;

  if p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  if p_status not in ('offered', 'collected') then
    raise exception 'Invalid donation status';
  end if;

  if p_status = 'collected' then
    if p_collected_by is null then
      raise exception 'Collector is required';
    end if;
    select * into v_collector from public.collectors where id = p_collected_by and madrasa_id = v_event.madrasa_id;
    if not found then
      raise exception 'Collector not found';
    end if;

    if nullif(trim(coalesce(p_receipt_no, '')), '') is null then
      raise exception 'Receipt number is required';
    end if;

    v_receipt_no := trim(p_receipt_no);
  end if;

  insert into public.donations (
    event_id,
    madrasa_id,
    donor_name,
    amount,
    notes,
    status,
    collected_by_collector_id,
    receipt_no,
    receipt_pdf_path,
    offered_at,
    collected_at
  )
  values (
    p_event_id,
    v_event.madrasa_id,
    nullif(trim(coalesce(p_donor_name, '')), ''),
    p_amount,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_status,
    case when p_status = 'collected' then p_collected_by else null end,
    v_receipt_no,
    case when p_status = 'collected' then nullif(trim(coalesce(p_receipt_pdf_path, '')), '') else null end,
    case when p_status = 'offered' then v_effective else null end,
    case when p_status = 'collected' then v_effective else null end
  )
  returning id into v_donation_id;

  if p_status = 'collected' then
    perform public.adjust_collector_balance(p_collected_by, p_amount);
    perform public.write_activity_entry(v_event.madrasa_id, 'financial', 'Collected donation ' || v_receipt_no || ' for ' || v_event.title, 'donation', v_donation_id::text);
  else
    perform public.write_activity_entry(v_event.madrasa_id, 'events', 'Recorded offered donation for ' || v_event.title, 'donation', v_donation_id::text);
  end if;

  return jsonb_build_object(
    'id', v_donation_id,
    'receipt_no', v_receipt_no,
    'madrasa_id', v_event.madrasa_id
  );
end;
$$;

create or replace function public.collect_offered_donation_entry(
  p_donation_id uuid,
  p_collected_by uuid,
  p_collected_at date,
  p_receipt_no text,
  p_receipt_pdf_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_donation public.donations%rowtype;
  v_collector public.collectors%rowtype;
  v_receipt_no text;
begin
  select * into v_donation from public.donations where id = p_donation_id;
  if not found then
    raise exception 'Donation not found';
  end if;

  if v_donation.madrasa_id is distinct from public.current_madrasa_id() then
    raise exception 'Unauthorized madrasa access';
  end if;

  if v_donation.status <> 'offered' then
    raise exception 'Donation is already collected';
  end if;

  select * into v_collector from public.collectors where id = p_collected_by and madrasa_id = v_donation.madrasa_id;
  if not found then
    raise exception 'Collector not found';
  end if;

  if nullif(trim(coalesce(p_receipt_no, '')), '') is null then
    raise exception 'Receipt number is required';
  end if;

  v_receipt_no := trim(p_receipt_no);

  update public.donations
  set
    status = 'collected',
    collected_by_collector_id = p_collected_by,
    collected_at = p_collected_at,
    receipt_no = v_receipt_no,
    receipt_pdf_path = nullif(trim(coalesce(p_receipt_pdf_path, '')), '')
  where id = p_donation_id;

  perform public.adjust_collector_balance(p_collected_by, v_donation.amount);
  perform public.write_activity_entry(v_donation.madrasa_id, 'financial', 'Collected offered donation ' || v_receipt_no, 'donation', p_donation_id::text);

  return jsonb_build_object(
    'id', p_donation_id,
    'receipt_no', v_receipt_no,
    'madrasa_id', v_donation.madrasa_id
  );
end;
$$;

create or replace function public.record_expense_entry(
  p_category text,
  p_description text,
  p_amount numeric,
  p_expense_date date,
  p_paid_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collector public.collectors%rowtype;
  v_expense_id uuid;
begin
  select * into v_collector from public.collectors where id = p_paid_by;
  if not found then
    raise exception 'Collector not found';
  end if;

  if v_collector.madrasa_id is distinct from public.current_madrasa_id() then
    raise exception 'Unauthorized madrasa access';
  end if;

  if p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  if v_collector.current_balance < p_amount then
    raise exception 'Insufficient collector balance';
  end if;

  insert into public.expenses (
    madrasa_id,
    category,
    description,
    amount,
    expense_date,
    paid_by_collector_id
  )
  values (
    v_collector.madrasa_id,
    p_category,
    nullif(trim(coalesce(p_description, '')), ''),
    p_amount,
    p_expense_date,
    p_paid_by
  )
  returning id into v_expense_id;

  perform public.adjust_collector_balance(p_paid_by, -p_amount);
  perform public.write_activity_entry(v_collector.madrasa_id, 'financial', 'Recorded expense of ₹' || p_amount::text, 'expense', v_expense_id::text);

  return jsonb_build_object(
    'id', v_expense_id,
    'madrasa_id', v_collector.madrasa_id
  );
end;
$$;

create or replace function public.transfer_collector_balance_entry(
  p_from_collector_id uuid,
  p_to_collector_id uuid,
  p_amount numeric,
  p_transfer_date date,
  p_note text default null,
  p_transfer_no text default null,
  p_receipt_pdf_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from public.collectors%rowtype;
  v_to public.collectors%rowtype;
  v_transfer_no text;
  v_transfer_id uuid;
begin
  select * into v_from from public.collectors where id = p_from_collector_id;
  if not found then
    raise exception 'Sender collector not found';
  end if;

  if v_from.madrasa_id is distinct from public.current_madrasa_id() then
    raise exception 'Unauthorized madrasa access';
  end if;

  select * into v_to from public.collectors where id = p_to_collector_id and madrasa_id = v_from.madrasa_id;
  if not found then
    raise exception 'Receiver collector not found';
  end if;

  if p_from_collector_id = p_to_collector_id then
    raise exception 'Transfer requires two different collectors';
  end if;

  if p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  if v_from.current_balance < p_amount then
    raise exception 'Insufficient collector balance';
  end if;

  if nullif(trim(coalesce(p_transfer_no, '')), '') is null then
    raise exception 'Transfer number is required';
  end if;

  v_transfer_no := trim(p_transfer_no);

  insert into public.collector_transfers (
    madrasa_id,
    transfer_no,
    from_collector_id,
    to_collector_id,
    amount,
    transfer_date,
    note,
    receipt_pdf_path
  )
  values (
    v_from.madrasa_id,
    v_transfer_no,
    p_from_collector_id,
    p_to_collector_id,
    p_amount,
    p_transfer_date,
    nullif(trim(coalesce(p_note, '')), ''),
    nullif(trim(coalesce(p_receipt_pdf_path, '')), '')
  )
  returning id into v_transfer_id;

  perform public.adjust_collector_balance(p_from_collector_id, -p_amount);
  perform public.adjust_collector_balance(p_to_collector_id, p_amount);
  perform public.write_activity_entry(v_from.madrasa_id, 'financial', 'Transferred ' || v_transfer_no || ' from ' || v_from.name || ' to ' || v_to.name, 'collector_transfer', v_transfer_id::text);

  return jsonb_build_object(
    'id', v_transfer_id,
    'transfer_no', v_transfer_no,
    'madrasa_id', v_from.madrasa_id
  );
end;
$$;

create or replace function public.save_family_entry(
  p_family_id uuid default null,
  p_head_name text default null,
  p_phone_no text default null,
  p_whatsapp_no text default null,
  p_job text default null,
  p_financial_grade text default 'C',
  p_address text default null,
  p_notes text default null,
  p_members jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_madrasa_id uuid := public.current_madrasa_id();
  v_family_id uuid := p_family_id;
  v_member jsonb;
begin
  if v_madrasa_id is null then
    raise exception 'Profile not found';
  end if;

  if nullif(trim(coalesce(p_head_name, '')), '') is null then
    raise exception 'Head name is required';
  end if;

  if p_financial_grade not in ('A', 'B', 'C', 'D') then
    raise exception 'Invalid family grade';
  end if;

  if v_family_id is null then
    insert into public.families (
      madrasa_id,
      head_name,
      phone_no,
      whatsapp_no,
      job,
      financial_grade,
      address,
      notes
    )
    values (
      v_madrasa_id,
      trim(p_head_name),
      nullif(trim(coalesce(p_phone_no, '')), ''),
      nullif(trim(coalesce(p_whatsapp_no, '')), ''),
      nullif(trim(coalesce(p_job, '')), ''),
      p_financial_grade,
      nullif(trim(coalesce(p_address, '')), ''),
      nullif(trim(coalesce(p_notes, '')), '')
    )
    returning id into v_family_id;

    perform public.write_activity_entry(v_madrasa_id, 'settings', 'Added family: ' || trim(p_head_name), 'family', v_family_id::text);
  else
    update public.families
    set
      head_name = trim(p_head_name),
      phone_no = nullif(trim(coalesce(p_phone_no, '')), ''),
      whatsapp_no = nullif(trim(coalesce(p_whatsapp_no, '')), ''),
      job = nullif(trim(coalesce(p_job, '')), ''),
      financial_grade = p_financial_grade,
      address = nullif(trim(coalesce(p_address, '')), ''),
      notes = nullif(trim(coalesce(p_notes, '')), '')
    where id = v_family_id
      and madrasa_id = v_madrasa_id;

    if not found then
      raise exception 'Family not found';
    end if;

    delete from public.family_members where family_id = v_family_id;
    perform public.write_activity_entry(v_madrasa_id, 'settings', 'Updated family: ' || trim(p_head_name), 'family', v_family_id::text);
  end if;

  if jsonb_typeof(coalesce(p_members, '[]'::jsonb)) <> 'array' then
    raise exception 'Members payload must be an array';
  end if;

  for v_member in
    select value
    from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    if nullif(trim(coalesce(v_member->>'name', '')), '') is null or nullif(trim(coalesce(v_member->>'relation', '')), '') is null then
      continue;
    end if;

    if coalesce(v_member->>'status', 'none') not in ('working', 'studying', 'none') then
      raise exception 'Invalid family member status';
    end if;

    insert into public.family_members (
      family_id,
      name,
      relation,
      age,
      phone_no,
      status,
      class_or_work_details
    )
    values (
      v_family_id,
      trim(v_member->>'name'),
      trim(v_member->>'relation'),
      case
        when nullif(trim(coalesce(v_member->>'age', '')), '') is null then null
        else (v_member->>'age')::integer
      end,
      nullif(trim(coalesce(v_member->>'phone_no', '')), ''),
      coalesce(v_member->>'status', 'none'),
      nullif(trim(coalesce(v_member->>'class_or_work_details', '')), '')
    );
  end loop;

  return jsonb_build_object('id', v_family_id);
end;
$$;

create or replace function public.get_reports_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_madrasa_id uuid := public.current_madrasa_id();
  v_result jsonb;
begin
  if v_madrasa_id is null then
    raise exception 'Profile not found';
  end if;

  select jsonb_build_object(
    'admissions', coalesce((select count(*) from public.students where madrasa_id = v_madrasa_id), 0),
    'families', coalesce((select count(*) from public.families where madrasa_id = v_madrasa_id), 0),
    'members', coalesce((
      select count(*)
      from public.family_members fm
      join public.families f on f.id = fm.family_id
      where f.madrasa_id = v_madrasa_id
    ), 0),
    'fee_transactions', coalesce((select count(*) from public.fee_payments where madrasa_id = v_madrasa_id), 0),
    'total_due', coalesce((select sum(due_amount) from public.student_fee_dues where madrasa_id = v_madrasa_id), 0),
    'total_collected', coalesce((select sum(collected_amount) from public.student_fee_dues where madrasa_id = v_madrasa_id), 0),
    'total_pending', coalesce((select sum(outstanding_amount) from public.student_fee_dues where madrasa_id = v_madrasa_id), 0),
    'donations_collected', coalesce((select sum(amount) from public.donations where madrasa_id = v_madrasa_id and status = 'collected'), 0),
    'donations_offered', coalesce((select sum(amount) from public.donations where madrasa_id = v_madrasa_id and status = 'offered'), 0),
    'total_expenses', coalesce((select sum(amount) from public.expenses where madrasa_id = v_madrasa_id), 0),
    'collector_balance', coalesce((select sum(current_balance) from public.collectors where madrasa_id = v_madrasa_id), 0),
    'collectors', coalesce((select count(*) from public.collectors where madrasa_id = v_madrasa_id), 0),
    'ledger_entries', coalesce((select count(*) from public.collector_ledger_entries where madrasa_id = v_madrasa_id), 0),
    'transfers', coalesce((select count(*) from public.collector_transfers where madrasa_id = v_madrasa_id), 0),
    'expenses_count', coalesce((select count(*) from public.expenses where madrasa_id = v_madrasa_id), 0)
  ) into v_result;

  return v_result;
end;
$$;

create or replace view public.collector_ledger_entries as
select
  fp.id,
  fp.madrasa_id,
  fp.collected_by_collector_id as collector_id,
  'fee_collection'::text as movement_type,
  'fees'::text as source_module,
  fp.id as source_id,
  fp.collected_at as entry_date,
  fp.amount as amount_delta,
  fp.receipt_no as reference_no,
  s.name as counterparty_name,
  fp.description,
  fp.created_at
from public.fee_payments fp
join public.students s on s.id = fp.student_id
where fp.collected_by_collector_id is not null

union all

select
  d.id,
  d.madrasa_id,
  d.collected_by_collector_id as collector_id,
  'donation_collection'::text as movement_type,
  'donations'::text as source_module,
  d.id as source_id,
  d.collected_at as entry_date,
  d.amount as amount_delta,
  d.receipt_no as reference_no,
  coalesce(d.donor_name, 'Anonymous') as counterparty_name,
  coalesce(d.notes, 'Donation') as description,
  d.created_at
from public.donations d
where d.status = 'collected'
  and d.collected_by_collector_id is not null

union all

select
  e.id,
  e.madrasa_id,
  e.paid_by_collector_id as collector_id,
  'expense'::text as movement_type,
  'expenses'::text as source_module,
  e.id as source_id,
  e.expense_date as entry_date,
  (e.amount * -1) as amount_delta,
  null::text as reference_no,
  e.category as counterparty_name,
  coalesce(e.description, e.category) as description,
  e.created_at
from public.expenses e
where e.paid_by_collector_id is not null

union all

select
  ct.id,
  ct.madrasa_id,
  ct.from_collector_id as collector_id,
  'transfer_out'::text as movement_type,
  'transfers'::text as source_module,
  ct.id as source_id,
  ct.transfer_date as entry_date,
  (ct.amount * -1) as amount_delta,
  ct.transfer_no as reference_no,
  to_collector.name as counterparty_name,
  coalesce(ct.note, 'Collector transfer out') as description,
  ct.created_at
from public.collector_transfers ct
join public.collectors to_collector on to_collector.id = ct.to_collector_id

union all

select
  ct.id,
  ct.madrasa_id,
  ct.to_collector_id as collector_id,
  'transfer_in'::text as movement_type,
  'transfers'::text as source_module,
  ct.id as source_id,
  ct.transfer_date as entry_date,
  ct.amount as amount_delta,
  ct.transfer_no as reference_no,
  from_collector.name as counterparty_name,
  coalesce(ct.note, 'Collector transfer in') as description,
  ct.created_at
from public.collector_transfers ct
join public.collectors from_collector on from_collector.id = ct.from_collector_id;

alter table public.collectors enable row level security;
alter table public.collector_transfers enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.student_fee_dues enable row level security;
alter table public.number_sequences enable row level security;

drop policy if exists collectors_madrasa_policy on public.collectors;
create policy collectors_madrasa_policy on public.collectors
for all
to authenticated
using (madrasa_id = public.current_madrasa_id())
with check (madrasa_id = public.current_madrasa_id());

drop policy if exists collector_transfers_madrasa_policy on public.collector_transfers;
create policy collector_transfers_madrasa_policy on public.collector_transfers
for all
to authenticated
using (madrasa_id = public.current_madrasa_id())
with check (madrasa_id = public.current_madrasa_id());

drop policy if exists families_madrasa_policy on public.families;
create policy families_madrasa_policy on public.families
for all
to authenticated
using (madrasa_id = public.current_madrasa_id())
with check (madrasa_id = public.current_madrasa_id());

drop policy if exists family_members_family_policy on public.family_members;
create policy family_members_family_policy on public.family_members
for all
to authenticated
using (
  exists (
    select 1
    from public.families f
    where f.id = family_id
      and f.madrasa_id = public.current_madrasa_id()
  )
)
with check (
  exists (
    select 1
    from public.families f
    where f.id = family_id
      and f.madrasa_id = public.current_madrasa_id()
  )
);

drop policy if exists student_fee_dues_madrasa_policy on public.student_fee_dues;
create policy student_fee_dues_madrasa_policy on public.student_fee_dues
for all
to authenticated
using (madrasa_id = public.current_madrasa_id())
with check (madrasa_id = public.current_madrasa_id());

drop policy if exists number_sequences_madrasa_policy on public.number_sequences;
create policy number_sequences_madrasa_policy on public.number_sequences
for select
to authenticated
using (madrasa_id = public.current_madrasa_id());

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

update storage.buckets
set public = false
where id = 'receipts';

drop policy if exists receipts_public_read on storage.objects;
drop policy if exists receipts_authenticated_read on storage.objects;
create policy receipts_authenticated_read on storage.objects
for select
to authenticated
using (
  bucket_id = 'receipts'
  and split_part(name, '/', 1) = public.current_madrasa_id()::text
);

drop policy if exists receipts_authenticated_manage on storage.objects;
create policy receipts_authenticated_manage on storage.objects
for all
to authenticated
using (
  bucket_id = 'receipts'
  and split_part(name, '/', 1) = public.current_madrasa_id()::text
)
with check (
  bucket_id = 'receipts'
  and split_part(name, '/', 1) = public.current_madrasa_id()::text
);

revoke execute on function public.allocate_next_number(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.adjust_collector_balance(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.sync_due_status(uuid) from public, anon, authenticated;
revoke execute on function public.sync_student_fee_dues(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.write_activity_entry(uuid, text, text, text, text) from public, anon, authenticated;

grant execute on function public.sync_madrasa_fee_dues(uuid, integer, integer) to authenticated;
grant execute on function public.issue_receipt_number(text, text) to authenticated;
grant execute on function public.create_collector_entry(text, text, text, text, numeric) to authenticated;
grant execute on function public.create_student_admission_entry(text, text, date, numeric, numeric, text, text, text, date, text, text) to authenticated;
grant execute on function public.record_fee_payment_entry(uuid, uuid, numeric, uuid, date, text, text) to authenticated;
grant execute on function public.create_event_entry(text, text, date, text, text) to authenticated;
grant execute on function public.create_donation_entry(uuid, text, numeric, text, text, uuid, date, text, text) to authenticated;
grant execute on function public.collect_offered_donation_entry(uuid, uuid, date, text, text) to authenticated;
grant execute on function public.record_expense_entry(text, text, numeric, date, uuid) to authenticated;
grant execute on function public.transfer_collector_balance_entry(uuid, uuid, numeric, date, text, text, text) to authenticated;
grant execute on function public.save_family_entry(uuid, text, text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.get_reports_summary() to authenticated;
