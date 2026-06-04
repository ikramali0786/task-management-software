import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

/**
 * Public privacy policy. Plain, self-contained static page — no auth required.
 * Linked from the cookie-consent banner and auth pages so GDPR disclosures are
 * always reachable.
 */

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8">
    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
    <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      {children}
    </div>
  </section>
);

export const PrivacyPage = () => {
  const lastUpdated = 'June 4, 2026';

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to TaskFlow
        </Link>

        <div className="mb-6 inline-flex rounded-2xl bg-brand-500 p-3">
          <Shield className="h-6 w-6 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {lastUpdated}</p>

        <Section title="1. Who we are">
          <p>
            TaskFlow is a team task-management application. This policy explains what personal
            data we collect, why we collect it, and the rights you have over it. If you have
            questions, contact us at{' '}
            <a href="mailto:ikram.ali3811@gmail.com" className="text-brand-500 hover:underline">
              ikram.ali3811@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="2. Data we collect">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Account data</strong> — your name, email address, and a securely hashed password.</li>
            <li><strong>Content data</strong> — teams, tasks, comments, attachments, and activity you create in the app.</li>
            <li><strong>Technical data</strong> — authentication tokens and, where you consent, limited analytics about how the app is used.</li>
          </ul>
        </Section>

        <Section title="3. How we use your data">
          <p>We process your data to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Provide and secure your account and the task-management features.</li>
            <li>Send transactional email (password resets, email verification, team invites, due-date reminders).</li>
            <li>Maintain security audit logs and prevent abuse.</li>
          </ul>
          <p>We do not sell your personal data.</p>
        </Section>

        <Section title="4. Cookies & local storage">
          <p>
            We use strictly necessary browser storage to keep you signed in (your authentication
            token) and to remember your cookie preference. These are essential to operate the
            service and are always active. Any non-essential storage is only used after you
            accept it in the consent banner, and you can withdraw consent at any time by clearing
            it below.
          </p>
        </Section>

        <Section title="5. Legal basis (GDPR)">
          <p>
            Where GDPR applies, we process account and content data to perform our contract with
            you (providing the service), and technical/analytics data on the basis of your
            consent or our legitimate interest in keeping the service secure.
          </p>
        </Section>

        <Section title="6. Data retention">
          <p>
            We keep your account and content data for as long as your account is active.
            Notifications are automatically deleted after 90 days. When you delete your account,
            we remove your personal data, except where we are legally required to retain it.
          </p>
        </Section>

        <Section title="7. Your rights">
          <p>
            Subject to applicable law, you have the right to access, correct, export, or delete
            your personal data, and to object to or restrict certain processing. To exercise any
            of these rights, email{' '}
            <a href="mailto:ikram.ali3811@gmail.com" className="text-brand-500 hover:underline">
              ikram.ali3811@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="8. Security">
          <p>
            Passwords are hashed, transport is encrypted over HTTPS, refresh tokens are stored in
            httpOnly cookies, and security-relevant events are audit-logged. No system is perfectly
            secure, but we take reasonable measures to protect your data.
          </p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will be reflected by the
            “Last updated” date above.
          </p>
        </Section>

        <div className="mt-12 border-t border-slate-200 pt-6 dark:border-slate-800">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} TaskFlow. This document is provided for transparency and
            does not constitute legal advice.
          </p>
        </div>
      </div>
    </div>
  );
};
