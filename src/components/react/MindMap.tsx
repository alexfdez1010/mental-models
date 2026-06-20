import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A node in a {@link MindMap}. Compose recursively via {@link children}. */
export interface MindNode {
  /** Short label for this node (a concept / chunk). */
  label: string;
  /** Optional sub-branches. */
  children?: MindNode[];
}

/** Props for the {@link MindMap} component. */
export interface MindMapProps {
  /** The central node and its branches. */
  root: MindNode;
  /** Optional heading shown above the map. */
  title?: string;
  /** Optional caption shown beneath the map. */
  caption?: string;
  /** Eyebrow label. Defaults to `'Big picture'`. */
  eyebrow?: string;
  /** Summary text for the collapsible text-outline fallback. Defaults to `'Text outline'`. */
  outlineLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/** Mindmap node labels can't contain mermaid's structural characters. */
function sanitize(label: string): string {
  return label.replace(/[()[\]{}:;#"]/g, '').replace(/\s+/g, ' ').trim();
}

/** Serialise the node tree into mermaid `mindmap` syntax (2-space indents). */
function toMermaid(root: MindNode): string {
  const lines = ['mindmap', `  root((${sanitize(root.label)}))`];
  const walk = (nodes: MindNode[], depth: number) => {
    const pad = '  '.repeat(depth);
    for (const n of nodes) {
      lines.push(`${pad}${sanitize(n.label)}`);
      if (n.children?.length) walk(n.children, depth + 1);
    }
  };
  walk(root.children ?? [], 2);
  return lines.join('\n');
}

/** Accessible, no-JS-friendly nested list mirroring the same tree. */
function Outline({ node, root = false }: { node: MindNode; root?: boolean }) {
  return (
    <li className={cx(!root && 'mt-1')}>
      <span className={cx(root ? 'font-display font-semibold text-ink-900' : 'text-ink-700')}>
        {node.label}
      </span>
      {node.children?.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-brand-400">
          {node.children.map((c, i) => (
            <Outline key={i} node={c} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Mind-map island for the **chunking close** of a lesson — a learner-built
 * "big picture" recap rendered as a Mermaid `mindmap`. Author the tree as
 * structured {@link MindNode} data; the component generates both the visual
 * diagram and an equivalent accessible text outline from the same source.
 *
 * The Mermaid renderer is loaded lazily on the client (no SSR / no-JS hard
 * dependency): until it mounts — and whenever the diagram can't render — the
 * nested text outline is shown instead, so the information is never lost. The
 * outline also stays available behind a `<details>` toggle once the diagram is
 * up, for screen readers and `prefers-reduced-motion` users.
 */
export function MindMap({
  root,
  title,
  caption,
  eyebrow = 'Big picture',
  outlineLabel = 'Text outline',
  className,
}: MindMapProps) {
  // Fail the build on a mis-authored map rather than rendering an empty figure.
  // Runs during SSR/prerender → red build.
  if (!root || !root.label?.trim()) {
    throw new Error('MindMap: `root` must be an object with a non-empty `label`.');
  }
  if (!root.children?.length) {
    throw new Error(
      `MindMap "${root.label}": \`root.children\` is empty — a map with no ` +
        'branches has nothing to show.',
    );
  }

  const reactId = useId();
  const safeId = `mindmap-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          // 'base' is the only built-in theme that honours themeVariables, so we
          // can paint the mindmap in the site's blue-forward palette instead of
          // mermaid's default greys. Tokens mirror src/styles/global.css @theme.
          theme: 'base',
          themeVariables: {
            fontFamily:
              "'Lexend Variable','Inter Variable',ui-sans-serif,system-ui,sans-serif",
            primaryColor: '#dbeafe', // brand-100 — node fill
            primaryBorderColor: '#2563eb', // brand-600 — node border
            primaryTextColor: '#0f172a', // ink-900 — node text
            lineColor: '#60a5fa', // brand-400 — connectors
            // Keep the per-branch section colours on a single blue ramp so the
            // diagram reads as one family rather than mermaid's rainbow.
            cScale0: '#eff6ff', // brand-50
            cScale1: '#dbeafe', // brand-100
            cScale2: '#bfdbfe', // brand-200
            cScale3: '#93c5fd', // brand-300
            cScale4: '#60a5fa', // brand-400
            cScale5: '#3b82f6', // brand-500
            cScale6: '#2563eb', // brand-600
            cScale7: '#1d4ed8', // brand-700
            cScaleLabel0: '#0f172a',
            cScaleLabel1: '#0f172a',
            cScaleLabel2: '#0f172a',
            cScaleLabel3: '#0f172a',
            cScaleLabel4: '#ffffff',
            cScaleLabel5: '#ffffff',
            cScaleLabel6: '#ffffff',
            cScaleLabel7: '#ffffff',
          },
          mindmap: { padding: 12 },
        });
        const { svg: out } = await mermaid.render(safeId, toMermaid(root));
        if (mounted.current) setSvg(out);
      } catch {
        if (mounted.current) setFailed(true);
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [root, safeId]);

  const showDiagram = svg && !failed;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-600">
        {eyebrow}
      </p>
      {title ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</p>
      ) : null}

      {showDiagram ? (
        <>
          <div
            role="img"
            aria-label={`Mind map: ${title ?? root.label}`}
            className="mt-4 overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
            // Mermaid output is generated locally from author data, not user input.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-medium text-brand-600 hover:text-brand-700">
              {outlineLabel}
            </summary>
            <ul className="mt-2 space-y-1">
              <Outline node={root} root />
            </ul>
          </details>
        </>
      ) : (
        <ul className="mt-4 space-y-1">
          <Outline node={root} root />
        </ul>
      )}

      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default MindMap;
