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
 * SSR-safe: because lessons mount this via `client:visible`, hydration only
 * happens near the viewport, so there is no flash of hidden content.
 */
export function Reveal({ children, as = 'div', delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node) {
      setVisible(true);
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
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return createElement(
    as,
    {
      ref,
      style: visible && delay ? { transitionDelay: `${delay}ms` } : undefined,
      className: cx(
        'transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className,
      ),
    },
    children,
  );
}

export default Reveal;
