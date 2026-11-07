/**
 * useInView
 *
 * Whether an element has come near the viewport, once and for good: for a widget below the fold, e.g. a chart,
 * which loads its code and its data only then, rather than with what the page shows first, on a slow network.
 * Without IntersectionObserver, e.g. in jsdom, the element counts as in view at once.
 *
 * @param rootMargin - How near the viewport counts, e.g. "200px": a little before the element shows.
 * @returns A ref for the element, and whether it has come near the viewport.
 */
import { useEffect, useRef, useState, type RefObject } from "react";

export default function useInView<T extends Element>(rootMargin = "200px"): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const element = ref.current;
    if (inView || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView];
}
