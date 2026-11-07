/**
 * Toolbar React Component
 *
 * The toolbar of a guardrail, in each row of the ListView and in its DetailView: @smarter/common's ResourceToolbar,
 * with this list's messages. Edit opens the guardrail's manifest page, and Clone, Rename and Delete use the list api's
 * actions, with a dialog that asks, and one that reports the result.
 *
 * Props:
 * - sessionContext (SessionContext): Contains authentication and API information for backend operations.
 * - guardrail (Guardrail): The guardrail resource to manage.
 * - onRequery: Queries the list again, after an action succeeded.
 *
 * Usage:
 * <Toolbar sessionContext={sessionContext} guardrail={guardrail} onRequery={onRequery} />
 */
import type { SessionContext, ToolbarMessages } from "@smarter/common";
import { gettext, ResourceToolbar } from "@smarter/common";

import type { Guardrail } from "../../lib/Types";

/** The toolbar's messages about guardrails: whole sentences, so that they translate well. */
const messages = (): ToolbarMessages => ({
  editTitle: gettext("Edit: Open the YAML manifest that defines this guardrail resource"),
  cloneTitle: gettext("Clone: Clone this guardrail resource to a new resource owned by you"),
  renameTitle: gettext("Rename: Rename this guardrail resource"),
  deleteTitle: gettext("Delete: Delete this guardrail resource"),
  deleteForbiddenTitle: gettext(
    "Delete: You can't delete this guardrail, because other resources depend on it, or you don't have permission to delete it",
  ),
  cloneDialogTitle: gettext("Clone Guardrail"),
  cloneDialogText: gettext("Clone guardrail %(name)s to a new resource owned by you."),
  cloneDialogHint: gettext("Provide the new name for the cloned guardrail."),
  renameDialogTitle: gettext("Rename Guardrail"),
  renameDialogText: gettext("Rename guardrail %(name)s."),
  renameDialogHint: gettext("Provide the new name for the guardrail."),
  namePlaceholder: gettext("Enter new guardrail name"),
  deleteDialogTitle: gettext("Delete Guardrail"),
  deleteDialogText: gettext("Are you sure you want to delete guardrail %(name)s?"),
  errorText: gettext("An error occurred while performing the operation on guardrail %(name)s."),
  cloneFailed: gettext("Failed to clone guardrail (%(status)s): %(error)s"),
  cloneSucceeded: gettext("Successfully cloned guardrail"),
  renameFailed: gettext("Failed to rename guardrail (%(status)s): %(error)s"),
  renameSucceeded: gettext("Successfully renamed guardrail"),
  deleteFailed: gettext("Failed to delete guardrail (%(status)s): %(error)s"),
  deleteSucceeded: gettext("Successfully deleted guardrail"),
});

interface ToolbarProps {
  sessionContext: SessionContext;
  guardrail: Guardrail;
  onRequery: () => void;
}

export const Toolbar = ({ sessionContext, guardrail, onRequery }: ToolbarProps) => (
  <ResourceToolbar sessionContext={sessionContext} resource={guardrail} messages={messages()} onRequery={onRequery} />
);
