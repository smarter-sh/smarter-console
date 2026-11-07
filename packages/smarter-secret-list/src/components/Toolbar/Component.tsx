/**
 * Toolbar React Component
 *
 * The toolbar of a secret, in each row of the ListView and in its DetailView: @smarter/common's ResourceToolbar,
 * with this list's messages. Edit opens the secret's manifest page, and Clone, Rename and Delete use the list api's
 * actions, with a dialog that asks, and one that reports the result.
 *
 * Props:
 * - sessionContext (SessionContext): Contains authentication and API information for backend operations.
 * - secret (Secret): The secret resource to manage.
 * - onRequery: Queries the list again, after an action succeeded.
 *
 * Usage:
 * <Toolbar sessionContext={sessionContext} secret={secret} onRequery={onRequery} />
 */
import type { SessionContext, ToolbarMessages } from "@smarter/common";
import { gettext, ResourceToolbar } from "@smarter/common";

import type { Secret } from "../../lib/Types";

/** The toolbar's messages about secrets: whole sentences, so that they translate well. */
const messages = (): ToolbarMessages => ({
  editTitle: gettext("Edit: Open the YAML manifest that defines this secret resource"),
  cloneTitle: gettext("Clone: Clone this secret resource to a new resource owned by you"),
  renameTitle: gettext("Rename: Rename this secret resource"),
  deleteTitle: gettext("Delete: Delete this secret resource"),
  deleteForbiddenTitle: gettext(
    "Delete: You can't delete this secret, because other resources depend on it, or you don't have permission to delete it",
  ),
  cloneDialogTitle: gettext("Clone Secret"),
  cloneDialogText: gettext("Clone secret %(name)s to a new resource owned by you."),
  cloneDialogHint: gettext("Provide the new name for the cloned secret."),
  renameDialogTitle: gettext("Rename Secret"),
  renameDialogText: gettext("Rename secret %(name)s."),
  renameDialogHint: gettext("Provide the new name for the secret."),
  namePlaceholder: gettext("Enter new secret name"),
  deleteDialogTitle: gettext("Delete Secret"),
  deleteDialogText: gettext("Are you sure you want to delete secret %(name)s?"),
  errorText: gettext("An error occurred while performing the operation on secret %(name)s."),
  cloneFailed: gettext("Failed to clone secret (%(status)s): %(error)s"),
  cloneSucceeded: gettext("Successfully cloned secret"),
  renameFailed: gettext("Failed to rename secret (%(status)s): %(error)s"),
  renameSucceeded: gettext("Successfully renamed secret"),
  deleteFailed: gettext("Failed to delete secret (%(status)s): %(error)s"),
  deleteSucceeded: gettext("Successfully deleted secret"),
});

interface ToolbarProps {
  sessionContext: SessionContext;
  secret: Secret;
  onRequery: () => void;
}

export const Toolbar = ({ sessionContext, secret, onRequery }: ToolbarProps) => (
  <ResourceToolbar sessionContext={sessionContext} resource={secret} messages={messages()} onRequery={onRequery} />
);
