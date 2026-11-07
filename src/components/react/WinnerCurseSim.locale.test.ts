import { expect, test } from 'bun:test';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Replace only initial state in memory. The source algorithm is not executed or edited.
let seed: Record<string, unknown> = {};
Bun.plugin({ name: 'winner-locale-fixture-state', setup(build) {
  build.onLoad({ filter: /WinnerCurseSim\.tsx$/ }, args => {
    let source = fs.readFileSync(args.path, 'utf8');
    source = source.replace('const [shade, setShade] = useState(false);', 'const [shade, setShade] = useState(!!globalThis.__winnerLocaleFixture.shade);');
    source = source.replace('useState<AuctionResult | null>(null)', 'useState<AuctionResult | null>(globalThis.__winnerLocaleFixture.last ?? null)');
    source = source.replace('useState<Totals>(EMPTY_TOTALS)', 'useState<Totals>(globalThis.__winnerLocaleFixture.totals ?? EMPTY_TOTALS)');
    return { contents: source, loader: 'tsx' };
  });
} });
const current = (await import('@/components/react/WinnerCurseSim')).WinnerCurseSim;
const render = (component: typeof current, props: Parameters<typeof current>[0]) => {
  (globalThis as unknown as { __winnerLocaleFixture: unknown }).__winnerLocaleFixture = seed;
  return renderToStaticMarkup(createElement(component, props));
};
const fixtures = [
  { props: {}, state: {} },
  { props: { initialBidders: 2, initialNoise: 0 }, state: {} },
  { props: { initialBidders: 24, initialNoise: 40 }, state: { shade: true } },
  { props: { trueValue: 1000, maxNoise: 60, initialNoise: 30, unit: '€' }, state: { shade: true, last: { estimates: [975.1, 1002.4, 1025.9], winnerIdx: 2, winningEstimate: 1025.9, winningBid: 1012.4, profit: -12.4 }, totals: { rounds: 3, sumOvershoot: 45.3, sumOverpay: 22.2, sumProfit: -22.2 } } },
  { props: { unit: '£' }, state: { last: { estimates: [90.1, 110.3], winnerIdx: 1, winningEstimate: 110.3, winningBid: 110.3, profit: -10.3 }, totals: { rounds: 2, sumOvershoot: 0.08, sumOverpay: -0.08, sumProfit: 0 } } },
];
test('default and explicit English match on initial, shaded, fractional and zero fixtures', () => {
  for (const f of fixtures) { seed = f.state; expect(render(current, f.props)).toBe(render(current, { ...f.props, locale: 'en' })); }
});
test('Spanish changes displayed average decimal separators and preserves geometry/control attributes', () => {
  for (const f of fixtures) {
    seed = f.state; const en = render(current, f.props), es = render(current, { ...f.props, locale: 'es' });
    const geometry = (html: string) => [...html.matchAll(/\b(?:viewBox|x|y|x1|x2|y1|y2|cx|cy|r|width|height|d|transform|points)="([^"]*)"/g)].map(m => m[0]);
    const controls = (html: string) => [...html.matchAll(/<(?:input|button)[^>]*>/g)].map(m => m[0]);
    if (f.state.totals && f.props.unit === '€') { expect(en).toContain('+€15.1'); expect(es).toContain('+€15,1'); expect(es).toContain('−€7,4'); }
    expect(geometry(es)).toEqual(geometry(en)); expect(controls(es)).toEqual(controls(en));
    expect(es).toBe(en.replace(/([£€$]\d+)\.(\d)(?=<)/g, '$1,$2'));
  }
});
