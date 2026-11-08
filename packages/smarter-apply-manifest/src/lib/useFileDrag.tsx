/**
 * Whether the user is dragging a file over the page, for the drop overlay. Dragging text, e.g. within the
 * editor, doesn't count.
 *
 * The browser fires dragenter and dragleave for each element that the drag crosses, so the hook counts them:
 * the drag has left the page when every element that it entered has been left. While it lasts, the page accepts
 * a dropped file, and a file dropped outside the overlay is ignored, rather than opened by the browser in place
 * of the page.
 */
import { useEffect, useState } from "react";

/** Whether a drag carries files. */
function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export function useFileDrag(): boolean {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let depth = 0;
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setIsDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
      depth = 0;
      setIsDragging(false);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return isDragging;
}
