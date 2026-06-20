import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/components/react/cx';
import {
  applyFiltersToUrl,
  DIFFICULTY_VALUES,
  LEVEL_PARAM,
  matchesFilters,
  parseLevels,
  parseTags,
  TAG_PARAM,
  toggleValue,
  type Difficulty,
} from '@/lib/catalog-filter';
import {
  courseProgress,
  getFinishedLessons,
  getLegacyFinishedCourses,
  migrateLegacyCourse,
  onProgressChange,
} from '@/lib/progress';

export type { Difficulty };

/** Maps a difficulty to its semantic badge class (defined in global.css). */
const DIFFICULTY_CLASS: Record<Difficulty, string> = {
  beginner: 'difficulty-beginner',
  intermediate: 'difficulty-intermediate',
  advanced: 'difficulty-advanced',
  expert: 'difficulty-expert',
};

/** Maps a difficulty to its whole-card edge/tint class (defined in global.css). */
const DIFFICULTY_EDGE_CLASS: Record<Difficulty, string> = {
  beginner: 'difficulty-edge-beginner',
  intermediate: 'difficulty-edge-intermediate',
  advanced: 'difficulty-edge-advanced',
  expert: 'difficulty-edge-expert',
};

/**
 * One course (topic) node in the {@link CourseGraph}. Locale-agnostic: all
 * user-facing strings (`title`, `description`) and the `href` are resolved by
 * the caller, so the same component renders the en and es catalogs.
 */
export interface CourseNode {
  /** Bare topic slug — stable id used to wire up {@link dependencies}. */
  slug: string;
  /** Localized course title. */
  title: string;
  /** Localized one-line summary. */
  description: string;
  /** Emoji / short chip label. */
  icon: string;
  /** Localized link to the topic landing page. */
  href: string;
  /** Number of lessons inside the course. */
  lessons: number;
  /**
   * Bare lesson slugs of the course, in order. Drives the `X / Y` completion
   * count (locale-agnostic — see `@/lib/progress`).
   */
  lessonSlugs: string[];
  /** Accent token suffix used for the node tint. */
  accent?: 'brand' | 'accent';
  /**
   * Demand level shown as a badge. `beginner` assumes **no prior finance
   * knowledge**; `expert` is the deepest tier on the zero-to-expert path.
   */
  difficulty?: Difficulty;
  /**
   * Bare slugs of prerequisite courses (drawn as incoming edges). Unknown
   * slugs are ignored so a half-built dependency list never breaks the graph.
   */
  dependencies?: string[];
  /** Roadmap tags the course carries — drives the tag filter. */
  tags?: string[];
  /**
   * Planned-but-unbuilt course (from `@/lib/upcoming`). Rendered as a dimmed,
   * non-clickable "Coming soon" node — still wired by `dependencies` so it
   * shows where it lands on the ladder, but with no `href` or lesson count.
   */
  comingSoon?: boolean;
}

/** One selectable roadmap tag in the filter bar. */
export interface TagOption {
  /** Tag slug — matches `CourseNode.tags` entries and the `?tag=` URL value. */
  tag: string;
  /** Localized roadmap name. */
  label: string;
  /** Emoji shown on the chip. */
  icon?: string;
}

/** Props for the {@link CourseGraph} component. */
export interface CourseGraphProps {
  /** Every course to plot. Order within a layer follows array order. */
  nodes: CourseNode[];
  /** Label after the lesson count, e.g. `'lessons'`. */
  lessonsLabel?: string;
  /**
   * Localized name for each difficulty tier, shown on the card badge and in
   * the legend. Omit to fall back to the English tier names.
   */
  difficultyLabels?: Record<Difficulty, string>;
  /** Badge text shown on a course the learner has marked finished. */
  finishedLabel?: string;
  /** Caption shown beneath the graph (e.g. how to read the arrows). */
  caption?: string;
  /** Shown when `nodes` is empty. */
  emptyLabel?: string;
  /** Label for the difficulty filter group (e.g. `'Level'`). */
  levelLabel?: string;
  /** Text for the levels "no filter" chip (e.g. `'All levels'`). */
  allLevelsLabel?: string;
  /**
   * Roadmap tags offered in the tag filter, in display order. Omit (or pass
   * empty) to hide the tag filter entirely. Learning-path links are just
   * `/catalog?tag=<tag>` — the filter reads the URL on mount.
   */
  tagOptions?: TagOption[];
  /** Label for the tag filter group (e.g. `'Paths'`). */
  tagsLabel?: string;
  /** Text for the tags "no filter" chip (e.g. `'All paths'`). */
  allTagsLabel?: string;
  /** Badge text shown on a planned-but-unbuilt (`comingSoon`) course node. */
  comingSoonLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** A measured edge: a cubic-bezier path string from prerequisite → course. */
interface EdgePath {
  id: string;
  d: string;
}

/**
 * Topological depth of every node = its layer (row) in the graph. A node with
 * no (known) prerequisites sits on layer 0; otherwise it's one below its
 * deepest prerequisite. Cycles and dangling deps are tolerated — a node never
 * counts itself and unknown slugs are skipped — so the layout always resolves.
 */
function computeLayers(nodes: CourseNode[]): Map<string, number> {
  const bySlug = new Map(nodes.map((n) => [n.slug, n]));
  const depth = new Map<string, number>();

  const visit = (slug: string, stack: Set<string>): number => {
    const cached = depth.get(slug);
    if (cached !== undefined) return cached;
    const node = bySlug.get(slug);
    if (!node) return 0;
    // Guard against cycles: treat a back-edge as no constraint.
    if (stack.has(slug)) return 0;
    stack.add(slug);

    const deps = (node.dependencies ?? []).filter((d) => bySlug.has(d) && d !== slug);
    const d = deps.length === 0 ? 0 : 1 + Math.max(...deps.map((dep) => visit(dep, stack)));
    stack.delete(slug);
    depth.set(slug, d);
    return d;
  };

  for (const n of nodes) visit(n.slug, new Set());
  return depth;
}

/**
 * Reorder the nodes **within each layer** to minimize edge crossings, the
 * classic Sugiyama "barycenter" heuristic. Each node is repeatedly pulled
 * toward the average horizontal position of its neighbors (both its
 * prerequisites in earlier rows and the courses that depend on it in later
 * rows), so children sit under their parents and arrows run mostly straight
 * instead of fanning across the graph. Mutates `rows` in place.
 *
 * Positions are *normalized* to [0,1] within each row so a wide row and a
 * narrow row exert comparable pull, and edges that skip layers (e.g. a
 * layer-0 prerequisite of a layer-2 course) are honored just like adjacent
 * ones. A few alternating down/up sweeps converge well past the point where
 * extra passes change anything; ties fall back to the catalog `order` for a
 * stable, deterministic layout.
 */
function orderRowsToReduceCrossings(rows: CourseNode[][], nodes: CourseNode[]): void {
  const present = new Set(nodes.map((n) => n.slug));
  // Adjacency: for each slug, its prerequisites and its dependents (kept to
  // courses actually plotted, never self-referential).
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    const deps = (n.dependencies ?? []).filter((d) => present.has(d) && d !== n.slug);
    parents.set(n.slug, deps);
    for (const d of deps) {
      const list = children.get(d) ?? [];
      list.push(n.slug);
      children.set(d, list);
    }
  }

  // Stable starting order inside each row: catalog order, low → high.
  const orderRank = new Map(nodes.map((n, i) => [n.slug, i]));
  for (const row of rows) {
    row.sort((a, b) => (orderRank.get(a.slug) ?? 0) - (orderRank.get(b.slug) ?? 0));
  }

  // Normalized x of every node in its current row (recomputed each sweep).
  const posOf = (): Map<string, number> => {
    const pos = new Map<string, number>();
    for (const row of rows) {
      const last = Math.max(1, row.length - 1);
      row.forEach((n, i) => pos.set(n.slug, row.length === 1 ? 0.5 : i / last));
    }
    return pos;
  };

  const SWEEPS = 8;
  for (let s = 0; s < SWEEPS; s++) {
    const pos = posOf();
    const downward = s % 2 === 0; // alternate: lean on parents, then on children.
    for (const row of rows) {
      const bary = new Map<string, number>();
      for (const n of row) {
        const neigh = downward
          ? (parents.get(n.slug) ?? [])
          : (children.get(n.slug) ?? []);
        // Mix in the other direction too, lightly, so leaf/root rows still move.
        const other = downward
          ? (children.get(n.slug) ?? [])
          : (parents.get(n.slug) ?? []);
        const all = neigh.length ? neigh : other;
        const vals = all.map((m) => pos.get(m)).filter((v): v is number => v !== undefined);
        bary.set(n.slug, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : pos.get(n.slug) ?? 0.5);
      }
      row.sort((a, b) => {
        const d = (bary.get(a.slug) ?? 0) - (bary.get(b.slug) ?? 0);
        return d !== 0 ? d : (orderRank.get(a.slug) ?? 0) - (orderRank.get(b.slug) ?? 0);
      });
    }
  }
}

/**
 * Catalog graph island — renders every course as a card and draws an arrow
 * from each prerequisite to the courses that depend on it, roadmap.sh-style,
 * so the learning order and dependencies are obvious at a glance.
 *
 * Layout is deliberately split in two: the **cards** flow through plain,
 * responsive flexbox rows (one row per dependency layer), while the **edges**
 * are an SVG overlay whose paths are *measured* from the real DOM positions
 * after layout — so the arrows stay glued to the cards through any reflow
 * (resize, font swap, wrapping) without hand-computed coordinates. Cards are
 * real `<a>` links in reading order, keeping the graph keyboard- and
 * screen-reader-navigable; the SVG is decorative (`aria-hidden`).
 *
 * To add a course: drop a new topic MDX with a `dependencies` array — no
 * code changes here.
 */
const DEFAULT_DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

/** Tier dot color for inactive level chips (static literals for Tailwind). */
const DIFFICULTY_DOT_CLASS: Record<Difficulty, string> = {
  beginner: 'bg-emerald-500',
  intermediate: 'bg-amber-500',
  advanced: 'bg-rose-500',
  expert: 'bg-violet-500',
};

/** Active (selected) chip skin per tier — badge tint + matching border. */
const DIFFICULTY_CHIP_ACTIVE_CLASS: Record<Difficulty, string> = {
  beginner: 'difficulty-beginner border-emerald-300',
  intermediate: 'difficulty-intermediate border-amber-300',
  advanced: 'difficulty-advanced border-rose-300',
  expert: 'difficulty-expert border-violet-300',
};

/** Shared pill-button props for one toggle chip in the filter bar. */
interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  /** Skin when active; defaults to a solid brand fill. */
  activeClass?: string;
  children: ReactNode;
}

/**
 * One toggleable filter chip. A real `<button>` with `aria-pressed`, so the
 * multi-select state is keyboard- and screen-reader-native.
 */
function FilterChip({ active, onClick, activeClass, children }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-medium shadow-soft transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        active
          ? (activeClass ?? 'border-brand-500 bg-brand-600 text-white')
          : 'border-ink-200 bg-surface text-ink-600 hover:-translate-y-px hover:border-brand-300 hover:text-brand-700',
      )}
    >
      {active ? (
        <svg
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 10.5l3.2 3.2L15 7" />
        </svg>
      ) : null}
      {children}
    </button>
  );
}

export function CourseGraph({
  nodes,
  lessonsLabel = 'lessons',
  difficultyLabels = DEFAULT_DIFFICULTY_LABELS,
  finishedLabel = 'Finished',
  caption,
  emptyLabel = 'No courses yet — check back soon.',
  levelLabel = 'Level',
  allLevelsLabel = 'All levels',
  tagOptions = [],
  tagsLabel = 'Paths',
  allTagsLabel = 'All paths',
  comingSoonLabel = 'Coming soon',
  className,
}: CourseGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // One DOM ref per card, keyed by slug, so we can measure centers for edges.
  // A built course is an <a>; a coming-soon node is a <div> — both HTMLElement.
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [edges, setEdges] = useState<EdgePath[]>([]);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // Per-lesson completion + the legacy whole-course flags (localStorage). Both
  // empty during SSR so the first paint matches the server, then hydrated +
  // kept in sync on mount. Per-course `X / Y` counts are derived from these.
  const [finishedLessons, setFinishedLessons] = useState<Set<string>>(new Set());
  const [legacyCourses, setLegacyCourses] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Fold any legacy whole-course flags into per-lesson state, once.
    for (const n of nodes) migrateLegacyCourse(n.slug, n.lessonSlugs);
    const sync = () => {
      setFinishedLessons(getFinishedLessons());
      setLegacyCourses(getLegacyFinishedCourses());
    };
    sync();
    return onProgressChange(sync);
  }, [nodes]);

  // Active multi-select filters, persisted in the URL (`?level=a,b&tag=x,y`).
  // Both start empty ("no filter") so the first paint matches the server, then
  // reconcile from the URL on mount — and stay in sync on back/forward.
  const [levels, setLevels] = useState<Difficulty[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const validTags = useMemo(() => tagOptions.map((o) => o.tag), [tagOptions]);
  useEffect(() => {
    const fromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setLevels(parseLevels(params.get(LEVEL_PARAM)));
      setTags(parseTags(params.get(TAG_PARAM), validTags));
    };
    fromUrl();
    window.addEventListener('popstate', fromUrl);
    return () => window.removeEventListener('popstate', fromUrl);
  }, [validTags]);

  // Persist both selections to the URL without growing history, so the view
  // survives refresh and is shareable. Empty selections drop their param.
  const persistFilters = useCallback((nextLevels: Difficulty[], nextTags: string[]) => {
    setLevels(nextLevels);
    setTags(nextTags);
    if (typeof window === 'undefined') return;
    const url = applyFiltersToUrl(new URL(window.location.href), nextLevels, nextTags);
    window.history.replaceState({}, '', url);
  }, []);

  const toggleLevel = useCallback(
    (d: Difficulty) => {
      // Normalize through the parser so "all four picked" collapses to "no filter".
      persistFilters(parseLevels(toggleValue(levels, d).join(',')), tags);
    },
    [levels, tags, persistFilters],
  );
  const toggleTag = useCallback(
    (tag: string) => {
      persistFilters(levels, parseTags(toggleValue(tags, tag).join(','), validTags));
    },
    [levels, tags, validTags, persistFilters],
  );

  // Only the courses surviving both filters feed the layout. Edges to filtered
  // -out prerequisites are simply skipped (measure() guards on the visible set).
  const visibleNodes = useMemo(
    () => nodes.filter((n) => matchesFilters(n, levels, tags)),
    [nodes, levels, tags],
  );

  const layers = computeLayers(visibleNodes);
  const maxLayer = visibleNodes.reduce((m, n) => Math.max(m, layers.get(n.slug) ?? 0), 0);
  // Group nodes into rows by layer, preserving array order within each row.
  const rows: CourseNode[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const n of visibleNodes) rows[layers.get(n.slug) ?? 0].push(n);
  orderRowsToReduceCrossings(rows, visibleNodes);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const box = container.getBoundingClientRect();
    const centerOf = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        top: r.top - box.top,
        bottom: r.bottom - box.top,
        cx: r.left - box.left + r.width / 2,
      };
    };

    const next: EdgePath[] = [];
    const bySlug = new Set(visibleNodes.map((n) => n.slug));
    for (const n of visibleNodes) {
      const toEl = cardRefs.current.get(n.slug);
      if (!toEl) continue;
      const to = centerOf(toEl);
      for (const dep of n.dependencies ?? []) {
        if (!bySlug.has(dep) || dep === n.slug) continue;
        const fromEl = cardRefs.current.get(dep);
        if (!fromEl) continue;
        const from = centerOf(fromEl);
        // Bezier from prerequisite's bottom edge to dependent's top edge.
        const x1 = from.cx;
        const y1 = from.bottom;
        const x2 = to.cx;
        const y2 = to.top;
        const dy = Math.max(24, (y2 - y1) / 2);
        next.push({
          id: `${dep}->${n.slug}`,
          d: `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`,
        });
      }
    }
    setSize({ w: container.clientWidth, h: container.clientHeight });
    setEdges(next);
  }, [visibleNodes]);

  // Measure after layout and on every resize of the container.
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    // Re-measure once web fonts settle (they shift card heights).
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => measure()).catch(() => {});
    }
    return () => ro.disconnect();
  }, [measure]);

  if (nodes.length === 0) {
    return <p className={cx('mt-12 text-ink-500', className)}>{emptyLabel}</p>;
  }

  return (
    <figure className={cx('not-prose', className)}>
      {/* Filter bar — multi-select level + roadmap-tag chips, persisted in the
          URL (?level=a,b&tag=x,y) so any filtered view is shareable as a link. */}
      <div className="mb-10 flex flex-col gap-3 rounded-card border border-ink-100 bg-surface p-4 shadow-soft sm:p-5">
        <div role="group" aria-label={levelLabel} className="flex flex-wrap items-center gap-2">
          <span className="mr-1 min-w-14 text-xs font-semibold uppercase tracking-wider text-ink-400">
            {levelLabel}
          </span>
          <FilterChip active={levels.length === 0} onClick={() => persistFilters([], tags)}>
            {allLevelsLabel}
          </FilterChip>
          {DIFFICULTY_VALUES.map((d) => (
            <FilterChip
              key={d}
              active={levels.includes(d)}
              onClick={() => toggleLevel(d)}
              activeClass={DIFFICULTY_CHIP_ACTIVE_CLASS[d]}
            >
              <span
                aria-hidden="true"
                className={cx('h-2 w-2 shrink-0 rounded-pill', DIFFICULTY_DOT_CLASS[d])}
              />
              {difficultyLabels[d]}
            </FilterChip>
          ))}
        </div>

        {tagOptions.length > 0 ? (
          <div role="group" aria-label={tagsLabel} className="flex flex-wrap items-center gap-2">
            <span className="mr-1 min-w-14 text-xs font-semibold uppercase tracking-wider text-ink-400">
              {tagsLabel}
            </span>
            <FilterChip active={tags.length === 0} onClick={() => persistFilters(levels, [])}>
              {allTagsLabel}
            </FilterChip>
            {tagOptions.map((o) => (
              <FilterChip key={o.tag} active={tags.includes(o.tag)} onClick={() => toggleTag(o.tag)}>
                {o.icon ? <span aria-hidden="true">{o.icon}</span> : null}
                {o.label}
              </FilterChip>
            ))}
          </div>
        ) : null}
      </div>

      {visibleNodes.length === 0 ? (
        <p className="py-12 text-center text-ink-500">{emptyLabel}</p>
      ) : null}

      <div ref={containerRef} className="relative">
        {/* Edge overlay — measured from the cards, purely decorative. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          width={size.w || undefined}
          height={size.h || undefined}
        >
          <defs>
            <marker
              id="course-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-brand-400" />
            </marker>
          </defs>
          {edges.map((e) => (
            <path
              key={e.id}
              d={e.d}
              fill="none"
              className="stroke-brand-300"
              strokeWidth={2}
              strokeLinecap="round"
              markerEnd="url(#course-arrow)"
            />
          ))}
        </svg>

        {/* Card layers — plain responsive flow; arrows snap to these. */}
        <ol className="relative flex list-none flex-col gap-y-12 p-0 sm:gap-y-20">
          {rows.map((row, layer) => (
            <li key={layer} className="m-0 p-0">
              <ul className="flex list-none flex-wrap items-stretch justify-evenly gap-x-6 gap-y-4 p-0 sm:gap-x-12">
                {row.map((n) => {
                  const tint = n.accent === 'accent' ? 'bg-accent-50' : 'bg-brand-50';
                  const tintText =
                    n.accent === 'accent' ? 'group-hover:text-accent-700' : 'group-hover:text-brand-700';
                  // Difficulty drives the card's colored left edge + tier tint.
                  const edge = n.difficulty
                    ? DIFFICULTY_EDGE_CLASS[n.difficulty]
                    : 'border-l-4 border-l-ink-200 bg-surface';
                  const setRef = (el: HTMLElement | null) => {
                    if (el) cardRefs.current.set(n.slug, el);
                    else cardRefs.current.delete(n.slug);
                  };

                  // Planned-but-unbuilt course: a dimmed, non-clickable node
                  // that still anchors its dependency edges on the ladder.
                  if (n.comingSoon) {
                    return (
                      <li key={n.slug} className="m-0 p-0">
                        <div
                          ref={setRef}
                          title={`${n.title} · ${comingSoonLabel}`}
                          aria-label={`${n.title} · ${comingSoonLabel}`}
                          className={cx(
                            'relative flex h-full w-28 max-w-[40vw] flex-col rounded-card border border-dashed border-ink-200 p-2.5 opacity-70 shadow-soft sm:w-44 sm:max-w-[80vw] sm:p-3',
                            edge,
                          )}
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2">
                            <span
                              className={cx(
                                'grid h-7 w-7 shrink-0 place-items-center rounded-card text-base grayscale sm:h-9 sm:w-9 sm:text-xl',
                                tint,
                              )}
                            >
                              {n.icon}
                            </span>
                            {n.difficulty ? (
                              <span className={cx('difficulty-badge hidden sm:inline-flex', DIFFICULTY_CLASS[n.difficulty])}>
                                {difficultyLabels[n.difficulty]}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="font-display text-sm font-semibold leading-snug text-ink-700">
                            {n.title}
                          </h3>
                          {n.difficulty ? (
                            <span className={cx('difficulty-badge mt-1.5 self-start sm:hidden', DIFFICULTY_CLASS[n.difficulty])}>
                              {difficultyLabels[n.difficulty]}
                            </span>
                          ) : null}
                          <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                            <span aria-hidden="true">⏳</span>
                            {comingSoonLabel}
                          </p>
                        </div>
                      </li>
                    );
                  }

                  const prog = courseProgress(n.slug, n.lessonSlugs, finishedLessons, legacyCourses);
                  const isDone = prog.finished;
                  return (
                    <li key={n.slug} className="m-0 p-0">
                      <a
                        ref={setRef}
                        href={n.href}
                        title={`${n.title} · ${prog.completed}/${prog.total} ${lessonsLabel}${isDone ? ` · ${finishedLabel}` : ''}`}
                        className={cx(
                          'group relative flex h-full w-28 max-w-[40vw] flex-col rounded-card border border-ink-200 p-2.5 shadow-soft transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-44 sm:max-w-[80vw] sm:p-3',
                          edge,
                          isDone && 'ring-2 ring-brand-400 ring-offset-1',
                        )}
                      >
                        {isDone ? (
                          <span
                            className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-pill bg-brand-600 text-white shadow-soft ring-2 ring-surface"
                            title={finishedLabel}
                          >
                            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 10.5l3.2 3.2L15 7" />
                            </svg>
                            <span className="sr-only">{finishedLabel}</span>
                          </span>
                        ) : null}
                        <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2">
                          <span
                            className={cx(
                              'grid h-7 w-7 shrink-0 place-items-center rounded-card text-base sm:h-9 sm:w-9 sm:text-xl',
                              tint,
                            )}
                          >
                            {n.icon}
                          </span>
                          {n.difficulty ? (
                            <span className={cx('difficulty-badge hidden sm:inline-flex', DIFFICULTY_CLASS[n.difficulty])}>
                              {difficultyLabels[n.difficulty]}
                            </span>
                          ) : null}
                        </div>
                        <h3
                          className={cx(
                            'font-display text-sm font-semibold leading-snug text-ink-900',
                            tintText,
                          )}
                        >
                          {n.title}
                        </h3>
                        {n.difficulty ? (
                          <span className={cx('difficulty-badge mt-1.5 self-start sm:hidden', DIFFICULTY_CLASS[n.difficulty])}>
                            {difficultyLabels[n.difficulty]}
                          </span>
                        ) : null}
                        <p
                          className={cx(
                            'mt-1.5 text-xs font-medium',
                            isDone ? 'text-brand-700' : 'text-ink-400',
                          )}
                        >
                          {prog.completed}/{prog.total} {lessonsLabel}
                        </p>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>

      {/* Difficulty legend — the zero-to-expert path at a glance. */}
      <ul className="mt-8 flex list-none flex-wrap items-center justify-center gap-3 p-0">
        {(['beginner', 'intermediate', 'advanced', 'expert'] as Difficulty[]).map((d) => (
          <li key={d} className="m-0 p-0">
            <span className={cx('difficulty-badge', DIFFICULTY_CLASS[d])}>{difficultyLabels[d]}</span>
          </li>
        ))}
      </ul>

      {caption ? (
        <figcaption className="mt-6 text-center text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default CourseGraph;
