import type { ReactNode } from 'react';
import { cx } from '@/components/react/cx';

/** Visual style of a {@link Callout}. */
export type CalloutVariant = 'info' | 'success' | 'warning' | 'tip';

/** Props for the {@link Callout} component. */
export interface CalloutProps {
  /** Color/icon theme. Defaults to `'info'` (brand blue). */
  variant?: CalloutVariant;
  /** Optional bold heading shown above the body. */
  title?: string;
  /**
   * Localized screen-reader prefix announcing the variant (e.g. "Tip: …").
   * Falls back to the English variant name when omitted.
   */
  label?: string;
  /** Body content. */
  children: ReactNode;
  /** Extra classes merged onto the root element. */
  className?: string;
}

interface VariantStyle {
  container: string;
  iconWrap: string;
  title: string;
  icon: ReactNode;
  label: string;
}

const STYLES: Record<CalloutVariant, VariantStyle> = {
  info: {
    container: 'border-brand-200 bg-brand-50/70',
    iconWrap: 'bg-brand-100 text-brand-600',
    title: 'text-brand-800',
    label: 'Info',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    ),
  },
  success: {
    container: 'border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/8',
    iconWrap: 'bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]',
    title: 'text-[color:var(--color-success)]',
    label: 'Success',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
  warning: {
    container: 'border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/8',
    iconWrap: 'bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]',
    title: 'text-[color:var(--color-warning)]',
    label: 'Warning',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    ),
  },
  tip: {
    container: 'border-accent-300 bg-accent-300/12',
    iconWrap: 'bg-accent-300/25 text-accent-600',
    title: 'text-accent-600',
    label: 'Tip',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
      />
    ),
  },
};

/**
 * Inline emphasis box for lessons — info / success / warning / tip.
 *
 * Purely presentational: no state, so it can be used without a client
 * directive. Color-mapped to brand (info), success, warning and accent (tip).
 */
export function Callout({ variant = 'info', title, label, children, className }: CalloutProps) {
  const s = STYLES[variant];
  return (
    <div
      role="note"
      className={cx(
        'flex gap-3 rounded-card border p-4 shadow-soft',
        s.container,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill',
          s.iconWrap,
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.7}
          stroke="currentColor"
          className="h-5 w-5"
        >
          {s.icon}
        </svg>
      </span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-ink-700">
        <span className="sr-only">{label ?? s.label}: </span>
        {title ? (
          <p className={cx('mb-1 font-display text-sm font-semibold', s.title)}>{title}</p>
        ) : null}
        <div className="[&_a]:font-medium [&_a]:text-brand-600 [&_a]:underline">{children}</div>
      </div>
    </div>
  );
}

export default Callout;
