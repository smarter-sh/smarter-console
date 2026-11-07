/**
 * Toolbar React Component
 *
 * The toolbar of a mcpclient, in each row of the ListView and in its DetailView: @smarter/common's ResourceToolbar,
 * with this list's messages. Edit opens the mcpclient's manifest page, and Clone, Rename and Delete use the list api's
 * actions, with a dialog that asks, and one that reports the result.
 *
 * Props:
 * - sessionContext (SessionContext): Contains authentication and API information for backend operations.
 * - mcpclient (MCPClient): The mcpclient resource to manage.
 * - onRequery: Queries the list again, after an action succeeded.
 *
 * Usage:
 * <Toolbar sessionContext={sessionContext} mcpclient={mcpclient} onRequery={onRequery} />
 */
import type { SessionContext, ToolbarMessages } from "@smarter/common";
import { gettext, ResourceToolbar } from "@smarter/common";

import type { MCPClient } from "../../lib/Types";

/** The toolbar's messages about mcpclients: whole sentences, so that they translate well. */
const messages = (): ToolbarMessages => ({
  editTitle: gettext("Edit: Open the YAML manifest that defines this mcpclient resource"),
  cloneTitle: gettext("Clone: Clone this mcpclient resource to a new resource owned by you"),
  renameTitle: gettext("Rename: Rename this mcpclient resource"),
  deleteTitle: gettext("Delete: Delete this mcpclient resource"),
  deleteForbiddenTitle: gettext(
    "Delete: You can't delete this mcpclient, because other resources depend on it, or you don't have permission to delete it",
  ),
  cloneDialogTitle: gettext("Clone MCPClient"),
  cloneDialogText: gettext("Clone mcpclient %(name)s to a new resource owned by you."),
  cloneDialogHint: gettext("Provide the new name for the cloned mcpclient."),
  renameDialogTitle: gettext("Rename MCPClient"),
  renameDialogText: gettext("Rename mcpclient %(name)s."),
  renameDialogHint: gettext("Provide the new name for the mcpclient."),
  namePlaceholder: gettext("Enter new mcpclient name"),
  deleteDialogTitle: gettext("Delete MCPClient"),
  deleteDialogText: gettext("Are you sure you want to delete mcpclient %(name)s?"),
  errorText: gettext("An error occurred while performing the operation on mcpclient %(name)s."),
  cloneFailed: gettext("Failed to clone mcpclient (%(status)s): %(error)s"),
  cloneSucceeded: gettext("Successfully cloned mcpclient"),
  renameFailed: gettext("Failed to rename mcpclient (%(status)s): %(error)s"),
  renameSucceeded: gettext("Successfully renamed mcpclient"),
  deleteFailed: gettext("Failed to delete mcpclient (%(status)s): %(error)s"),
  deleteSucceeded: gettext("Successfully deleted mcpclient"),
});

interface ToolbarProps {
  sessionContext: SessionContext;
  mcpclient: MCPClient;
  onRequery: () => void;
}

export const Toolbar = ({ sessionContext, mcpclient, onRequery }: ToolbarProps) => (
  <ResourceToolbar sessionContext={sessionContext} resource={mcpclient} messages={messages()} onRequery={onRequery} />
);
