import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';
import {
  exportProgress,
  getFinishedLessons,
  importProgressJson,
  onProgressChange,
  serializeProgress,
  type ImportResult,
} from '@/lib/progress';

/** Props for {@link ProgressTransfer}. All user-facing strings come from the caller. */
export interface ProgressTransferProps {
  /** Card heading. */
  title?: string;
  /** Sub-text under the heading explaining what the buttons do. */
  description?: string;
  /** Export-button label. */
  exportLabel?: string;
  /** Import-button label. */
  importLabel?: string;
  /**
   * Live count line. `{n}` is replaced with the number of finished lessons on
   * this device, e.g. `'{n} lessons finished on this device.'`.
   */
  countLabel?: string;
  /** Status after a merge that added lessons. `{n}` = number newly added. */
  importedLabel?: string;
  /** Status after an import that changed nothing (everything already done). */
  noNewLabel?: string;
  /** Status when the chosen file can't be read as a Lessons export. */
  errorLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Replace the `{n}` placeholder in a template string. */
function fill(template: string, n: number): string {
  return template.replace('{n}', String(n));
}

type Status =
  | { kind: 'idle' }
  | { kind: 'imported'; added: number }
  | { kind: 'noNew' }
  | { kind: 'error' };

/**
 * Catalog-page control to move learning progress between devices. **Export**
 * downloads a small JSON file of every finished lesson; **Import** reads such a
 * file from another device and merges it in (a union — it never unmarks a
 * lesson). All state lives in localStorage via `@/lib/progress`, so a successful
 * import instantly updates the catalog graph and every lesson page. SSR-safe:
 * the live count hydrates on mount to avoid a flash, changes are announced via
 * `aria-live`, and reduced motion is respected.
 */
export function ProgressTransfer({
  title = 'Your progress',
  description = 'Moving to another device? Download your progress as a file, then import it there.',
  exportLabel = 'Export progress',
  importLabel = 'Import progress',
  countLabel = '{n} lessons finished on this device.',
  importedLabel = 'Imported — {n} new lessons added.',
  noNewLabel = 'Already up to date — nothing new to import.',
  errorLabel = "Couldn't read that file. Make sure it's a Lessons progress export.",
  className,
}: ProgressTransferProps) {
  // `null` = "unknown" until we read storage on mount (matches SSR, no flash).
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => setCount(getFinishedLessons().size);
    sync();
    return onProgressChange(sync);
  }, []);

  function handleExport() {
    const json = serializeProgress();
    const date = exportProgress().exportedAt.slice(0, 10); // YYYY-MM-DD
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lessons-progress-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick so the click-driven download has started.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result: ImportResult = importProgressJson(String(reader.result ?? ''));
        setStatus(result.added > 0 ? { kind: 'imported', added: result.added } : { kind: 'noNew' });
      } catch {
        setStatus({ kind: 'error' });
      }
    };
    reader.onerror = () => setStatus({ kind: 'error' });
    reader.readAsText(file);
  }

  const statusText =
    status.kind === 'imported'
      ? fill(importedLabel, status.added)
      : status.kind === 'noNew'
        ? noNewLabel
        : status.kind === 'error'
          ? errorLabel
          : null;

  return (
    <section
      className={cx(
        'rounded-card border border-ink-200 bg-surface p-5 shadow-soft sm:p-6',
        className,
      )}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display font-semibold text-ink-900">{title}</p>
          <p className="mt-0.5 max-w-prose text-sm text-ink-500">{description}</p>
          <p className="mt-1.5 h-5 text-sm font-medium text-brand-700" aria-live="polite">
            {count !== null && fill(countLabel, count)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-pill bg-brand-600 px-5 py-2.5 font-display text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {/* Download arrow into tray. */}
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3v9m0 0l-3.2-3.2M10 12l3.2-3.2M4 15.5h12" />
            </svg>
            {exportLabel}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-pill border border-brand-200 bg-surface px-5 py-2.5 font-display text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {/* Upload arrow out of tray. */}
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 12V3m0 0L6.8 6.2M10 3l3.2 3.2M4 15.5h12" />
            </svg>
            {importLabel}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </div>

      {statusText && (
        <p
          role="status"
          aria-live="polite"
          className={cx(
            'mt-4 rounded-card px-4 py-2.5 text-sm font-medium',
            status.kind === 'error'
              ? 'bg-danger/10 text-danger'
              : 'bg-brand-50 text-brand-700',
          )}
        >
          {statusText}
        </p>
      )}
    </section>
  );
}

export default ProgressTransfer;
