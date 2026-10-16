# Template library on Render Free

1. Create or choose a Supabase project you control. Enable its Data API with the `public` schema exposed.
2. Run [template-library.sql](template-library.sql) in that project's SQL Editor. This creates one private `deed-templates` bucket and an RLS-protected metadata table. It does not delete an existing library. Use a dedicated bucket with no policies granting browser users access. If a bucket already exists, verify it is private and accepts DOCX files up to 20 MB.
3. Copy the project's URL and server secret key from its API settings. A legacy service-role JWT is also supported. Do not use the anon or publishable key. Do not put the key in chat, Git, screenshots, or any `VITE_` variable.
4. In the existing Render service's Environment page, set:

   | Variable | Value |
   | --- | --- |
   | `TEMPLATE_STORAGE_BACKEND` | `supabase` |
   | `SUPABASE_URL` | Your project URL, e.g. `https://PROJECT.supabase.co` |
   | `SUPABASE_SECRET_KEY` | Your server secret key |
   | `SUPABASE_TEMPLATE_BUCKET` | `deed-templates` |
   | `TEMPLATE_ADMIN_PASSWORD` | A strong password you choose |

   If using a legacy JWT, set `SUPABASE_SERVICE_ROLE_KEY` instead of `SUPABASE_SECRET_KEY`. Remove stale Supabase keys when switching projects. `TEMPLATE_STORAGE_DIR` is ignored with this backend. Keep the existing AI-provider variables.
5. Deploy the updated code. Keep Render on Free, one instance. The first Templates request seeds the bundled Sale v6 only if no shared metadata row exists. Sign in under Dashboard → Templates, download the template, then upload/configure/validate/review/publish as before.
6. Verify from another browser that new drafts use the published version. Restart the Render service and verify the same active version remains. Existing saved deeds stay in their original browser storage.

Only the app server communicates with Supabase. Published downloads still pass through the app; unpublished versions, reports and samples still require administrator login. No public object URLs are returned. Template files are immutable; samples use content-addressed filenames. Metadata is saved with a database compare-and-swap revision check. Conflicts return 409 and require a refresh; failures never fall back to disk or another template. Administrator sessions remain in memory and expire when the server restarts; sign in again.

## Sharing the library with local development

Set the same five variables above in the ignored `.env.local` file and restart Vite. The project URL and bucket must match Render exactly. Use the same project server key; never commit it. Local uploads, configuration, publication and rollback then change the same library used by production. This centralizes templates only: saved deeds and evidence remain in each browser. Do not publish experimental templates to this shared project. The isolated template browser test explicitly selects a temporary disk backend so it cannot modify the shared Supabase library.

## Existing libraries and backups

Switching backends starts a separate library; it does not copy disk files automatically. Do not switch a production disk library with published custom templates until it has been migrated. For a fresh setup with only bundled Sale v6, automatic seeding is sufficient. Browser drafts cache verified pinned bytes, but uncached old version IDs require their original files in the selected backend.

Back up both the complete `deed_template_library` row (including `revision`) and every object in the private bucket. Database backups alone do not contain Storage object bytes. Prevent uploads/configuration/publication while exporting or restoring so metadata and files agree. Restore files first and metadata last into an empty/dedicated target, preserve privacy, then point Render at it and restart. Retain historical DOCX and sample files; do not delete unreferenced objects automatically because failed/conflicting operations may still be under review.

Supabase outages, paused projects, quota limits, missing SQL grants or incorrect keys produce retryable library errors. Check project availability, Storage quota, bucket privacy and Data API configuration. The app does not create paid resources, automatically keep projects awake, or bypass provider limits.
