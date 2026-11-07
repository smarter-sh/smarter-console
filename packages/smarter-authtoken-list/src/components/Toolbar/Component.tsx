/**
 * Toolbar React Component
 *
 * The toolbar of a authtoken, in each row of the ListView and in its DetailView: @smarter/common's ResourceToolbar,
 * with this list's messages. Edit opens the authtoken's manifest page, and Clone, Rename and Delete use the list api's
 * actions, with a dialog that asks, and one that reports the result.
 *
 * Props:
 * - sessionContext (SessionContext): Contains authentication and API information for backend operations.
 * - authtoken (AuthToken): The authtoken resource to manage.
 * - onRequery: Queries the list again, after an action succeeded.
 *
 * Usage:
 * <Toolbar sessionContext={sessionContext} authtoken={authtoken} onRequery={onRequery} />
 */
import type { SessionContext, ToolbarMessages } from "@smarter/common";
import { gettext, ResourceToolbar } from "@smarter/common";

import type { AuthToken } from "../../lib/Types";

/** The toolbar's messages about authtokens: whole sentences, so that they translate well. */
const messages = (): ToolbarMessages => ({
  editTitle: gettext("Edit: Open the YAML manifest that defines this authtoken resource"),
  cloneTitle: gettext("Clone: Clone this authtoken resource to a new resource owned by you"),
  renameTitle: gettext("Rename: Rename this authtoken resource"),
  deleteTitle: gettext("Delete: Delete this authtoken resource"),
  deleteForbiddenTitle: gettext(
    "Delete: You can't delete this authtoken, because other resources depend on it, or you don't have permission to delete it",
  ),
  cloneDialogTitle: gettext("Clone AuthToken"),
  cloneDialogText: gettext("Clone authtoken %(name)s to a new resource owned by you."),
  cloneDialogHint: gettext("Provide the new name for the cloned authtoken."),
  renameDialogTitle: gettext("Rename AuthToken"),
  renameDialogText: gettext("Rename authtoken %(name)s."),
  renameDialogHint: gettext("Provide the new name for the authtoken."),
  namePlaceholder: gettext("Enter new authtoken name"),
  deleteDialogTitle: gettext("Delete AuthToken"),
  deleteDialogText: gettext("Are you sure you want to delete authtoken %(name)s?"),
  errorText: gettext("An error occurred while performing the operation on authtoken %(name)s."),
  cloneFailed: gettext("Failed to clone authtoken (%(status)s): %(error)s"),
  cloneSucceeded: gettext("Successfully cloned authtoken"),
  renameFailed: gettext("Failed to rename authtoken (%(status)s): %(error)s"),
  renameSucceeded: gettext("Successfully renamed authtoken"),
  deleteFailed: gettext("Failed to delete authtoken (%(status)s): %(error)s"),
  deleteSucceeded: gettext("Successfully deleted authtoken"),
});

interface ToolbarProps {
  sessionContext: SessionContext;
  authtoken: AuthToken;
  onRequery: () => void;
}

export const Toolbar = ({ sessionContext, authtoken, onRequery }: ToolbarProps) => (
  <ResourceToolbar sessionContext={sessionContext} resource={authtoken} messages={messages()} onRequery={onRequery} />
);
