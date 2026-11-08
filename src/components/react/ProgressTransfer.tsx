import { useEffect, useId, useRef, useState } from 'react';
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
  /** Button that opens the dialog. */
  triggerLabel?: string;
  /** Accessible name of the close button. */
  closeLabel?: string;
  /** Dialog heading. */
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
  triggerLabel = 'Import or export progress',
  closeLabel = 'Close',
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

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
    <div className={className}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-controls={dialogId}
        onClick={() => {
          setStatus({ kind: 'idle' });
          setOpen(true);
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-surface-sunken hover:text-ink-900"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 3v10m0 0-3-3m3 3 3-3M14 17V7m0 0-3 3m3-3 3 3" />
        </svg>
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={`${dialogId}-title`}
        aria-describedby={`${dialogId}-description`}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-card border-0 bg-surface p-0 text-ink-900 shadow-pop backdrop:bg-ink-900/40 backdrop:backdrop-blur-sm"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 id={`${dialogId}-title`} className="font-display text-2xl font-semibold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              aria-label={closeLabel}
              onClick={() => dialogRef.current?.close()}
              className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-pill text-ink-500 transition-colors hover:bg-surface-sunken hover:text-ink-900"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
          </div>
          <p id={`${dialogId}-description`} className="mt-3 text-sm leading-relaxed text-ink-600">
            {description}
          </p>
          <p className="mt-5 min-h-5 text-sm font-medium text-ink-700" aria-live="polite">
            {count !== null && fill(countLabel, count)}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleExport}
              className="brutal-btn min-h-11 bg-brand-700 px-4 py-3 text-sm text-white hover:bg-brand-800"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 3v9m0 0l-3.2-3.2M10 12l3.2-3.2M4 15.5h12" />
              </svg>
              {exportLabel}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="brutal-btn min-h-11 bg-surface-sunken px-4 py-3 text-sm text-ink-800 hover:bg-ink-200"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 12V3m0 0L6.8 6.2M10 3l3.2 3.2M4 15.5h12" />
              </svg>
              {importLabel}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFile}
              hidden
            />
          </div>

          {statusText && (
            <p
              role="status"
              className={cx(
                'mt-5 rounded-card px-4 py-3 text-sm leading-relaxed',
                status.kind === 'error'
                  ? 'bg-danger/10 text-danger'
                  : 'bg-brand-50 text-brand-700',
              )}
            >
              {statusText}
            </p>
          )}
        </div>
      </dialog>
    </div>
  );
}

export default ProgressTransfer;
