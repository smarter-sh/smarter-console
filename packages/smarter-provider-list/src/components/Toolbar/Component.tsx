/**
 * Toolbar React Component
 *
 * The toolbar of a provider, in each row of the ListView and in its DetailView: @smarter/common's ResourceToolbar,
 * with this list's messages. Edit opens the provider's manifest page, and Clone, Rename and Delete use the list api's
 * actions, with a dialog that asks, and one that reports the result.
 *
 * Props:
 * - sessionContext (SessionContext): Contains authentication and API information for backend operations.
 * - provider (Provider): The provider resource to manage.
 * - onRequery: Queries the list again, after an action succeeded.
 *
 * Usage:
 * <Toolbar sessionContext={sessionContext} provider={provider} onRequery={onRequery} />
 */
import type { SessionContext, ToolbarMessages } from "@smarter/common";
import { gettext, ResourceToolbar } from "@smarter/common";

import type { Provider } from "../../lib/Types";

/** The toolbar's messages about providers: whole sentences, so that they translate well. */
const messages = (): ToolbarMessages => ({
  editTitle: gettext("Edit: Open the YAML manifest that defines this provider resource"),
  cloneTitle: gettext("Clone: Clone this provider resource to a new resource owned by you"),
  renameTitle: gettext("Rename: Rename this provider resource"),
  deleteTitle: gettext("Delete: Delete this provider resource"),
  deleteForbiddenTitle: gettext(
    "Delete: You can't delete this provider, because other resources depend on it, or you don't have permission to delete it",
  ),
  cloneDialogTitle: gettext("Clone Provider"),
  cloneDialogText: gettext("Clone provider %(name)s to a new resource owned by you."),
  cloneDialogHint: gettext("Provide the new name for the cloned provider."),
  renameDialogTitle: gettext("Rename Provider"),
  renameDialogText: gettext("Rename provider %(name)s."),
  renameDialogHint: gettext("Provide the new name for the provider."),
  namePlaceholder: gettext("Enter new provider name"),
  deleteDialogTitle: gettext("Delete Provider"),
  deleteDialogText: gettext("Are you sure you want to delete provider %(name)s?"),
  errorText: gettext("An error occurred while performing the operation on provider %(name)s."),
  cloneFailed: gettext("Failed to clone provider (%(status)s): %(error)s"),
  cloneSucceeded: gettext("Successfully cloned provider"),
  renameFailed: gettext("Failed to rename provider (%(status)s): %(error)s"),
  renameSucceeded: gettext("Successfully renamed provider"),
  deleteFailed: gettext("Failed to delete provider (%(status)s): %(error)s"),
  deleteSucceeded: gettext("Successfully deleted provider"),
});

interface ToolbarProps {
  sessionContext: SessionContext;
  provider: Provider;
  onRequery: () => void;
}

export const Toolbar = ({ sessionContext, provider, onRequery }: ToolbarProps) => (
  <ResourceToolbar sessionContext={sessionContext} resource={provider} messages={messages()} onRequery={onRequery} />
);
