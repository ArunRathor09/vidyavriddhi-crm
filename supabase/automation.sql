-- Vidyavriddhi CRM — scheduled automation
-- Run this once in the Supabase SQL Editor after schema.sql.
--
-- What it does (daily, even when nobody has the CRM open):
--   1. Marks pending fees past their due date as Overdue.
--   2. Creates first-contact tasks for untouched new leads and hot-lead callbacks.
--   3. Creates fee reminders for outstanding fees due within three days.
--   4. Creates verification tasks for documents pending for more than two days.
--   5. Creates check-in tasks for applications that have not moved for 14 days.
--
-- Safe to re-run: the job is replaced instead of duplicated, and every insert
-- is skipped when the same open follow-up already exists.

create extension if not exists pg_cron;

create or replace function public.run_crm_automations()
returns table (
  overdue_payments integer,
  lead_tasks integer,
  payment_tasks integer,
  document_tasks integer,
  application_tasks integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_overdue integer := 0;
  v_leads integer := 0;
  v_payments integer := 0;
  v_documents integer := 0;
  v_applications integer := 0;
begin
  update public.payments
     set status = 'Overdue',
         updated_at = now()
   where status in ('Pending', 'Partially paid')
     and due_date is not null
     and due_date < current_date;
  get diagnostics v_overdue = row_count;

  insert into public.follow_ups (user_id, title, contact_name, channel, due_at, priority, status, notes)
  select
    l.user_id,
    case
      when l.priority = 'Hot' then 'Call hot lead · ' || l.full_name
      else 'First contact · ' || l.full_name
    end,
    l.full_name,
    'Call',
    now() + interval '1 day',
    case when l.priority = 'Hot' then 'High' else 'Medium' end,
    'Open',
    'Auto-created by scheduled CRM automation.'
  from public.leads l
  where l.status not in ('Admitted', 'Payment complete')
    and (
      (l.priority = 'Hot' and (l.next_follow_up_date is null or l.next_follow_up_date <= current_date))
      or (l.status = 'New' and l.created_at < now() - interval '1 day')
    )
    and not exists (
      select 1
      from public.follow_ups f
      where f.user_id = l.user_id
        and f.contact_name = l.full_name
        and f.status in ('Open', 'Snoozed')
    );
  get diagnostics v_leads = row_count;

  insert into public.follow_ups (user_id, title, contact_name, channel, due_at, priority, status, notes)
  select
    p.user_id,
    'Payment reminder · ' || p.student_name || ' · ' || p.fee_type,
    p.student_name,
    'Call',
    now() + interval '1 day',
    case when p.status = 'Overdue' or p.due_date < current_date then 'High' else 'Medium' end,
    'Open',
    'Auto-created by scheduled CRM automation.'
  from public.payments p
  where p.status in ('Pending', 'Partially paid', 'Overdue')
    and p.due_date is not null
    and p.due_date <= current_date + 3
    and not exists (
      select 1
      from public.follow_ups f
      where f.user_id = p.user_id
        and f.title = 'Payment reminder · ' || p.student_name || ' · ' || p.fee_type
        and f.status in ('Open', 'Snoozed')
    );
  get diagnostics v_payments = row_count;

  insert into public.follow_ups (user_id, title, contact_name, channel, due_at, priority, status, notes)
  select
    d.user_id,
    'Verify document · ' || d.student_name || ' · ' || d.document_type,
    d.student_name,
    'WhatsApp',
    now() + interval '1 day',
    'Medium',
    'Open',
    'Auto-created by scheduled CRM automation.'
  from public.documents d
  where d.verification_status = 'Pending'
    and d.created_at < now() - interval '2 days'
    and not exists (
      select 1
      from public.follow_ups f
      where f.user_id = d.user_id
        and f.title = 'Verify document · ' || d.student_name || ' · ' || d.document_type
        and f.status in ('Open', 'Snoozed')
    );
  get diagnostics v_documents = row_count;

  insert into public.follow_ups (user_id, title, contact_name, channel, due_at, priority, status, notes)
  select
    a.user_id,
    'Application check-in · ' || a.student_name,
    a.student_name,
    'Call',
    now() + interval '1 day',
    'Medium',
    'Open',
    'Auto-created by scheduled CRM automation.'
  from public.applications a
  where a.status not in ('Admitted', 'Rejected')
    and a.last_updated < current_date - 14
    and not exists (
      select 1
      from public.follow_ups f
      where f.user_id = a.user_id
        and f.title = 'Application check-in · ' || a.student_name
        and f.status in ('Open', 'Snoozed')
    );
  get diagnostics v_applications = row_count;

  return query select v_overdue, v_leads, v_payments, v_documents, v_applications;
end;
$$;

revoke all on function public.run_crm_automations() from anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'vidyavriddhi-crm-automations') then
    perform cron.unschedule('vidyavriddhi-crm-automations');
  end if;
end;
$$;

select cron.schedule(
  'vidyavriddhi-crm-automations',
  '15 1 * * *',
  $$select public.run_crm_automations();$$
);
