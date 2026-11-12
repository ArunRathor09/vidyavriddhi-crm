create table if not exists public.auto_lead_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  last_received_at timestamptz,
  leads_received bigint not null default 0 check (leads_received >= 0),
  revoked_at timestamptz
);

create index if not exists auto_lead_sources_org_created_idx
  on public.auto_lead_sources (organization_id, created_at desc);
alter table public.auto_lead_sources enable row level security;
revoke all on table public.auto_lead_sources from anon, authenticated;
grant select (id, organization_id, created_by, name, created_at, last_received_at, leads_received, revoked_at)
  on table public.auto_lead_sources to authenticated;
grant insert (organization_id, created_by, name, token_hash)
  on table public.auto_lead_sources to authenticated;
grant update (revoked_at) on table public.auto_lead_sources to authenticated;

drop policy if exists "Organization admins manage auto lead sources" on public.auto_lead_sources;
drop policy if exists "Organization admins read auto lead sources" on public.auto_lead_sources;
drop policy if exists "Organization admins create auto lead sources" on public.auto_lead_sources;
drop policy if exists "Organization admins update auto lead sources" on public.auto_lead_sources;
create policy "Organization admins read auto lead sources"
  on public.auto_lead_sources
  for select to authenticated
  using (public.user_is_org_admin(organization_id));
create policy "Organization admins create auto lead sources"
  on public.auto_lead_sources
  for insert to authenticated
  with check (
    public.user_is_org_admin(organization_id)
    and created_by = (select auth.uid())
  );
create policy "Organization admins update auto lead sources"
  on public.auto_lead_sources
  for update to authenticated
  using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

create or replace function public.create_auto_lead_follow_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_priority text;
  v_due_at timestamptz;
begin
  if new.status in ('Admitted', 'Payment complete') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.priority = 'Hot' or new.priority <> 'Hot' then
      return new;
    end if;
  end if;

  v_title := case when new.priority = 'Hot'
    then 'Call hot lead · ' || new.full_name
    else 'First contact · ' || new.full_name
  end;
  v_priority := case when new.priority = 'Hot' then 'High' else 'Medium' end;
  v_due_at := coalesce(
    new.next_follow_up_date::timestamp at time zone 'Asia/Kolkata',
    now() + interval '1 day'
  );

  if not exists (
    select 1
      from public.follow_ups f
     where f.organization_id = new.organization_id
       and f.contact_name = new.full_name
       and f.status in ('Open', 'Snoozed')
  ) then
    insert into public.follow_ups (
      user_id, organization_id, title, contact_name, channel, due_at, priority, status, notes
    ) values (
      new.user_id,
      new.organization_id,
      v_title,
      new.full_name,
      'Call',
      v_due_at,
      v_priority,
      'Open',
      'Auto-created by Auto Leads.'
    );
  end if;

  return new;
end;
$$;

revoke all on function public.create_auto_lead_follow_up() from public, anon, authenticated;
drop trigger if exists leads_auto_follow_up on public.leads;
create trigger leads_auto_follow_up
  after insert or update of priority on public.leads
  for each row execute function public.create_auto_lead_follow_up();

create or replace function public.ingest_auto_leads(p_api_key text, p_leads jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.auto_lead_sources%rowtype;
  v_lead jsonb;
  v_name text;
  v_phone text;
  v_email text;
  v_source_name text;
  v_status text;
  v_priority text;
  v_whatsapp_opt_in boolean;
  v_budget numeric;
  v_next_follow_up_date date;
  v_inserted boolean;
  v_created integer := 0;
  v_updated integer := 0;
  v_count integer;
begin
  if p_api_key is null or length(p_api_key) < 32 or length(p_api_key) > 128 then
    raise exception using errcode = '28000', message = 'Invalid API credentials.';
  end if;
  if p_leads is null or jsonb_typeof(p_leads) <> 'array' then
    raise exception using errcode = '22023', message = 'Leads must be a JSON array.';
  end if;

  v_count := jsonb_array_length(p_leads);
  if v_count < 1 or v_count > 100 then
    raise exception using errcode = '22023', message = 'A request must include between 1 and 100 leads.';
  end if;

  select s.*
    into v_source
    from public.auto_lead_sources s
   where s.token_hash = extensions.digest(p_api_key, 'sha256')
     and s.revoked_at is null
   for update;
  if not found then
    raise exception using errcode = '28000', message = 'Invalid API credentials.';
  end if;

  for v_lead in select value from jsonb_array_elements(p_leads)
  loop
    if jsonb_typeof(v_lead) <> 'object' then
      raise exception using errcode = '22023', message = 'Each lead must be a JSON object.';
    end if;

    v_name := nullif(btrim(v_lead ->> 'full_name'), '');
    v_phone := regexp_replace(coalesce(v_lead ->> 'phone', ''), '[ ()-]', '', 'g');
    v_email := nullif(lower(btrim(v_lead ->> 'email')), '');
    v_source_name := coalesce(nullif(v_lead ->> 'source', ''), 'Other');
    v_status := coalesce(nullif(v_lead ->> 'status', ''), 'New');
    v_priority := coalesce(nullif(v_lead ->> 'priority', ''), 'Warm');
    v_whatsapp_opt_in := coalesce((v_lead ->> 'whatsapp_opt_in')::boolean, false);
    v_budget := nullif(v_lead ->> 'budget', '')::numeric;
    v_next_follow_up_date := nullif(v_lead ->> 'next_follow_up_date', '')::date;

    if v_name is null or length(v_name) > 160
       or v_phone !~ '^\+?[0-9]{7,20}$'
       or (v_email is not null and (length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
       or v_source_name not in ('Website', 'Google', 'Facebook', 'Instagram', 'Referral', 'Walk-in', 'Other')
       or v_status not in ('New', 'Contacted', 'Interested', 'Documents', 'Applied', 'Offer letter', 'Admitted', 'Payment complete')
       or v_priority not in ('Hot', 'Warm', 'Cold')
       or (v_lead ? 'whatsapp_opt_in' and jsonb_typeof(v_lead -> 'whatsapp_opt_in') <> 'boolean')
       or (v_budget is not null and (v_budget < 0 or v_budget > 9999999999.99))
       or length(coalesce(v_lead ->> 'counselor_name', '')) > 160
       or length(coalesce(v_lead ->> 'preferred_destination', '')) > 160 then
      raise exception using errcode = '22023', message = 'A lead contains invalid or unsupported fields.';
    end if;

    insert into public.leads (
      user_id, organization_id, full_name, phone, email, source, status, priority,
      whatsapp_opt_in, counselor_name, preferred_destination, budget, next_follow_up_date
    ) values (
      v_source.created_by,
      v_source.organization_id,
      v_name,
      v_phone,
      v_email,
      v_source_name,
      v_status,
      v_priority,
      v_whatsapp_opt_in,
      nullif(btrim(v_lead ->> 'counselor_name'), ''),
      nullif(btrim(v_lead ->> 'preferred_destination'), ''),
      v_budget,
      v_next_follow_up_date
    )
    on conflict (organization_id, phone) where phone is not null and phone <> ''
    do update set
      full_name = excluded.full_name,
      email = case when v_lead ? 'email' then excluded.email else public.leads.email end,
      source = case when v_lead ? 'source' then excluded.source else public.leads.source end,
      status = case when v_lead ? 'status' then excluded.status else public.leads.status end,
      priority = case when v_lead ? 'priority' then excluded.priority else public.leads.priority end,
      whatsapp_opt_in = case when v_lead ? 'whatsapp_opt_in' then excluded.whatsapp_opt_in else public.leads.whatsapp_opt_in end,
      counselor_name = case when v_lead ? 'counselor_name' then excluded.counselor_name else public.leads.counselor_name end,
      preferred_destination = case when v_lead ? 'preferred_destination' then excluded.preferred_destination else public.leads.preferred_destination end,
      budget = case when v_lead ? 'budget' then excluded.budget else public.leads.budget end,
      next_follow_up_date = case when v_lead ? 'next_follow_up_date' then excluded.next_follow_up_date else public.leads.next_follow_up_date end
    returning (xmax = 0) into v_inserted;

    if v_inserted then
      v_created := v_created + 1;
    else
      v_updated := v_updated + 1;
    end if;
  end loop;

  update public.auto_lead_sources
     set last_received_at = now(),
         leads_received = leads_received + v_count
   where id = v_source.id;

  return jsonb_build_object(
    'received', v_count,
    'created', v_created,
    'updated', v_updated
  );
end;
$$;

revoke all on function public.ingest_auto_leads(text, jsonb) from public;
grant execute on function public.ingest_auto_leads(text, jsonb) to anon, authenticated;
