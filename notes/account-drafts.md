# DeedCraft account rollout

1. Apply `supabase/account-drafts-v1.sql` in the Supabase project SQL editor before deploying the app. It creates the drafts table, owner policies, and revision-checked save function.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Render service and local `.env.local`. Use the project's publishable key. Configure both before building the app because Vite embeds them in the browser bundle. Leave the existing shared template configuration in place.
3. In Supabase Auth, enable email sign-up and email confirmation. Connect a custom SMTP sender and configure Google using a public Google OAuth application. Add the Supabase Google callback shown in the provider settings to the Google OAuth client.
4. Set the Supabase site URL to the production origin. Allow the app entry URLs for production and local development, including `/`, `/applications/`, `/reference-plan/`, and `/step13-reference-plan/` on each authorized origin. Include any alternate route spelling used in deployment.
5. Verify email confirmation, recovery and Google sign-in with test accounts before public rollout. After saving a draft with a fictional upload, open the account in another browser. The draft should sync and the original file should remain on the device that attached it. Confirm a second account sees an empty workspace.

Source uploads and custom template files use account-scoped IndexedDB. The user should keep a separate copy of original files. AI extraction still sends documents through the existing extraction service when invoked. Earlier anonymous browser drafts are left in place and are skipped by account storage.

