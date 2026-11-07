/**
 * Toolbar React Component
 *
 * The toolbar of a connection, in each row of the ListView and in its DetailView: @smarter/common's ResourceToolbar,
 * with this list's messages. Edit opens the connection's manifest page, and Clone, Rename and Delete use the list api's
 * actions, with a dialog that asks, and one that reports the result.
 *
 * Props:
 * - sessionContext (SessionContext): Contains authentication and API information for backend operations.
 * - connection (Connection): The connection resource to manage.
 * - onRequery: Queries the list again, after an action succeeded.
 *
 * Usage:
 * <Toolbar sessionContext={sessionContext} connection={connection} onRequery={onRequery} />
 */
import type { SessionContext, ToolbarMessages } from "@smarter/common";
import { gettext, ResourceToolbar } from "@smarter/common";

import type { Connection } from "../../lib/Types";

/** The toolbar's messages about connections: whole sentences, so that they translate well. */
const messages = (): ToolbarMessages => ({
  editTitle: gettext("Edit: Open the YAML manifest that defines this connection resource"),
  cloneTitle: gettext("Clone: Clone this connection resource to a new resource owned by you"),
  renameTitle: gettext("Rename: Rename this connection resource"),
  deleteTitle: gettext("Delete: Delete this connection resource"),
  deleteForbiddenTitle: gettext(
    "Delete: You can't delete this connection, because other resources depend on it, or you don't have permission to delete it",
  ),
  cloneDialogTitle: gettext("Clone Connection"),
  cloneDialogText: gettext("Clone connection %(name)s to a new resource owned by you."),
  cloneDialogHint: gettext("Provide the new name for the cloned connection."),
  renameDialogTitle: gettext("Rename Connection"),
  renameDialogText: gettext("Rename connection %(name)s."),
  renameDialogHint: gettext("Provide the new name for the connection."),
  namePlaceholder: gettext("Enter new connection name"),
  deleteDialogTitle: gettext("Delete Connection"),
  deleteDialogText: gettext("Are you sure you want to delete connection %(name)s?"),
  errorText: gettext("An error occurred while performing the operation on connection %(name)s."),
  cloneFailed: gettext("Failed to clone connection (%(status)s): %(error)s"),
  cloneSucceeded: gettext("Successfully cloned connection"),
  renameFailed: gettext("Failed to rename connection (%(status)s): %(error)s"),
  renameSucceeded: gettext("Successfully renamed connection"),
  deleteFailed: gettext("Failed to delete connection (%(status)s): %(error)s"),
  deleteSucceeded: gettext("Successfully deleted connection"),
});

interface ToolbarProps {
  sessionContext: SessionContext;
  connection: Connection;
  onRequery: () => void;
}

export const Toolbar = ({ sessionContext, connection, onRequery }: ToolbarProps) => (
  <ResourceToolbar sessionContext={sessionContext} resource={connection} messages={messages()} onRequery={onRequery} />
);
