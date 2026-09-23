import { GoogleSignInButton } from "./google-sign-in-button";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  missing_code: "Google did not return a sign-in code. Please try again.",
  pkce_code_verifier_not_found:
    "This sign-in link only works in the browser that started it. Please try again.",
  flow_state_not_found:
    "That sign-in link has already been used. Please try again.",
  flow_state_expired: "That sign-in link expired. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // `error` comes straight off the query string, so it must never be rendered
  // as-is: /login?error=<anything> would otherwise display attacker-chosen copy
  // on our own origin, which is a good place to put a fake "call support" line.
  // Object.hasOwn also keeps the lookup off Object.prototype, where "constructor"
  // or "__proto__" would resolve to a function or object and make React throw.
  const message = !error
    ? null
    : Object.hasOwn(ERROR_MESSAGES, error)
      ? ERROR_MESSAGES[error]
      : "Sign-in failed. Please try again.";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Personal Finance Tracker
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign in to track your income and expenses.
          </p>
        </div>

        {message ? (
          <p
            role="alert"
            className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {message}
          </p>
        ) : null}

        <GoogleSignInButton />
      </div>
    </main>
  );
}
