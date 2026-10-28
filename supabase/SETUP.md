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

## WhatsApp Cloud API

To enable one-to-one follow-ups:

1. In [Meta for Developers](https://developers.facebook.com/apps/), create/select a Meta app, add WhatsApp Cloud API, connect the business WhatsApp number, and grant the app `whatsapp_business_messaging` permission. Use a permanent/system-user access token for production rather than a short-lived test token.
2. In WhatsApp Manager, create and wait for approval of a utility/follow-up template. The current CRM sender expects exactly one body text variable, populated with the lead's name. Keep the approved template name and language code as shown by Meta.
3. Configure the following values in the server's ignored `.env.local` (never in a `NEXT_PUBLIC_` variable):

   ```dotenv
   WHATSAPP_ACCESS_TOKEN=
   WHATSAPP_PHONE_NUMBER_ID=
   WHATSAPP_GRAPH_API_VERSION=
   WHATSAPP_TEMPLATE_NAME=
   WHATSAPP_TEMPLATE_LANGUAGE=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

   `WHATSAPP_PHONE_NUMBER_ID` is the Cloud API phone-number ID, not the visible phone number. `WHATSAPP_GRAPH_API_VERSION` must be a supported Meta Graph API version, such as `vXX.X` with the current version substituted. The service-role key is needed for protected message-audit writes.
4. Restart the Next.js server and open **Settings → WhatsApp Cloud API**. The readiness check identifies missing environment variable names without exposing secret values. It verifies configuration presence only; send a permitted test to an opted-in contact to verify token permissions and template setup.
5. In **Leads**, save each student's number in international format (for example `+919876543210`) and record explicit WhatsApp opt-in. Use the row's WhatsApp action to review the recipient and confirm before sending.

The CRM rechecks organization access, E.164-style phone format, and opt-in on the server; it submits only the configured approved template and writes the result to the organization-scoped message audit table. An accepted response means Meta accepted the request, not that the message was delivered. Outside the customer-service window, use an approved template; free-form messaging and inbound/delivery webhooks are not currently implemented. Never send unsolicited messages or share access tokens/service-role keys in chat.

SMS, bulk campaigns, AI calling, and cloud telephony are not marked as connected: no provider credentials or configuration were provided for those services.

## Local demo mode

Without both Supabase variables, the dashboard uses clearly-labelled sample data. Changes are stored in the current browser only; uploads are not persisted and demo document previews are unavailable. Configure Supabase before entering real student or payment information.

## Workspace membership troubleshooting

If a signed-in account sees **Workspace database setup is incomplete**, the organization schema is not available to the app. In the Supabase project configured for this app, run `schema.sql` first and then `migrations/20261023000000_multi_tenant_crm.sql` in SQL Editor. Refresh the CRM after both scripts complete. Do not run the organization migration against a different Supabase project.

If the schema is present but the account has no workspace, confirm that the user exists in Supabase Auth and that the organization migration completed successfully. Existing Auth users are backfilled by that migration; new users receive a workspace from the provisioning trigger. For invited team members, verify that the pending invitation email exactly matches the account email.

## Updating schema

The base schema and organization migration are designed to be re-runnable. Apply future production changes through reviewed, versioned migrations and data-preserving `ALTER TABLE` statements instead of dropping live tables.
