/**
 * The sign-in page's form: the Google and GitHub buttons when the platform offers them, the email address and
 * password, the forgotten password link, the Sign In button and the link to sign up.
 *
 * The sign-in page (routes/LoginPage) runs it. The page of one doodle (routes/DoodlePage) shows it as a mockup,
 * with ``preview``: the same controls, empty and inert, so that the page looks exactly like the sign-in page with
 * that doodle, and nothing on it can be focused, typed into or submitted.
 */
import { gettext } from "@smarter/common";
import type { FormEvent } from "react";
import { Link } from "react-router";

import { FormError, TextField } from "@/components/FormFields";
import type { AccountErrors, ConsoleSession } from "@/contract.gen";
import { INACTIVE_PATH } from "@/lib/const";

/** The url that starts signing in with an OAuth provider, and comes back to the console's next route. */
function oauthUrl(backend: string, next: string): string {
  const query = new URLSearchParams({ next });
  return `/social-auth/login/${backend}/?${query.toString()}`;
}

const NO_ERRORS: AccountErrors = { detail: "", fieldErrors: {} };

export interface SignInFormProps {
  /** The platform's sign-in options: which OAuth providers it offers, and whether visitors may sign up. */
  options: ConsoleSession["signIn"];
  /** The console route to come back to after signing in with an OAuth provider. */
  next?: string;
  email?: string;
  password?: string;
  onEmailChange?: (value: string) => void;
  onPasswordChange?: (value: string) => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  errors?: AccountErrors;
  /** The right password of an account that isn't activated yet. */
  inactive?: boolean;
  submitting?: boolean;
  /** A mockup: the same controls, empty and inert. */
  preview?: boolean;
}

export function SignInForm({
  options,
  next = "/",
  email = "",
  password = "",
  onEmailChange = () => {},
  onPasswordChange = () => {},
  onSubmit = (event) => event.preventDefault(),
  errors = NO_ERRORS,
  inactive = false,
  submitting = false,
  preview = false,
}: SignInFormProps) {
  return (
    <div inert={preview} aria-hidden={preview || undefined} data-testid={preview ? "sign-in-preview" : undefined}>
      {(options.google || options.github) && (
        <div className="d-grid gap-3 mb-6">
          {options.google && (
            <a className="btn btn-light border" href={oauthUrl("google-oauth2", next)}>
              {gettext("Sign in with Google")}
            </a>
          )}
          {options.github && (
            <a className="btn btn-light border" href={oauthUrl("github", next)}>
              {gettext("Sign in with GitHub")}
            </a>
          )}
        </div>
      )}
      <form onSubmit={onSubmit} noValidate>
        <FormError message={errors.detail} />
        {inactive && (
          <p className="text-center">
            <Link to={INACTIVE_PATH}>{gettext("Send a new activation link")}</Link>
          </p>
        )}
        <TextField
          label={gettext("Email")}
          type="email"
          name="email"
          autoComplete={preview ? "off" : "email"}
          required
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          errors={errors.fieldErrors.email}
        />
        <TextField
          label={gettext("Password")}
          type="password"
          name="password"
          autoComplete={preview ? "off" : "current-password"}
          required
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          errors={errors.fieldErrors.password}
        />
        <div className="d-flex justify-content-end mb-6">
          <Link to="/password-reset-request">{gettext("Forgot Password ?")}</Link>
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
          {gettext("Sign In")}
        </button>
      </form>
      {options.signUp && (
        <p className="text-center text-gray-600 mt-6 mb-0">
          {gettext("Not a Member yet?")} <Link to="/register">{gettext("Sign up")}</Link>
        </p>
      )}
    </div>
  );
}
