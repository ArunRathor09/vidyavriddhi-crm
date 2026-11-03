create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index if not exists organization_invitations_pending_email_unique
  on public.organization_invitations (organization_id, lower(email))
  where accepted_at is null;
create index if not exists organization_invitations_email_pending_idx
  on public.organization_invitations (lower(email), created_at)
  where accepted_at is null;

create index if not exists organization_members_user_org_idx
  on public.organization_members (user_id, organization_id);

with new_organizations as (
  insert into public.organizations (name, created_by)
  select left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'organization_name'), ''), split_part(coalesce(u.email, 'Admissions'), '@', 1) || ' Workspace'), 160),
         u.id
  from auth.users u
  where not exists (
    select 1 from public.organization_members m where m.user_id = u.id
  )
  returning id, created_by
)
insert into public.organization_members (organization_id, user_id, role)
select id, created_by, 'owner'
from new_organizations
where created_by is not null
on conflict (organization_id, user_id) do nothing;

create or replace function public.user_is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.user_is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.current_user_organizations()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.organization_id), array[]::uuid[])
  from public.organization_members m
  where m.user_id = (select auth.uid());
$$;

create or replace function public.user_can_access_legacy_storage_folder(folder_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations o
    join public.organization_members m on m.organization_id = o.id
    where o.created_by = folder_owner
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.user_can_manage_legacy_storage_folder(folder_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations o
    join public.organization_members m on m.organization_id = o.id
    where o.created_by = folder_owner
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.user_is_org_member(uuid) from public;
revoke all on function public.user_is_org_admin(uuid) from public;
revoke all on function public.current_user_organizations() from public;
revoke all on function public.user_can_access_legacy_storage_folder(uuid) from public;
revoke all on function public.user_can_manage_legacy_storage_folder(uuid) from public;
grant execute on function public.user_is_org_member(uuid) to authenticated;
grant execute on function public.user_is_org_admin(uuid) to authenticated;
grant execute on function public.current_user_organizations() to authenticated;
grant execute on function public.user_can_access_legacy_storage_folder(uuid) to authenticated;
grant execute on function public.user_can_manage_legacy_storage_folder(uuid) to authenticated;

create or replace function public.prevent_crm_record_scope_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Record organization and creator cannot be changed';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_crm_record_scope_change() from public;

create or replace function public.protect_organization_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Organization membership scope cannot be changed';
  end if;
  if old.role = 'owner' and new.role <> 'owner' then
    raise exception 'Organization ownership must be transferred before changing the owner role';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_organization_membership() from public;

drop trigger if exists organization_members_protect_scope on public.organization_members;
create trigger organization_members_protect_scope
  before update on public.organization_members
  for each row execute function public.protect_organization_membership();

create or replace function public.protect_organization_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Organization identity and creator cannot be changed';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_organization_identity() from public;
drop trigger if exists organizations_protect_identity on public.organizations;
create trigger organizations_protect_identity
  before update on public.organizations
  for each row execute function public.protect_organization_identity();

create or replace function public.provision_user_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  pending_invitation record;
begin
  select i.id, i.organization_id, i.role
  into pending_invitation
  from public.organization_invitations i
  where lower(i.email) = lower(new.email)
    and i.accepted_at is null
  order by i.created_at
  limit 1
  for update;

  if found then
    insert into public.organization_members (organization_id, user_id, role)
    values (pending_invitation.organization_id, new.id, pending_invitation.role)
    on conflict (organization_id, user_id) do nothing;

    update public.organization_invitations
    set accepted_at = now()
    where id = pending_invitation.id;
    return new;
  end if;

  if not exists (
    select 1 from public.organization_members m where m.user_id = new.id
  ) then
    insert into public.organizations (name, created_by)
    values (
      left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''), split_part(coalesce(new.email, 'Admissions'), '@', 1) || ' Workspace'), 160),
      new.id
    )
    returning id into new_org_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (new_org_id, new.id, 'owner');
  end if;
  return new;
end;
$$;
revoke all on function public.provision_user_organization() from public;

create or replace function public.track_lead_whatsapp_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.whatsapp_opt_in and (tg_op = 'INSERT' or old.whatsapp_opt_in is distinct from true) then
    new.whatsapp_opted_in_at = now();
  elsif not new.whatsapp_opt_in then
    new.whatsapp_opted_in_at = null;
  else
    new.whatsapp_opted_in_at = old.whatsapp_opted_in_at;
  end if;
  return new;
end;
$$;
revoke all on function public.track_lead_whatsapp_consent() from public;
drop trigger if exists leads_track_whatsapp_consent on public.leads;
create trigger leads_track_whatsapp_consent
  before insert or update on public.leads
  for each row execute function public.track_lead_whatsapp_consent();

drop trigger if exists on_auth_user_created_provision_organization on auth.users;
create trigger on_auth_user_created_provision_organization
  after insert on auth.users
  for each row execute function public.provision_user_organization();

alter table public.leads add column if not exists organization_id uuid references public.organizations(id);
alter table public.leads add column if not exists whatsapp_opt_in boolean not null default false;
alter table public.leads add column if not exists whatsapp_opted_in_at timestamptz;
alter table public.students add column if not exists organization_id uuid references public.organizations(id);
alter table public.follow_ups add column if not exists organization_id uuid references public.organizations(id);
alter table public.colleges add column if not exists organization_id uuid references public.organizations(id);
alter table public.applications add column if not exists organization_id uuid references public.organizations(id);
alter table public.documents add column if not exists organization_id uuid references public.organizations(id);
alter table public.payments add column if not exists organization_id uuid references public.organizations(id);
alter table public.activities add column if not exists organization_id uuid references public.organizations(id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'leads', 'students', 'follow_ups', 'colleges',
    'applications', 'documents', 'payments', 'activities'
  ] loop
    execute format(
      'update public.%I r set organization_id = o.id from public.organizations o where r.organization_id is null and o.created_by = r.user_id',
      table_name
    );
    execute format('alter table public.%I alter column organization_id set not null', table_name);
    execute format('create index if not exists %I on public.%I (organization_id, created_at desc, id desc)', table_name || '_org_created_id_idx', table_name);
    execute format('drop policy if exists %I on public.%I', 'Users manage their own ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'Organization members read ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'Organization members create ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'Organization members update ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'Organization members manage ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'Organization admins delete ' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = any((select public.current_user_organizations())))',
      'Organization members read ' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = any((select public.current_user_organizations())) and user_id = (select auth.uid()))',
      'Organization members create ' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = any((select public.current_user_organizations()))) with check (organization_id = any((select public.current_user_organizations())))',
      'Organization members update ' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = any((select public.current_user_organizations())) and public.user_is_org_admin(organization_id))',
      'Organization admins delete ' || table_name,
      table_name
    );
    execute format('drop trigger if exists %I on public.%I', table_name || '_protect_scope', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.prevent_crm_record_scope_change()',
      table_name || '_protect_scope',
      table_name
    );
  end loop;
end;
$$;

drop index if exists public.leads_user_phone_unique;
drop index if exists public.leads_user_email_unique;
drop index if exists public.students_user_phone_unique;
drop index if exists public.students_user_email_unique;

create unique index if not exists leads_org_phone_unique
  on public.leads (organization_id, phone) where phone is not null and phone <> '';
create unique index if not exists leads_org_email_unique
  on public.leads (organization_id, lower(email)) where email is not null and email <> '';
create unique index if not exists students_org_phone_unique
  on public.students (organization_id, phone) where phone is not null and phone <> '';
create unique index if not exists students_org_email_unique
  on public.students (organization_id, lower(email)) where email is not null and email <> '';

create index if not exists leads_org_status_created_idx
  on public.leads (organization_id, status, created_at desc, id desc);
create index if not exists leads_org_priority_idx on public.leads (organization_id, priority);
create index if not exists leads_org_source_idx on public.leads (organization_id, source);
create index if not exists leads_org_counselor_idx on public.leads (organization_id, counselor_name);
create index if not exists follow_ups_org_status_due_idx
  on public.follow_ups (organization_id, status, due_at);
create index if not exists applications_org_status_idx
  on public.applications (organization_id, status);
create index if not exists payments_org_status_idx
  on public.payments (organization_id, status) include (amount);

alter table public.leads add column if not exists search_document tsvector
  generated always as (to_tsvector('simple'::regconfig, coalesce(full_name, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(email, '') || ' ' || coalesce(preferred_destination, '') || ' ' || coalesce(counselor_name, ''))) stored;
alter table public.students add column if not exists search_document tsvector
  generated always as (to_tsvector('simple'::regconfig, coalesce(full_name, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(email, '') || ' ' || coalesce(parent_name, '') || ' ' || coalesce(preferred_destination, ''))) stored;
alter table public.follow_ups add column if not exists search_document tsvector
  generated always as (to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(contact_name, '') || ' ' || coalesce(channel, '') || ' ' || coalesce(notes, ''))) stored;
alter table public.colleges add column if not exists search_document tsvector
  generated always as (to_tsvector('simple'::regconfig, coalesce(name, '') || ' ' || coalesce(country, '') || ' ' || coalesce(state, '') || ' ' || coalesce(course, ''))) stored;
alter table public.applications add column if not exists search_document tsvector
  generated always as (to_tsvector('simple'::regconfig, coalesce(student_name, '') || ' ' || coalesce(college_name, '') || ' ' || coalesce(course, '') || ' ' || coalesce(status, ''))) stored;
alter table public.documents add column if not exists search_document tsvector
  generated always as (to_tsvector('simple'::regconfig, coalesce(student_name, '') || ' ' || coalesce(document_type, '') || ' ' || coalesce(file_name, '') || ' ' || coalesce(verification_status, ''))) stored;
alter table public.payments add column if not exists search_document tsvector
  generated always as (to_tsvector('simple'::regconfig, coalesce(student_name, '') || ' ' || coalesce(fee_type, '') || ' ' || coalesce(status, '') || ' ' || coalesce(receipt_number, ''))) stored;
alter table public.activities add column if not exists search_document tsvector
  generated always as (to_tsvector('simple'::regconfig, coalesce(description, '') || ' ' || coalesce(student_name, '') || ' ' || coalesce(activity_type, ''))) stored;

create index if not exists leads_search_document_idx on public.leads using gin (search_document);
create index if not exists students_search_document_idx on public.students using gin (search_document);
create index if not exists follow_ups_search_document_idx on public.follow_ups using gin (search_document);
create index if not exists colleges_search_document_idx on public.colleges using gin (search_document);
create index if not exists applications_search_document_idx on public.applications using gin (search_document);
create index if not exists documents_search_document_idx on public.documents using gin (search_document);
create index if not exists payments_search_document_idx on public.payments using gin (search_document);
create index if not exists activities_search_document_idx on public.activities using gin (search_document);

create table if not exists public.whatsapp_message_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null,
  initiated_by uuid not null,
  request_id uuid not null,
  provider_message_id text,
  status text not null check (status in ('pending', 'accepted', 'failed')),
  created_at timestamptz not null default now(),
  unique (organization_id, request_id)
);
create unique index if not exists whatsapp_message_logs_provider_id_unique
  on public.whatsapp_message_logs (provider_message_id)
  where provider_message_id is not null;
create index if not exists whatsapp_message_logs_org_created_idx
  on public.whatsapp_message_logs (organization_id, created_at desc);
create index if not exists whatsapp_message_logs_lead_created_idx
  on public.whatsapp_message_logs (organization_id, lead_id, created_at desc);
alter table public.whatsapp_message_logs enable row level security;
create or replace function public.protect_whatsapp_message_log()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'pending'
     or new.organization_id is distinct from old.organization_id
     or new.lead_id is distinct from old.lead_id
     or new.initiated_by is distinct from old.initiated_by
     or new.request_id is distinct from old.request_id
     or new.created_at is distinct from old.created_at
     or new.status not in ('accepted', 'failed')
     or (new.status = 'accepted' and new.provider_message_id is null) then
    raise exception 'WhatsApp message audit records can only be finalized once';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_whatsapp_message_log() from public;
drop trigger if exists whatsapp_message_logs_protect_update on public.whatsapp_message_logs;
create trigger whatsapp_message_logs_protect_update
  before update on public.whatsapp_message_logs
  for each row execute function public.protect_whatsapp_message_log();
drop policy if exists "Members can read WhatsApp message logs" on public.whatsapp_message_logs;
create policy "Members can read WhatsApp message logs"
  on public.whatsapp_message_logs for select to authenticated
  using (organization_id = any((select public.current_user_organizations())));
drop policy if exists "Members can create their WhatsApp message logs" on public.whatsapp_message_logs;
drop policy if exists "Members can finalize their WhatsApp message logs" on public.whatsapp_message_logs;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;

drop policy if exists "Members can read their organizations" on public.organizations;
create policy "Members can read their organizations"
  on public.organizations for select to authenticated
  using (id = any((select public.current_user_organizations())));

drop policy if exists "Admins can update their organizations" on public.organizations;
create policy "Admins can update their organizations"
  on public.organizations for update to authenticated
  using (public.user_is_org_admin(id))
  with check (public.user_is_org_admin(id));

drop policy if exists "Members can read organization memberships" on public.organization_members;
create policy "Members can read organization memberships"
  on public.organization_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or (organization_id = any((select public.current_user_organizations())) and public.user_is_org_admin(organization_id))
  );

drop policy if exists "Admins can add organization members" on public.organization_members;

drop policy if exists "Admins can update organization members" on public.organization_members;
create policy "Admins can update organization members"
  on public.organization_members for update to authenticated
  using (public.user_is_org_admin(organization_id) and role <> 'owner')
  with check (public.user_is_org_admin(organization_id) and role <> 'owner');

drop policy if exists "Admins can remove organization members" on public.organization_members;
create policy "Admins can remove organization members"
  on public.organization_members for delete to authenticated
  using (public.user_is_org_admin(organization_id) and user_id <> (select auth.uid()) and role <> 'owner');

drop policy if exists "Admins can read organization invitations" on public.organization_invitations;
create policy "Admins can read organization invitations"
  on public.organization_invitations for select to authenticated
  using (public.user_is_org_admin(organization_id));
drop policy if exists "Admins can create organization invitations" on public.organization_invitations;
drop policy if exists "Admins can cancel organization invitations" on public.organization_invitations;

create or replace function public.get_crm_overview(target_org uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.user_is_org_member(target_org) then
    raise insufficient_privilege using message = 'Organization membership required';
  end if;

  select jsonb_build_object(
    'leads', (select count(*) from public.leads where organization_id = target_org),
    'hot_leads', (select count(*) from public.leads where organization_id = target_org and priority = 'Hot'),
    'lead_stages', coalesce((select jsonb_object_agg(status, total) from (
      select status, count(*) as total from public.leads where organization_id = target_org group by status
    ) stage_counts), '{}'::jsonb),
    'lead_sources', coalesce((select jsonb_object_agg(source, total) from (
      select coalesce(nullif(source, ''), 'Unspecified') as source, count(*) as total
      from public.leads where organization_id = target_org group by 1
    ) source_counts), '{}'::jsonb),
    'lead_trends', coalesce((select jsonb_object_agg(to_char(month_start, 'YYYY-MM'), total) from (
      select months.month_start, count(leads.id) as total
      from generate_series(
        date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '5 months',
        date_trunc('month', now() at time zone 'Asia/Kolkata'),
        interval '1 month'
      ) as months(month_start)
      left join public.leads leads
        on leads.organization_id = target_org
        and leads.created_at >= ((date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '5 months') at time zone 'Asia/Kolkata')
        and date_trunc('month', leads.created_at at time zone 'Asia/Kolkata') = months.month_start
      group by months.month_start
    ) monthly_leads), '{}'::jsonb),
    'counsellors', coalesce((select jsonb_object_agg(counsellor, total) from (
      select coalesce(nullif(counselor_name, ''), 'Unassigned') as counsellor, count(*) as total
      from public.leads where organization_id = target_org group by 1
    ) counsellor_counts), '{}'::jsonb),
    'students', (select count(*) from public.students where organization_id = target_org),
    'applications', (select count(*) from public.applications where organization_id = target_org),
    'active_applications', (select count(*) from public.applications where organization_id = target_org and status not in ('Admitted', 'Rejected')),
    'application_stages', coalesce((select jsonb_object_agg(status, total) from (
      select status, count(*) as total from public.applications where organization_id = target_org group by status
    ) application_counts), '{}'::jsonb),
    'paid_payments', (select count(*) from public.payments where organization_id = target_org and status = 'Paid'),
    'paid_total', (select coalesce(sum(amount), 0) from public.payments where organization_id = target_org and status = 'Paid'),
    'outstanding_payments', (select count(*) from public.payments where organization_id = target_org and status in ('Pending', 'Overdue', 'Partially paid')),
    'outstanding_total', (select coalesce(sum(amount), 0) from public.payments where organization_id = target_org and status in ('Pending', 'Overdue', 'Partially paid')),
    'payment_totals', coalesce((select jsonb_object_agg(status, jsonb_build_object('count', total_count, 'amount', total_amount)) from (
      select status, count(*) as total_count, coalesce(sum(amount), 0) as total_amount
      from public.payments where organization_id = target_org group by status
    ) payment_counts), '{}'::jsonb),
    'due_follow_ups', (select count(*) from public.follow_ups where organization_id = target_org and status = 'Open' and due_at < ((date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day') at time zone 'Asia/Kolkata')),
    'overdue_follow_ups', (select count(*) from public.follow_ups where organization_id = target_org and status = 'Open' and due_at < now()),
    'upcoming_follow_ups', coalesce((select jsonb_agg(to_jsonb(due_items)) from (
      select id, title, contact_name, channel, due_at, priority
      from public.follow_ups
      where organization_id = target_org
        and status = 'Open'
        and due_at < ((date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day') at time zone 'Asia/Kolkata')
      order by due_at asc
      limit 5
    ) due_items), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_crm_overview(uuid) from public;
grant execute on function public.get_crm_overview(uuid) to authenticated;

drop policy if exists "Users can read their own documents" on storage.objects;
drop policy if exists "Users can upload their own documents" on storage.objects;
drop policy if exists "Users can update their own documents" on storage.objects;
drop policy if exists "Users can delete their own documents" on storage.objects;
drop policy if exists "Users manage their own student documents" on storage.objects;
drop policy if exists "Organization members can read documents" on storage.objects;
drop policy if exists "Organization members can upload documents" on storage.objects;
drop policy if exists "Organization members can update documents" on storage.objects;
drop policy if exists "Organization members can delete documents" on storage.objects;
drop policy if exists "Organization admins can update documents" on storage.objects;
drop policy if exists "Organization admins can delete documents" on storage.objects;

create policy "Organization members can read documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'student-documents' and (
    ((storage.foldername(name))[1])::uuid = any((select public.current_user_organizations()))
    or public.user_can_access_legacy_storage_folder(((storage.foldername(name))[1])::uuid)
  ));
create policy "Organization members can upload documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'student-documents' and ((storage.foldername(name))[1])::uuid = any((select public.current_user_organizations())));
create policy "Organization admins can update documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'student-documents' and (
    public.user_is_org_admin(((storage.foldername(name))[1])::uuid)
    or public.user_can_manage_legacy_storage_folder(((storage.foldername(name))[1])::uuid)
  ))
  with check (bucket_id = 'student-documents' and (
    public.user_is_org_admin(((storage.foldername(name))[1])::uuid)
    or public.user_can_manage_legacy_storage_folder(((storage.foldername(name))[1])::uuid)
  ));
create policy "Organization admins can delete documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'student-documents' and (
    public.user_is_org_admin(((storage.foldername(name))[1])::uuid)
    or public.user_can_manage_legacy_storage_folder(((storage.foldername(name))[1])::uuid)
  ));

grant select, update on public.organizations to authenticated;
grant select, update, delete on public.organization_members to authenticated;
grant select on public.organization_invitations to authenticated;
grant select on public.whatsapp_message_logs to authenticated;
grant all on public.organization_invitations to service_role;
grant all on public.whatsapp_message_logs to service_role;

notify pgrst, 'reload schema';
