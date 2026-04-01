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
