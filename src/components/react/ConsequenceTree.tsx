import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** How a consequence reads on balance — drives a small coloured marker. */
export type ConsequenceValence = 'good' | 'bad' | 'mixed' | 'neutral';

/** One node in a {@link ConsequenceTree}. Compose recursively via {@link children}. */
export interface ConsequenceNode {
  /** Short label for the decision or consequence ("Cap rents at $1,000"). */
  label: string;
  /** Optional one-line gloss shown under the label. */
  note?: string;
  /** Whether this outcome is, on balance, good / bad / mixed / neutral. */
  valence?: ConsequenceValence;
  /** Downstream effects — the next order of consequences. */
  children?: ConsequenceNode[];
}

/** Props for the {@link ConsequenceTree} island. */
export interface ConsequenceTreeProps {
  /** The root decision/event whose ripples the learner explores. */
  decision: ConsequenceNode;
  /** Heading above the tree. */
  title?: string;
  /** Eyebrow label. Defaults to `'And then what?'`. */
  eyebrow?: string;
  /** Instruction line above the tree. */
  instructions?: string;
  /** Caption beneath the tree. */
  caption?: string;
  /** Badge on the root node. Defaults to `'Decision'`. */
  decisionLabel?: string;
  /**
   * Ordinal labels per depth: `orderLabels[0]` tags the first-order effects,
   * `[1]` the second-order, and so on. Defaults to English ordinals.
   */
  orderLabels?: string[];
  /** Hint on the "reveal my children" toggle. Defaults to `'And then what?'`. */
  promptLabel?: string;
  /** Label of the "reveal every level" button. Defaults to `'Reveal all orders'`. */
  expandAllLabel?: string;
  /** Label of the reset button. Defaults to `'Collapse'`. */
  collapseLabel?: string;
  /** Accessible names for the valence markers. */
  valenceLabels?: Partial<Record<ConsequenceValence, string>>;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const DEFAULT_ORDER_LABELS = [
  '1st-order',
  '2nd-order',
  '3rd-order',
  '4th-order',
  '5th-order',
];

const VALENCE_DOT: Record<ConsequenceValence, string> = {
  good: 'bg-success',
  bad: 'bg-danger',
  mixed: 'bg-warning',
  neutral: 'bg-ink-300',
};

/** Collect every expandable path so "Reveal all" can open the whole tree. */
function collectExpandablePaths(node: ConsequenceNode, path: string): string[] {
  if (!node.children?.length) return [];
  const here = [path];
  node.children.forEach((child, i) => {
    here.push(...collectExpandablePaths(child, `${path}.${i}`));
  });
  return here;
}

/**
 * Interactive **consequence tree** — the "and then what?" chain made tangible.
 *
 * A single decision sits at the root. Every node with downstream effects shows
 * an *"and then what?"* toggle; opening it reveals that node's next-order
 * consequences, each tagged with its order (1st, 2nd, 3rd …) and a small marker
 * for whether it lands good, bad, or mixed. The point the island teaches itself:
 * the first-order effects are obvious and often pleasant, and the trouble (or the
 * edge) hides two or three orders down — exactly where ordinary thinking stops.
 *
 * Expansion state is tracked per path, only revealed nodes are in the DOM (so
 * screen readers follow the chain the learner is building), every toggle is a
 * real `<button>` with `aria-expanded`, and the reveal degrades to an instant
 * swap under `prefers-reduced-motion`. Fully keyboard-operable.
 */
export function ConsequenceTree({
  decision,
  title,
  eyebrow = 'And then what?',
  instructions = 'Start at the decision. Open each “and then what?” to follow the consequences another order deeper — watch where the obvious first move leads:',
  caption,
  decisionLabel = 'Decision',
  orderLabels = DEFAULT_ORDER_LABELS,
  promptLabel = 'And then what?',
  expandAllLabel = 'Reveal all orders',
  collapseLabel = 'Collapse',
  valenceLabels,
  className,
}: ConsequenceTreeProps) {
  // Fail the build on a mis-authored tree rather than shipping an empty figure.
  if (!decision || !decision.label?.trim()) {
    throw new Error('ConsequenceTree: `decision` must be an object with a non-empty `label`.');
  }
  if (!decision.children?.length) {
    throw new Error(
      `ConsequenceTree "${decision.label}": the decision needs at least one ` +
        'order of `children` — a tree with no consequences has nothing to show.',
    );
  }

  const reactId = useId();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const allPaths = useMemo(
    () => collectExpandablePaths(decision, 'root'),
    [decision],
  );
  const allOpen = expanded.size === allPaths.length;

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        // Closing a node also closes everything beneath it.
        for (const p of next) {
          if (p === path || p.startsWith(`${path}.`)) next.delete(p);
        }
      } else {
        next.add(path);
      }
      return next;
    });

  const labelFor = (v: ConsequenceValence) =>
    valenceLabels?.[v] ?? v;

  const renderNode = (node: ConsequenceNode, path: string, depth: number) => {
    const hasChildren = !!node.children?.length;
    const isOpen = expanded.has(path);
    const isRoot = depth === 0;
    const orderTag = isRoot ? decisionLabel : orderLabels[depth - 1] ?? `${depth}th-order`;
    const valence = node.valence ?? 'neutral';

    return (
      <li key={path} className={cx(!isRoot && 'relative pl-5')}>
        {/* Connector elbow for non-root nodes. */}
        {!isRoot ? (
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full border-l-2 border-edge-strong"
          />
        ) : null}

        <div
          className={cx(
            'rounded-card border-2 bg-surface p-3 sm:p-4',
            isRoot ? 'border-ink-900' : 'border-edge-strong',
          )}
        >
          <div className="flex items-start gap-2">
            {!isRoot ? (
              <span
                aria-label={labelFor(valence)}
                title={labelFor(valence)}
                className={cx(
                  'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                  VALENCE_DOT[valence],
                )}
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <span
                className={cx(
                  'inline-flex w-fit items-center rounded-pill px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide',
                  isRoot ? 'bg-ink-900 text-white' : 'bg-surface-sunken text-ink-500',
                )}
              >
                {orderTag}
              </span>
              <p
                className={cx(
                  'mt-1.5 font-medium',
                  isRoot ? 'font-display text-base text-ink-900' : 'text-sm text-ink-900',
                )}
              >
                {node.label}
              </p>
              {node.note ? (
                <p className="mt-1 text-sm leading-snug text-ink-600">{node.note}</p>
              ) : null}

              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggle(path)}
                  aria-expanded={isOpen}
                  className={cx(
                    'mt-2 inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                    isOpen
                      ? 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                      : 'bg-brand-600 text-white hover:bg-brand-700',
                  )}
                >
                  <span aria-hidden className={cx('transition-transform', isOpen && 'rotate-90')}>
                    ▸
                  </span>
                  {promptLabel}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {hasChildren && isOpen ? (
          <ul className="mt-2 space-y-2 motion-safe:animate-fade-up">
            {node.children!.map((child, i) =>
              renderNode(child, `${path}.${i}`, depth + 1),
            )}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <figure className={cx('brutal my-6 bg-surface p-5 sm:p-6', className)}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      <p className="mt-3 text-sm font-medium text-ink-700">{instructions}</p>

      <ul className="mt-4 space-y-2">{renderNode(decision, 'root', 0)}</ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded(new Set(allPaths))}
          disabled={allOpen}
          className="brutal-btn bg-brand-600 px-4 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {expandAllLabel}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(new Set())}
          disabled={expanded.size === 0}
          className="brutal-btn bg-surface px-4 py-2 text-sm text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {collapseLabel}
        </button>
      </div>

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default ConsequenceTree;
