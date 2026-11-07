/**
 * Toolbar React Component
 *
 * The toolbar of a llmtool, in each row of the ListView and in its DetailView: @smarter/common's ResourceToolbar,
 * with this list's messages. Edit opens the llmtool's manifest page, and Clone, Rename and Delete use the list api's
 * actions, with a dialog that asks, and one that reports the result.
 *
 * Props:
 * - sessionContext (SessionContext): Contains authentication and API information for backend operations.
 * - llmtool (LLMTool): The llmtool resource to manage.
 * - onRequery: Queries the list again, after an action succeeded.
 *
 * Usage:
 * <Toolbar sessionContext={sessionContext} llmtool={llmtool} onRequery={onRequery} />
 */
import type { SessionContext, ToolbarMessages } from "@smarter/common";
import { gettext, ResourceToolbar } from "@smarter/common";

import type { LLMTool } from "../../lib/Types";

/** The toolbar's messages about llmtools: whole sentences, so that they translate well. */
const messages = (): ToolbarMessages => ({
  editTitle: gettext("Edit: Open the YAML manifest that defines this LLMTool resource"),
  cloneTitle: gettext("Clone: Clone this LLMTool resource to a new resource owned by you"),
  renameTitle: gettext("Rename: Rename this LLMTool resource"),
  deleteTitle: gettext("Delete: Delete this LLMTool resource"),
  deleteForbiddenTitle: gettext(
    "Delete: You can't delete this LLMTool, because other resources depend on it, or you don't have permission to delete it",
  ),
  cloneDialogTitle: gettext("Clone LLMTool"),
  cloneDialogText: gettext("Clone LLMTool %(name)s to a new resource owned by you."),
  cloneDialogHint: gettext("Provide the new name for the cloned LLMTool."),
  renameDialogTitle: gettext("Rename LLMTool"),
  renameDialogText: gettext("Rename LLMTool %(name)s."),
  renameDialogHint: gettext("Provide the new name for the LLMTool."),
  namePlaceholder: gettext("Enter new LLMTool name"),
  deleteDialogTitle: gettext("Delete LLMTool"),
  deleteDialogText: gettext("Are you sure you want to delete LLMTool %(name)s?"),
  errorText: gettext("An error occurred while performing the operation on LLMTool %(name)s."),
  cloneFailed: gettext("Failed to clone LLMTool (%(status)s): %(error)s"),
  cloneSucceeded: gettext("Successfully cloned LLMTool"),
  renameFailed: gettext("Failed to rename LLMTool (%(status)s): %(error)s"),
  renameSucceeded: gettext("Successfully renamed LLMTool"),
  deleteFailed: gettext("Failed to delete LLMTool (%(status)s): %(error)s"),
  deleteSucceeded: gettext("Successfully deleted LLMTool"),
});

interface ToolbarProps {
  sessionContext: SessionContext;
  llmtool: LLMTool;
  onRequery: () => void;
}

export const Toolbar = ({ sessionContext, llmtool, onRequery }: ToolbarProps) => (
  <ResourceToolbar sessionContext={sessionContext} resource={llmtool} messages={messages()} onRequery={onRequery} />
);
