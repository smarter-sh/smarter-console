/**
 * The steps of a data export, as the Download My Data dialog lists them, in the order that the backend's
 * Celery task takes them. See DataExportStep in smarter.apps.account.models.
 */
import { gettext } from "@smarter/common";

import type { DataExportProgress, DataExportStepName } from "../../lib/Types";

/** A step that the dialog lists. */
export interface ExportStep {
  name: DataExportStepName;
  title: string;
  description: string;
}

/** The steps that the dialog lists. Called when the dialog renders, so that the text is in the page's language. */
export function exportSteps(): ExportStep[] {
  return [
    {
      name: "inventory",
      title: gettext("Find your resources"),
      description: gettext("Every resource that you own, in every account that you belong to."),
    },
    {
      name: "manifests",
      title: gettext("Write their manifests"),
      description: gettext("One YAML file per resource, as smarter describe prints it."),
    },
    {
      name: "archive",
      title: gettext("Zip them up"),
      description: gettext("The manifests and a README, in a single zip file."),
    },
    {
      name: "upload",
      title: gettext("Store the zip file privately"),
      description: gettext("In this platform's private storage, which deletes it after a day."),
    },
    {
      name: "email",
      title: gettext("Email you a link"),
      description: gettext("A download link that expires, sent to your email address."),
    },
  ];
}

/** The order of the backend's steps. A queued export is about to start the first; a finished one is past the last. */
const STEP_ORDER: DataExportStepName[] = ["queued", "inventory", "manifests", "archive", "upload", "email", "done"];

/**
 * The index, among {@link exportSteps}, of the step that an export is on.
 *
 * @param step - The export's step.
 * @returns 0 for a queued export or the first step, up to 5 once it is done.
 */
export function stepIndex(step: DataExportStepName): number {
  const position = STEP_ORDER.indexOf(step);
  return Math.max(0, position - 1);
}

/** How many steps the dialog lists. An export whose displayed index reaches it is shown as done. */
export const STEP_COUNT = 5;

/**
 * Whether an export has finished, so that the dialog stops asking for its progress.
 *
 * @param progress - The export's progress.
 * @returns True once it succeeded or failed.
 */
export function isFinished(progress: DataExportProgress): boolean {
  return progress.status === "succeeded" || progress.status === "failed";
}

/**
 * The next step index that the dialog shows, on its way to the export's own.
 *
 * An export takes seconds, so its steps would flash past. The dialog shows each one for a moment, moving one
 * step at a time toward the export's, so that each illustration plays. A failed export stops where it is.
 *
 * @param shown - The index that the dialog shows now.
 * @param progress - The export's progress.
 * @returns The index to show next: one more than ``shown``, or ``shown`` once it has caught up.
 */
export function nextShownIndex(shown: number, progress: DataExportProgress): number {
  const target = stepIndex(progress.step);
  if (shown >= target) return shown;
  return shown + 1;
}

/**
 * The size of a file, for the dialog, e.g. "174 KB".
 *
 * @param bytes - The size in bytes.
 * @returns The size, in KB below a megabyte, else in MB.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    const kilobytes = Math.max(1, Math.round(bytes / 1024));
    return `${kilobytes} KB`;
  }
  const megabytes = (bytes / (1024 * 1024)).toFixed(1);
  return `${megabytes} MB`;
}
