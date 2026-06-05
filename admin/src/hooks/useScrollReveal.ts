import { useEffect, useRef, useState } from 'react';

/**
 * Hook that detects when an element enters the viewport using IntersectionObserver.
 * Returns a ref to attach to the element and a `visible` boolean.
 * Once visible, stays visible (no re-hiding on scroll up).
 */
export function useScrollReveal(threshold = 0.15): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, visible];
}
