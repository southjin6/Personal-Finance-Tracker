import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Personal Finance Tracker",
  description:
    "What Personal Finance Tracker collects, where it is stored, and how to have it deleted.",
};

const HEADING = "mt-8 text-base font-semibold tracking-tight";
const BODY = "text-muted-foreground mt-2 text-sm leading-relaxed";
const LIST = "text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm";

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 justify-center p-6">
      <article className="w-full max-w-2xl py-4">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Personal Finance Tracker
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Privacy Policy
        </h1>
        <p className={BODY}>Last updated 27 September 2026.</p>

        <h2 className={HEADING}>What this is</h2>
        <p className={BODY}>
          Personal Finance Tracker is a personal project for recording income
          and expenses and seeing where your money goes. It is not a commercial
          financial service, and it does not connect to your bank or read any
          account you hold elsewhere.
        </p>

        <h2 className={HEADING}>What is collected</h2>
        <ul className={LIST}>
          <li>
            When you sign in with Google: your email address, your name, and
            your profile picture URL, as provided by Google.
          </li>
          <li>
            What you enter yourself: the financial records you create —
            transactions, categories, budgets, and savings goals — including the
            amounts, dates, and notes you give them.
          </li>
        </ul>

        <h2 className={HEADING}>How it is used</h2>
        <p className={BODY}>
          Only to show you your own data and to keep you signed in. There is no
          profiling, no advertising, and no automated decision-making about you.
        </p>

        <h2 className={HEADING}>Where it is stored</h2>
        <p className={BODY}>
          Your data is stored in a Supabase-hosted PostgreSQL database. Row-level
          security is enabled, so each account can only read and write its own
          rows. Signing in sets a session cookie, which is marked HttpOnly and is
          used only for authentication — not for tracking you across sites.
        </p>
        <p className={BODY}>
          Four outside services are involved in running the app:
        </p>
        <ul className={LIST}>
          <li>Google — to sign you in.</li>
          <li>
            Google&apos;s image CDN (lh3.googleusercontent.com) — serves your
            profile picture to your browser.
          </li>
          <li>Supabase — stores the data described above.</li>
          <li>Vercel — hosts the website.</li>
        </ul>

        <h2 className={HEADING}>What is not done</h2>
        <p className={BODY}>
          Your data is not sold, rented, or shared with anyone for marketing.
          There are no advertising networks, no third-party analytics, and no
          tracking pixels on this site.
        </p>

        <h2 className={HEADING}>Deleting your data</h2>
        <p className={BODY}>
          Signing out ends your session. To have your account and everything
          stored with it permanently deleted, email the address below and it will
          be removed.
        </p>

        <h2 className={HEADING}>Changes</h2>
        <p className={BODY}>
          If this policy changes, the date at the top of this page will change
          with it.
        </p>

        <h2 className={HEADING}>Contact</h2>
        <p className={BODY}>johnalaba32@gmail.com</p>
      </article>
    </main>
  );
}
