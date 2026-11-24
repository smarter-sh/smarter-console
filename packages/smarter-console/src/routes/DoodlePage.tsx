/**
 * The page of one doodle, /doodles/<date>/<region>/, which the dashboard's Newest Doodles link to: a mockup of the
 * sign-in page as it looked with that doodle. The left panel shows the doodle, with its caption and credit, and the
 * right side the sign-in form, empty and inert (components/SignInForm, with preview). Doodles are public, so a
 * visitor who isn't signed in sees the page too. A doodle that doesn't exist, isn't approved, or is of a day after
 * tomorrow answers 404, and the panel shows the base scene, as the sign-in page does.
 */
import { gettext } from "@smarter/common";
import { useParams } from "react-router";

import { AuthCard } from "@/components/AuthCard";
import { SignInForm } from "@/components/SignInForm";
import { doodleApiUrl } from "@/lib/const";
import { useConsoleSession } from "@/session/context";

export function DoodlePage() {
  const { session } = useConsoleSession();
  const { date = "", region = "" } = useParams();
  const apiUrl = doodleApiUrl(date, region);

  if (!session) return null;

  return (
    <AuthCard title={gettext("Sign In")} doodleApiUrl={apiUrl}>
      <SignInForm options={session.signIn} preview />
    </AuthCard>
  );
}
