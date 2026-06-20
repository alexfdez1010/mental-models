/**
 * check-latex.ts — fail the build on broken LaTeX.
 *
 * rehype-katex defaults to throwOnError:false, so a malformed `$...$` renders
 * as red error text instead of failing `astro build`. This script catches that
 * class of bug ahead of time: it parses every content MDX with the SAME plugins
 * Astro uses (remark-mdx + remark-math), so JSX attribute strings like
 * `question="...$1,000..."` are NOT mistaken for math, then renders each real
 * math node through KaTeX with throwOnError:true. Any parse error is reported
 * with file, line and the offending expression, and exits non-zero.
 *
 * Run: `bun run check:latex`. Wired into `pre-commit`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import katex from 'katex';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(ROOT, 'src/content');

const processor = unified().use(remarkParse).use(remarkMdx).use(remarkMath);

interface Problem {
  file: string;
  line: number | undefined;
  display: boolean;
  expr: string;
  message: string;
}

const problems: Problem[] = [];
let filesScanned = 0;
let mathNodes = 0;

function walkMdx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMdx(full));
    else if (entry.name.endsWith('.mdx')) out.push(full);
  }
  return out;
}

for (const abs of walkMdx(CONTENT)) {
  const source = readFileSync(abs, 'utf8');
  const tree = processor.parse(source);
  filesScanned++;

  visit(tree, ['math', 'inlineMath'], (node: any) => {
    mathNodes++;
    const display = node.type === 'math';
    try {
      katex.renderToString(node.value, {
        displayMode: display,
        throwOnError: true,
        // strict: warn on dubious-but-renderable input (e.g. unicode that
        // KaTeX silently passes); keep it from hard-failing on locale chars.
        strict: 'ignore',
      });
    } catch (err) {
      problems.push({
        file: relative(ROOT, abs),
        line: node.position?.start?.line,
        display,
        expr: node.value,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

if (problems.length === 0) {
  console.log(
    `✓ LaTeX OK — ${mathNodes} math expressions across ${filesScanned} MDX files render cleanly.`,
  );
  process.exit(0);
}

console.error(`✗ LaTeX errors — ${problems.length} broken expression(s):\n`);
for (const p of problems) {
  const kind = p.display ? '$$block$$' : '$inline$';
  console.error(`  ${p.file}:${p.line ?? '?'}  (${kind})`);
  console.error(`    expr: ${p.expr}`);
  console.error(`    ${p.message.replace(/\n/g, '\n    ')}\n`);
}
console.error(
  'Common cause: a `\\$` (escaped dollar) INSIDE a `$...$` span — the math\n' +
    'delimiter scanner closes the span at that `$`, leaving a stray `\\`.\n' +
    'Fix: move currency amounts OUT of the math span (e.g. `$0.08 \\times 1000$, i.e. \\$80`).',
);
process.exit(1);
