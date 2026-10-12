# Supabase setup

The CRM uses Supabase Auth, its PostgreSQL database, and a private Storage bucket. The browser only uses the project URL and anon/publishable key; every table and file is scoped to the authenticated Supabase user with row-level security.

## Connect a project

1. Create a Supabase project and open **SQL Editor**.
2. Run [`schema.sql`](./schema.sql) to create the CRM tables, indexes, RLS policies, and private `student-documents` bucket.
3. Copy the project URL and anon/publishable key from **Project Settings → API** into `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   ```

4. Restart the Next.js development server and open `/login`.
5. Create the first account. If email confirmation is enabled in Supabase Auth, confirm the message before signing in.

Do not put a Supabase service-role key in the browser, a `NEXT_PUBLIC_` variable, or this file. Never commit `.env.local`.

## Tables and access control

The SQL creates leads, student profiles, follow-ups, colleges, applications, documents, payments, and activities. Each row has a `user_id` that defaults to `auth.uid()`. Row-level-security policies limit reads and writes to the signed-in owner. The API independently verifies the current user and scopes updates and deletes to that same user.

Student documents are stored in the private `student-documents` bucket under a per-user folder. The UI uploads PDFs and common image types (up to 10 MB), stores only the object path in the database, and creates a signed link that expires after 60 seconds when a counsellor previews a document.

## Local demo mode

Without both Supabase variables, the dashboard uses clearly-labelled sample data. Changes are stored in the current browser only; uploads are not persisted and demo document previews are unavailable. Configure Supabase before entering real student or payment information.

## Updating schema

The schema is safe to run again for the current table and policy definitions. For future production changes, use versioned Supabase migrations and review data-preserving `ALTER TABLE` statements instead of dropping live tables.
