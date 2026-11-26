import { POLICY_VERSION } from './account-profile';

export function AccountPolicies({ kind }: { kind: 'terms' | 'privacy' }) {
  return <main className="dc-policy">
    <a href="/">DeedCraft · Return to sign in</a>
    <h1>{kind === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</h1>
    <p>Version {POLICY_VERSION} · Operator and privacy contact — Gundlapelli Sampath, <a href="mailto:saisriplanners11@gmail.com">saisriplanners11@gmail.com</a>.</p>
    {kind === 'terms' ? <>
      <h2>Using DeedCraft</h2>
      <p>DeedCraft provides tools to prepare deeds, applications and property plans. By creating an account or using the service, you agree to these terms. Use an account you are authorised to operate and provide accurate registration details. Keep your password and verification codes confidential.</p>
      <h2>Your documents and authority</h2>
      <p>You retain your rights in the material you provide. You authorise processing needed to save drafts, extract requested information and generate your documents. Provide personal information and third-party documents only when you have the necessary authority and a lawful purpose.</p>
      <h2>Review before use</h2>
      <p>Extraction and drafting can contain errors or omissions. Review names, identities, amounts, property details, clauses and the complete generated document before signing, filing or relying on it. Obtain appropriate professional advice for your transaction. Preparing a draft in DeedCraft does not complete registration or establish title.</p>
      <h2>Acceptable use and availability</h2>
      <p>Do not use the service for fraud, forged documents, unlawful disclosure or unauthorised access. The operator may restrict misuse and investigate security incidents. Features and availability may change. Keep your own copies of important documents and uploads.</p>
      <h2>Account and local files</h2>
      <p>Draft details are saved under your account. Source files and custom Word templates are stored in the browser where you attach them. Browser data can be removed, and these files may need to be attached again on another device. When you request AI extraction, the selected documents are transmitted for processing as described in the Privacy Policy.</p>
      <h2>Ending use and complaints</h2>
      <p>You can stop using the service and request account closure or assistance by emailing the operator from your account email. Applicable statutory rights and remedies remain available. Indian law applies, subject to mandatory law and the jurisdiction of competent courts. Material changes to these terms will require renewed acknowledgement in the app.</p>
    </> : <>
      <h2>Information and purposes</h2>
      <p>We process your name, email verification status and contact mobile number to create, secure and support your account. Optional office, profession and communication address details complete your account profile. Passwords and one-time codes are handled by the authentication service. We record the policy version you acknowledge and the acknowledgement time.</p>
      <p>Drafts can contain party identities, contact details, property information, payments and extracted facts. We process this information to save and reopen your work and generate the documents you request. Provide only information needed for the transaction and obtain any required authority to supply other people’s data.</p>
      <h2>Where information goes</h2>
      <p>Supabase provides account authentication and database hosting. Render hosts the application and its processing endpoints. Google handles Google sign-in when selected. Configured email providers deliver email verification messages. Your mobile number is saved as a contact detail. The selected AI provider, Google Gemini or Anthropic, processes documents and instructions when you request an AI feature.</p>
      <p>Uploaded source files and custom templates are retained in your browser’s IndexedDB under your account. They are transmitted through the application server to the configured AI provider when you request extraction or analysis. Extracted facts and draft details are stored in the cloud. Service providers may process information outside India, subject to applicable law and their service terms.</p>
      <h2>Administrator access</h2>
      <p>Authorised DeedCraft administrators can view account contact profiles, saved draft details and usage summaries to operate and support the service. Other regular users cannot view your work. Admin access is checked by the database and does not include passwords or original files retained only on your device.</p>
      <h2>Storage and security</h2>
      <p>We use account authentication and database ownership rules to restrict access to drafts. Authentication sessions use browser storage. Hosting and processing services may generate operational and security logs. No system can guarantee uninterrupted availability or absolute security.</p>
      <p>Saved drafts remain available until you delete them or request account closure, subject to legal retention requirements. Service logs and any provider backups follow the configured provider retention periods. Clearing browser storage removes locally retained files. Account closure requests should identify whether you also need help removing data on your device.</p>
      <h2>Your choices and requests</h2>
      <p>You can edit your profile and change contact details through account settings, with verification of a new email address. You can delete drafts in the app. For access, correction, erasure, withdrawal of consent, account closure or a privacy grievance, email Gundlapelli Sampath at the contact above. We may verify your identity before acting. Withdrawal may limit the features that need the information. Records required by applicable law may be retained.</p>
      <h2>Indian privacy framework</h2>
      <p>This notice describes DeedCraft’s processing for users in India. Applicable requirements include the Information Technology Act, 2000 and related rules, and provisions of the Digital Personal Data Protection Act, 2023 and its rules as they come into force. You may use the complaint routes available under applicable law. Changes to processing purposes or this notice will be reflected here and, where required, presented for renewed consent.</p>
      <p>The service is intended for adults managing documents. If you believe a child has independently created an account, contact the operator. Party information about minors should be supplied by an authorised adult for a lawful drafting purpose.</p>
    </>}
    <p>Contact <a href="mailto:saisriplanners11@gmail.com">saisriplanners11@gmail.com</a> for assistance or a policy explanation in your preferred language.</p>
  </main>;
}
