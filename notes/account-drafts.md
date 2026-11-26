# DeedCraft account rollout

1. Apply `supabase/account-drafts-v1.sql` in the Supabase project SQL editor before deploying the app. It creates the drafts table, owner policies, and revision-checked save function.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Render service and local `.env.local`. Use the project's publishable key. Configure both before building the app because Vite embeds them in the browser bundle. Leave the existing shared template configuration in place.
3. In Supabase Auth, enable email sign-up and email confirmation. Connect a custom SMTP sender and configure Google using a public Google OAuth application. Add the Supabase Google callback shown in the provider settings to the Google OAuth client.
4. Set the Supabase site URL to the production origin. Allow the app entry URLs for production and local development, including `/`, `/applications/`, `/reference-plan/`, and `/step13-reference-plan/` on each authorized origin. Include any alternate route spelling used in deployment.
5. Verify email confirmation, recovery and Google sign-in with test accounts before public rollout. After saving a draft with a fictional upload, open the account in another browser. The draft should sync and the original file should remain on the device that attached it. Confirm a second account sees an empty workspace.

Source uploads and custom template files use account-scoped IndexedDB. The user should keep a separate copy of original files. AI extraction still sends documents through the existing extraction service when invoked. Earlier anonymous browser drafts are left in place and are skipped by account storage.

Registration collects a name and policy acknowledgement, followed by email verification and contact mobile entry and an optional communication address. Profile fields and the acknowledged policy version/time live in the authenticated user's Supabase Auth metadata. Email verification status comes from Supabase. The contact mobile number is stored in profile metadata and does not trigger OTP delivery. Profile metadata does not grant administrative permissions.

Configure Supabase Phone Auth with the WhatsApp delivery hook described below and require phone confirmation before releasing mandatory mobile onboarding. Sending or resending a phone-change code uses the signed-in account; verification uses `phone_change`. Keep email confirmation and secure email change enabled. Configure the provider's delivery settings and any required Indian sender/template approvals. WhatsApp credentials and delivery costs belong to the business account and are not supplied by this repository.

The policy pages are available before login at `/?policy=terms` and `/?policy=privacy`. The operator supplied Gundlapelli Sampath and saisriplanners11@gmail.com as the contact. Review the drafted notices against actual hosting, AI provider contracts, retention configuration and applicable Indian law before publication. These drafts do not certify legal compliance. A new policy version prompts acknowledgement again.

## Deferred WhatsApp OTP setup

Mobile verification is deferred. The current account form saves the contact number and requires email verification only. The following setup is retained for later activation. The Send SMS hook is Supabase's technical hook name. Its delivery implementation uses Meta's WhatsApp Cloud API. Supabase generates the OTP and verifies it using the existing phone_change flow. Do not use signInWithOtp for this profile step because that can sign the person into a different phone account.

1. Create or use a Meta developer business app with WhatsApp, a WhatsApp Business Account and a registered business sender number. Complete any required business and sender verification.
2. Create an approved AUTHENTICATION template with a COPY_CODE button, for example deedcraft_verification, with a six-digit code in the body and the button. Choose a supported language and record the exact template name and language code.
3. Obtain a server access token with whatsapp_business_messaging permission for that sender. Store it as an Edge Function secret, never as a VITE variable.
4. Deploy supabase/functions/send-whatsapp-otp/index.ts as send-whatsapp-otp with gateway JWT verification disabled for this function only. The function itself validates the raw signed Supabase webhook.
5. In Supabase Authentication → Hooks, configure a Send SMS HTTP hook pointing to https://<project-ref>.supabase.co/functions/v1/send-whatsapp-otp. Store the generated hook signing secret as SEND_SMS_HOOK_SECRET in Edge secrets.
6. Add Edge secrets WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_OTP_TEMPLATE_NAME, WHATSAPP_OTP_TEMPLATE_LANGUAGE and WHATSAPP_GRAPH_VERSION. Set a currently supported Graph version such as v27.0 only after confirming it in the Meta app. Secrets must be stored before activating the hook.
7. Enable Phone Auth, require phone confirmation, set a six-digit code with 600-second expiry, and set account/phone rate limits to the delivery budget. The browser has a resend cooldown and Supabase owns rate limiting and expiry enforcement.
8. Test a code on an authorised real WhatsApp recipient, reject wrong and expired codes, resend, and verify that the original email account ID and its drafts stay attached. Test send failures and numbers without WhatsApp. An accepted Meta API response queues the message and does not prove device delivery.

Meta authentication messages have usage fees. Development/test numbers have recipient restrictions. Confirm the current rate card and spending limit before adding billing or sending production messages. This implementation does not configure or send future application update messages.

References
- https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/
- https://business.whatsapp.com/products/platform-pricing
