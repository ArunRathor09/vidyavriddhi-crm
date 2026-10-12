create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  source text not null check (source in ('Website', 'Google', 'Facebook', 'Instagram', 'Referral', 'Walk-in', 'Other')),
  counselor_name text,
  status text not null default 'New' check (status in ('New', 'Contacted', 'Interested', 'Documents', 'Applied', 'Offer letter', 'Admitted', 'Payment complete')),
  priority text not null default 'Warm' check (priority in ('Hot', 'Warm', 'Cold')),
  preferred_destination text,
  budget numeric(12, 2) check (budget is null or budget >= 0),
  next_follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  parent_name text,
  neet_score integer check (neet_score is null or neet_score between 0 and 720),
  rank integer check (rank is null or rank >= 0),
  category text check (category is null or category in ('General', 'OBC', 'SC', 'ST', 'EWS', 'Other')),
  preferred_destination text,
  budget numeric(12, 2) check (budget is null or budget >= 0),
  timeline text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  contact_name text not null,
  channel text not null check (channel in ('Call', 'WhatsApp', 'Email', 'Meeting', 'SMS')),
  due_at timestamptz not null,
  priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')),
  status text not null default 'Open' check (status in ('Open', 'Completed', 'Snoozed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.colleges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  country text not null,
  state text,
  course text not null,
  annual_fee numeric(12, 2) check (annual_fee is null or annual_fee >= 0),
  hostel_fee numeric(12, 2) check (hostel_fee is null or hostel_fee >= 0),
  seats integer check (seats is null or seats >= 0),
  cutoff numeric(6, 2) check (cutoff is null or cutoff >= 0),
  eligibility text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_name text not null,
  college_name text not null,
  course text not null,
  status text not null default 'Registration' check (status in ('Registration', 'Document verification', 'University application', 'Offer letter', 'Visa', 'Admitted', 'Rejected')),
  last_updated date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_name text not null,
  document_type text not null check (document_type in ('NEET scorecard', '10th marksheet', '12th marksheet', 'Aadhaar', 'Passport', 'Photo', 'Signature', 'Other')),
  file_name text not null,
  file_path text,
  verification_status text not null default 'Pending' check (verification_status in ('Pending', 'Verified', 'Needs correction')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_name text not null,
  fee_type text not null check (fee_type in ('Registration fee', 'Counselling fee', 'Tuition instalment', 'Visa fee', 'Other')),
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'Pending' check (status in ('Pending', 'Paid', 'Overdue', 'Partially paid')),
  due_date date,
  receipt_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null,
  student_name text,
  activity_type text not null check (activity_type in ('Call', 'WhatsApp', 'Email', 'Meeting', 'Note', 'Admission')),
  created_at timestamptz not null default now()
);

create index if not exists leads_user_created_idx on public.leads (user_id, created_at desc);
create index if not exists leads_user_status_idx on public.leads (user_id, status);
create unique index if not exists leads_user_phone_unique on public.leads (user_id, phone);
create unique index if not exists leads_user_email_unique on public.leads (user_id, lower(email)) where email is not null and email <> '';
create index if not exists students_user_created_idx on public.students (user_id, created_at desc);
create unique index if not exists students_user_phone_unique on public.students (user_id, phone);
create unique index if not exists students_user_email_unique on public.students (user_id, lower(email)) where email is not null and email <> '';
create index if not exists follow_ups_user_due_idx on public.follow_ups (user_id, due_at);
create index if not exists applications_user_status_idx on public.applications (user_id, status);
create index if not exists payments_user_status_idx on public.payments (user_id, status);
create index if not exists documents_user_student_idx on public.documents (user_id, student_name);
create index if not exists activities_user_created_idx on public.activities (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['leads', 'students', 'follow_ups', 'colleges', 'applications', 'documents', 'payments']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Users manage their own %s" on public.%I', table_name, table_name);
    execute format(
      'create policy "Users manage their own %s" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name,
      table_name
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
  alter table public.activities enable row level security;
  drop policy if exists "Users manage their own activities" on public.activities;
  create policy "Users manage their own activities" on public.activities for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  grant select, insert, update, delete on public.activities to authenticated;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-documents',
  'student-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users manage their own student documents" on storage.objects;
create policy "Users manage their own student documents"
on storage.objects for all to authenticated
using (
  bucket_id = 'student-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'student-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
