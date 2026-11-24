/**
 * The console's sign-in page: an email address and password, the Google and GitHub buttons when the platform
 * offers them, and links to sign up and to reset a password. A signed-in user is sent on to the page they came
 * for, which the next parameter names.
 */
import { gettext } from "@smarter/common";
import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router";

import { AuthCard } from "@/components/AuthCard";
import { SignInForm } from "@/components/SignInForm";
import type { AccountErrors } from "@/contract.gen";
import { accountErrors, isInactiveAccount, signIn } from "@/lib/account";
import { nextRoute } from "@/lib/next";
import { useConsoleSession } from "@/session/context";

const NO_ERRORS: AccountErrors = { detail: "", fieldErrors: {} };

export function LoginPage() {
  const { session, replace } = useConsoleSession();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<AccountErrors>(NO_ERRORS);
  const [inactive, setInactive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!session) return null;
  const next = nextRoute(searchParams);
  if (session.isAuthenticated) {
    return <Navigate to={next} replace />;
  }
  const { signIn: options } = session;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setErrors(NO_ERRORS);
    setInactive(false);
    try {
      replace(await signIn(session.cookies, { email, password }));
    } catch (e) {
      setErrors(accountErrors(e));
      // the right password of an account that isn't activated yet.
      setInactive(isInactiveAccount(e));
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title={gettext("Sign In")}>
      <SignInForm
        options={options}
        next={next}
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={(event) => void handleSubmit(event)}
        errors={errors}
        inactive={inactive}
        submitting={submitting}
      />
    </AuthCard>
  );
}
