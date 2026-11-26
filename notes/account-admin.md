# DeedCraft admin console

Apply `supabase/account-admin-v1.sql` after the account-drafts migration. It adds a private admin membership table, read-only admin RPCs and a server-generated last-save timestamp. Existing owner RLS is unchanged. No service key is shipped to the browser.

The admin entry point is `/?admin=1`. Confirmed administrators land there automatically after sign-in or when opening the main app. My workspace opens `/?workspace=1` explicitly; authenticated links to application/plan tools remain usable. The chart data table lists dates newest first while the graph retains chronological order. It uses the existing Supabase email/password or Google login. Ordinary accounts receive an access-denied screen; all data RPCs independently check membership inside PostgreSQL. User-editable metadata never grants access.

Apply `supabase/account-admin-enrollment-v1.sql` once to reserve the user-authorised admin address, sampath.gundlapelli@gmail.com. An existing confirmed account is assigned immediately; otherwise registration and email confirmation activate the role. Unconfirmed registration does not grant access. The reservation is consumed on assignment. Do not rerun this enrollment file after intentionally revoking this admin.

To revoke, a trusted database operator removes the account ID from account_admins and any outstanding email reservation. Membership is checked on each RPC, including calls from already-open dashboards. Additional admin grants are a separate explicit operator decision.

The console includes registration/verification totals, users with saved work, current record counts, 30-day daily registrations and latest-update charts, category distribution, paginated user search/contact profiles, owner/category work filtering and expandable read-only saved data. It never exposes passwords, tokens or auth identity records. Source files remain in account-scoped device storage and are unavailable centrally.

Activity is a snapshot of current records by their latest server save timestamp, not a log of every save. Old rows without a server timestamp display Not recorded. Daily charts use Asia/Kolkata. No historic activity timestamps are invented.

Validation: run qa/account-admin-access.sql in the Supabase SQL editor. Its fixtures and synthetic grants are rolled back. Verify anonymous/non-admin denial, metadata escalation resistance, verified-only enrollment, admin search/pagination/details and unchanged cross-owner write/delete restrictions. Run npm run typecheck and npm run build. Confirm the reserved administrator signs in after verifying the email and can view real users/work.

Render needs no new secret or environment variable. Deploy the application after the database migrations. Dashboard errors remain visible with a refresh action.
