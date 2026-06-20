/**
 * check-island-latex.ts — fail the build on bad math/escaping inside island props.
 *
 * Two bugs, both of which leave `bun run check:latex` and `astro build` green:
 *
 *  1. Escaped `\$` in a STRING prop. In MDX PROSE a bare `$` opens a KaTeX span,
 *     so authors write `\$50` to mean a literal dollar — a correct habit there.
 *     But a JSX attribute value (`question="…"`, `text="…"`) is NOT prose and
 *     NOT a JS string: backslash escapes are not processed, so `\$50` renders
 *     the backslash literally ("\$50" on the page). Inside a `{…}` expression
 *     prop the value IS JS, where `"\$"` harmlessly collapses to `$`, so the bug
 *     is string-attrs only.
 *
 *  2. LaTeX math in any prop. (original purpose, below)
 *
 * KaTeX only renders `$…$`/`$$…$$` that remark-math finds in PROSE. Math that
 * lands inside a React-island JSX attribute — `question="… $r^n$ …"`, a Quiz
 * `options={[{ prompt: '$P=F/(1+r)^n$' }]}` array, etc. — is just an opaque
 * string to remark-math, so it never renders: the literal `$r^n$` ships to the
 * page. `bun run check:latex` can't catch it (it only sees real math nodes), and
 * `astro build` stays green. This is the project rule "no LaTeX/numbers inside
 * components — put math in MDX prose"; this script enforces it mechanically.
 *
 * It parses every content MDX with remark-mdx (NO remark-math, so `$` stays a
 * literal char), walks every JSX element, and inspects each attribute's text —
 * both plain string values AND `{…}` expression sources (where Quiz/MCQ option
 * arrays live). A `$…$` span that looks like math (contains `\`, `^`, or `_`) or
 * a bare LaTeX command (`\frac`, `\times`, …) is reported with file, line and the
 * offending component, then the script exits non-zero. Plain currency like
 * `$80` (no backslash/caret/underscore) is left alone.
 *
 * Run: `bun run check:island-latex`. Wired into `check` + `pre-commit`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(ROOT, 'src/content');

// remark-math is needed so PROSE `$…$`/`$$…$$` is consumed as math nodes; without
// it, math containing `{`/`}` is mis-parsed as a broken MDX expression and acorn
// throws. It does NOT touch JSX attribute strings — those stay literal, which is
// exactly what we scan.
const processor = unified().use(remarkParse).use(remarkMdx).use(remarkMath);

type Kind = 'math' | 'escaped-dollar';

interface Problem {
  kind: Kind;
  file: string;
  line: number | undefined;
  component: string;
  attr: string;
  snippet: string;
}

const problems: Problem[] = [];
let filesScanned = 0;
let jsxNodes = 0;

function walkMdx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMdx(full));
    else if (entry.name.endsWith('.mdx')) out.push(full);
  }
  return out;
}

// Bare LaTeX commands that should never appear in a prop (math belongs in prose).
const LATEX_COMMAND =
  /\\(frac|d?frac|times|cdot|div|sqrt|sum|prod|int|approx|neq|leq|geq|le|ge|pm|mp|left|right|begin|end|mathrm|mathbf|text|alpha|beta|gamma|delta|sigma|mu|pi|lambda|theta|infty|cdots|ldots)\b/;

/**
 * Return the LaTeX-looking snippets in `text`, or [] if none.
 *
 * The hard part is NOT confusing a real inline math span with prose that merely
 * uses `$` for currency. Finance copy is full of `$2,159` and inline `(1.08)^10`,
 * and two currency markers can straddle a whole sentence — so "has a `$…$` span
 * containing `^`" alone fires on every quiz. Real `$…$` math is instead *tight*:
 * short, no commas (thousands separators ⇒ currency), at most one space. We flag:
 *   1. a `$…$` / `$$…$$` span that is tight AND carries a math marker (\ ^ _), or
 *   2. a bare LaTeX command anywhere (`\frac`, `\times`, …) — unambiguous.
 */
function isTightMath(inner: string): boolean {
  if (inner.length > 24) return false; // long ⇒ prose between two currency $
  if (inner.includes(',')) return false; // thousands separator ⇒ currency
  if ((inner.match(/\s/g)?.length ?? 0) > 1) return false; // prose has spaces
  return /[\\^_]/.test(inner); // exponent / subscript / command
}

function findLatex(raw: string): string[] {
  // `\$` is an escaped literal dollar (currency), not LaTeX — neutralise it so it
  // reads as neither a `$` math delimiter nor a stray backslash command.
  const text = raw.replace(/\\\$/g, 'USD');
  const hits: string[] = [];
  const spanRe = /\$\$?([^$]+?)\$\$?/g;
  let m: RegExpExecArray | null;
  while ((m = spanRe.exec(text)) !== null) {
    if (isTightMath(m[1])) hits.push(m[0]);
  }
  const cmd = text.match(LATEX_COMMAND);
  if (cmd) hits.push(cmd[0]);
  return hits;
}

function clip(s: string): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > 80 ? `${flat.slice(0, 77)}…` : flat;
}

for (const abs of walkMdx(CONTENT)) {
  const source = readFileSync(abs, 'utf8');
  const tree = processor.parse(source);
  filesScanned++;

  visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node: any) => {
    jsxNodes++;
    const component = node.name ?? '(fragment)';
    for (const attr of node.attributes ?? []) {
      if (attr.type !== 'mdxJsxAttribute') continue; // skip {...spread}
      // A plain string value (question="…") is JSX text: backslash escapes are
      // NOT processed, so `\$50` renders the backslash literally. An expression
      // value (options={[…]}) is JS source where `\$` in a string literal is a
      // harmless escape for `$` — so the `\$` bug only exists in string attrs.
      const isString = typeof attr.value === 'string';
      const text = isString ? attr.value : (attr.value?.value ?? '');
      if (!text) continue;
      const line = (attr.position ?? node.position)?.start?.line;
      const push = (kind: Kind, snippet: string) =>
        problems.push({
          kind,
          file: relative(ROOT, abs),
          line,
          component,
          attr: attr.name ?? '?',
          snippet,
        });

      // Bug 1 — `\$` in a string prop: renders a literal backslash on the page.
      if (isString && /\\\$/.test(text)) {
        for (const m of text.match(/\S*\\\$\S*/g) ?? []) push('escaped-dollar', clip(m));
      }
      // Bug 2 — LaTeX math in any prop: KaTeX never renders it, ships as `$…$`.
      for (const hit of findLatex(text)) push('math', clip(hit));
    }
  });
}

if (problems.length === 0) {
  console.log(
    `✓ Island props OK — no escaped \`\\$\` or LaTeX math in island props across ${jsxNodes} JSX elements in ${filesScanned} MDX files.`,
  );
  process.exit(0);
}

const dollar = problems.filter((p) => p.kind === 'escaped-dollar');
const math = problems.filter((p) => p.kind === 'math');
console.error(`✗ Bad LaTeX/escaping in island props — ${problems.length} occurrence(s):\n`);
for (const p of problems) {
  const tag = p.kind === 'escaped-dollar' ? 'escaped \\$' : 'LaTeX math';
  console.error(`  ${p.file}:${p.line ?? '?'}  <${p.component} ${p.attr}=…>  [${tag}]`);
  console.error(`    found: ${p.snippet}\n`);
}
if (dollar.length) {
  console.error(
    'Escaped `\\$` in a STRING prop renders the backslash literally (`\\$50` on the\n' +
      'page). In a JSX attribute `$` is already a plain char — never escape it.\n' +
      'Fix: drop the backslash — write `$50`, not `\\$50`. (The `\\$` habit is only\n' +
      'correct in MDX PROSE, where a bare `$` would start a KaTeX span.)',
  );
}
if (math.length) {
  console.error(
    '\nKaTeX never renders `$…$` inside a JSX attribute — the literal text ships.\n' +
      'Move the math into MDX prose (a `$…$`/`$$…$$` block between paragraphs) and\n' +
      'keep prop strings plain. Currency like `$80` is fine; `$r^n$` / `\\frac…` is not.',
  );
}
process.exit(1);
