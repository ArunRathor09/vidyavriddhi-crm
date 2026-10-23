# Vidyavriddhi CRM — Supabase setup

The CRM uses Supabase Auth, its PostgreSQL database through the Supabase Data API, and a private Storage bucket. The app only needs the project URL and publishable key; `DATABASE_URL` is not required at runtime. Every table and file is scoped to the authenticated Supabase user with row-level security.

## Connect a project

1. Open **SQL Editor** in the Supabase project whose URL is configured in `.env`.
2. Open [`schema.sql`](./schema.sql), copy its complete contents, paste them into a new SQL Editor query, and run it. This creates the eight CRM tables, indexes, per-user RLS policies, timestamp triggers, and private `student-documents` bucket.
3. In **Project Settings → API**, ensure the matching Project URL and publishable key are configured in `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

4. Restart the Next.js server, open `/login`, and create an account. If email confirmation is enabled in Supabase Auth, confirm the message before signing in.
5. Open `/settings`. The connection should report active after the CRM tables are created and the signed-in account can read them.

Do not put a Supabase secret/service-role key in the browser, a `NEXT_PUBLIC_` variable, or this file. Never commit `.env.local`.

## Tables and access control

The SQL creates leads, student profiles, follow-ups, colleges, applications, documents, payments, and activities. Each row has a `user_id` that defaults to `auth.uid()`. Row-level-security policies limit reads and writes to the signed-in owner. The API independently verifies the current user and scopes updates and deletes to that same user.

Student documents are stored in the private `student-documents` bucket under a per-user folder. The UI uploads PDFs and common image types (up to 10 MB), stores only the object path in the database, and creates a signed link that expires after 60 seconds when a counsellor previews a document.

## Local demo mode

Without both Supabase variables, the dashboard uses clearly-labelled sample data. Changes are stored in the current browser only; uploads are not persisted and demo document previews are unavailable. Configure Supabase before entering real student or payment information.

## Updating schema

The current SQL is designed to be re-runnable for the existing table and policy definitions. For future production changes, use versioned Supabase migrations and review data-preserving `ALTER TABLE` statements instead of dropping live tables.
