import { StoreHeader } from "@/components/store-header";
import { signIn, signUp, requestPasswordReset } from "./actions";
import { safeCustomerNext } from "@/lib/auth-validation";
import { SubmitButton } from "@/components/submit-button";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const q = await searchParams;

  return (
    <>
      <StoreHeader />
      <main className="auth-page">
        <section>
          <p className="eyebrow">WELCOME</p>
          <h1>Your account</h1>
          <p>Sign in to view your orders, manage your delivery details, and continue shopping.</p>

          {q.error && (
            <p role="alert" className="form-error">
              {q.error.slice(0, 250)}
            </p>
          )}
          {q.message && (
            <p role="status" className="form-success">
              {q.message.slice(0, 300)}
            </p>
          )}

          <form className="stack-form">
            <input type="hidden" name="next" value={safeCustomerNext(q.next)} />
            <label>
              Email
              <input
                name="email"
                type="email"
                maxLength={254}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                maxLength={128}
                autoComplete="current-password"
                required
              />
            </label>
            <p className="fine-print">
              <strong>New accounts:</strong> Choose a unique password of at least
              12 characters. For better security, include uppercase letters,
              numbers, or symbols.
            </p>
            <p className="fine-print">
              If email confirmation is enabled, confirm your address before
              signing in.
            </p>
            <SubmitButton formAction={signIn} pendingText="Signing in…">
              Sign in
            </SubmitButton>
            <SubmitButton
              formAction={signUp}
              className="button secondary submit-button"
              pendingText="Creating account…"
            >
              Create customer account
            </SubmitButton>
          </form>

          <details className="stack-form">
            <summary>Forgot your password?</summary>
            <form action={requestPasswordReset} className="stack-form">
              <label htmlFor="reset-email">Email address</label>
              <input
                id="reset-email"
                name="email"
                type="email"
                maxLength={254}
                autoComplete="email"
                placeholder="Enter your email"
                required
              />
              <SubmitButton
                className="button secondary submit-button"
                pendingText="Sending link…"
              >
                Email me a reset link
              </SubmitButton>
            </form>
          </details>
        </section>
      </main>
    </>
  );
}
