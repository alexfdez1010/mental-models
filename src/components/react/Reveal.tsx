import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import type * as React from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link Reveal} component. */
export interface RevealProps {
  /** Content to reveal once scrolled into view. */
  children: ReactNode;
  /** Element/tag to render as the wrapper. Defaults to `'div'`. */
  as?: keyof React.JSX.IntrinsicElements;
  /** Delay before the animation starts, in milliseconds. Defaults to `0`. */
  delay?: number;
  /** Extra classes merged onto the wrapper. */
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scroll-triggered fade/slide-in wrapper using `IntersectionObserver`.
 *
 * The content animates in once (the observer disconnects after the first
 * intersection). When the user prefers reduced motion — or the browser lacks
 * `IntersectionObserver` — the content is shown immediately with no transform.
 *
 * Content is visible in server-rendered HTML. The entrance animation is a
 * progressive enhancement, so unavailable JavaScript never hides a lesson.
 */
export function Reveal({ children, as = 'div', delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0, rootMargin: '0px 0px -5% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return createElement(
    as,
    {
      ref,
      style: visible && delay ? { animationDelay: `${delay}ms` } : undefined,
      className: cx(
        visible && !prefersReducedMotion() && 'motion-safe:animate-fade-up',
        className,
      ),
    },
    children,
  );
}

export default Reveal;
