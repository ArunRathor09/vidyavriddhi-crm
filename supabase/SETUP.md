# Vidyavriddhi CRM — Supabase setup

The CRM uses Supabase Auth, its PostgreSQL database through the Supabase Data API, and a private Storage bucket. Browser requests use the project URL and publishable key; `DATABASE_URL` is not required at runtime. CRM records are scoped to an organization and its authenticated members with row-level security.

## Connect a project

1. Open **SQL Editor** in the Supabase project whose URL is configured in `.env`.
2. Open [`schema.sql`](./schema.sql), copy its complete contents, paste them into a new SQL Editor query, and run it. This creates the eight CRM tables, indexes, initial RLS policies, timestamp triggers, and private `student-documents` bucket.
3. Apply [`20261023000000_multi_tenant_crm.sql`](./migrations/20261023000000_multi_tenant_crm.sql) in the SQL Editor. This data-preserving migration creates organizations and invitations, backfills each existing account and its records into an organization, installs organization-scoped RLS and Storage policies, and adds server-side search and analytics indexes.
4. In **Project Settings → API**, ensure the matching Project URL and publishable key are configured in `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

5. To enable team invitations, configure the Supabase service-role key only on the server:

   ```dotenv
   SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
   ```

   Do not prefix this variable with `NEXT_PUBLIC_`. Configure Supabase Auth email delivery before sending invitations.
6. Restart the Next.js server, open `/login`, and create an account. New accounts receive a private organization; invited accounts join the inviting organization. If email confirmation is enabled in Supabase Auth, confirm the message before signing in.
7. Open `/settings`. The connection should report active after the schema and migration are applied and the signed-in account can read its workspace.

Do not put a Supabase secret/service-role key in the browser, a `NEXT_PUBLIC_` variable, or this file. Never commit `.env.local`.

## Tables and access control

The SQL creates leads, student profiles, follow-ups, colleges, applications, documents, payments, and activities. The migration adds `organization_id` and membership roles while preserving the original `user_id` creator for audit history. Existing users and records are assigned to organizations without deleting data. New accounts receive a workspace automatically; workspace owners and admins can invite new email addresses from Settings. Each API request verifies the signed-in user and active organization, while RLS verifies membership directly in PostgreSQL.

Student documents are stored in the private `student-documents` bucket under an organization folder. The UI uploads PDFs and common image types (up to 10 MB), stores only the object path in the database, and creates a signed link that expires after 60 seconds when a counsellor previews a document. Legacy per-user paths remain available to members of the original owner's organization.

## Large workspaces

CRM lists use indexed keyset pagination (50 rows per request; API maximum 100), organization-scoped filters, and PostgreSQL full-text search. Dashboard and report totals are calculated by a database aggregate rather than by counting only the rows currently loaded in the browser. Leads and students can be imported from validated CSV files in batches of 100, with a 10,000-row/10 MB limit per upload. Larger migrations should use a controlled server-side import job rather than a browser upload.

The migration and indexes make the application tenant-aware and avoid downloading full tables. They do not certify that a particular Supabase plan can sustain 100,000 concurrent team members: that requires plan sizing, workload/load testing, connection and rate-limit planning, and monitoring in the target Supabase project.

Before applying the organization migration to a live project, take a database backup and test it against a staging copy. Backfilling `organization_id` and building search indexes can scan/rewrite existing tables and take locks; schedule the change for an appropriate maintenance window for large production datasets.

## WhatsApp follow-up

The CRM does not send messages through the Meta API. On a lead row, the WhatsApp icon opens `wa.me` in a new tab; WhatsApp Desktop or WhatsApp Web can handle the link. The lead's number is used as the recipient, and a personalized Vidyavriddhi follow-up is prefilled for the user to review and send manually. The CRM does not need WhatsApp API credentials, templates, webhooks, or a database migration for this workflow.

Store phone numbers with the country calling code (for example, `+919876543210`). The draft is not sent automatically; the user must review it and tap **Send** in WhatsApp. Respect the student's recorded contact preferences and obtain consent before sending a message. The WhatsApp Cloud API, automated delivery tracking, bulk campaigns, SMS, AI calling, and cloud telephony are not connected.

## Local demo mode

Without both Supabase variables, the dashboard uses clearly-labelled sample data. Changes are stored in the current browser only; uploads are not persisted and demo document previews are unavailable. Configure Supabase before entering real student or payment information.

## Workspace membership troubleshooting

If a signed-in account sees **Workspace database setup is incomplete**, the organization schema is not available to the app. In the Supabase project configured for this app, run `schema.sql` first and then `migrations/20261023000000_multi_tenant_crm.sql` in SQL Editor. Refresh the CRM after both scripts complete. Do not run the organization migration against a different Supabase project.

If the schema is present but the account has no workspace, confirm that the user exists in Supabase Auth and that the organization migration completed successfully. Existing Auth users are backfilled by that migration; new users receive a workspace from the provisioning trigger. For invited team members, verify that the pending invitation email exactly matches the account email.

## Updating schema

The base schema and organization migration are designed to be re-runnable. Apply future production changes through reviewed, versioned migrations and data-preserving `ALTER TABLE` statements instead of dropping live tables.
