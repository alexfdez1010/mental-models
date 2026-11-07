import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CommonsRuleLedger, commonsAccounts, commonsProfiles, type CommonsRuleModel, type CommonsRuleLedgerProps } from '@/components/react/CommonsRuleLedger';

const main: CommonsRuleModel = { benefit: 6, lossPerUser: 3, fine: 5, administration: 2 };
const transfer: CommonsRuleModel = { benefit: 4, lossPerUser: 2, fine: 3, administration: 1 };
const props: CommonsRuleLedgerProps = { ...main, title: 'Rule audit', users: ['A', 'B', 'C'], initialDetectionPercent: 50, initialProfile: [1, 0, 0] };
const render = (patch: Partial<CommonsRuleLedgerProps> = {}) => renderToStaticMarkup(createElement(CommonsRuleLedger, { ...props, ...patch }));

describe('exact commons ledger', () => {
  test('enumerates all eight profiles and preserves accounting across every integer percentage', () => {
    expect(new Set(commonsProfiles().map(p => p.join(''))).size).toBe(8);
    for (const model of [main, transfer, { ...main, fine: 0, administration: 0 }]) for (let percent = 0; percent <= 100; percent++) for (const p of commonsProfiles()) {
      const row = commonsAccounts(model, percent, p), n = p.reduce<number>((s, x) => s + x, 0);
      expect(row.combined).toBe((100 * ((model.benefit - 3 * model.lossPerUser) * n - model.administration)) || 0);
      expect(row.personal.reduce((s, x) => s + x, 0) + row.fund).toBe(row.combined);
      expect(row.fineTransfers).toBe(percent * model.fine * n);
    }
  });
  test('keeps a zero-detection rule distinct from no rule', () => {
    expect(commonsAccounts(main, 0, [1, 1, 1]).combined).toBe(-1100);
    expect(commonsAccounts({ ...main, fine: 0, administration: 0 }, 0, [1, 1, 1]).combined).toBe(-900);
    expect(commonsAccounts(main, 0, [0, 0, 0]).fund).toBe(-200);
  });
  test('uses exact incentive signs at the main tie and transfer cent boundary', () => {
    expect([59, 60, 61].map(q => commonsAccounts(main, q, [1, 0, 1]).unilateral)).toEqual([5, 0, -5]);
    expect([66, 67, 75].map(q => commonsAccounts(transfer, q, [0, 0, 0]).unilateral)).toEqual([2, -1, -25]);
    for (const p of commonsProfiles()) for (let i = 0; i < 3; i++) {
      const next = [...p] as typeof p; next[i] = next[i] ? 0 : 1;
      expect(commonsAccounts(main, 60, p).personal[i]).toBe(commonsAccounts(main, 60, next).personal[i]);
    }
  });
  test('formats small nonzero changes and localizes visible and hidden chrome', () => {
    const en = render({ ...transfer, initialDetectionPercent: 67, initialProfile: [0, 0, 0] });
    const es = render({ ...transfer, initialDetectionPercent: 67, initialProfile: [0, 0, 0], locale: 'es' });
    expect(en).toContain('-0.01'); expect(es).toContain('-0,01');
    expect(en).toContain('Each strictly prefers no addition'); expect(es).toContain('Todos prefieren estrictamente no añadir');
    expect(es).toContain('Probabilidad de detección'); expect(es).toContain('Perfil hipotético elegido');
    expect(es).not.toContain('Model prediction'); expect(es).not.toContain('Hypothetical choices');
    expect(render({ initialDetectionPercent: 60 })).toContain('all eight profiles are equilibria');
  });
  test('marks selected scenarios independently of predicted actions', () => {
    const html = render({ initialDetectionPercent: 100, initialProfile: [1, 1, 1] });
    expect(html).toContain('only no-add is an equilibrium');
    expect((html.match(/checked=""/g) ?? []).length).toBe(3);
    expect(html).toContain('Selected hypothetical profile');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('not-prose');
  });
  test('states credit units in headings without pluralizing one-credit readouts', () => {
    for (const locale of ['en', 'es'] as const) for (const percent of [20, 40]) {
      const html = render({ locale, initialDetectionPercent: percent });
      const unit = locale === 'es' ? 'créditos' : 'credits';
      const definitions = [...html.matchAll(/<dd[^>]*>(.*?)<\/dd>/g)].map(x => x[1]);
      const terms = [...html.matchAll(/<dt[^>]*>(.*?)<\/dt>/g)].map(x => x[1]);
      expect(terms.every(x => x.endsWith(`(${unit})`))).toBe(true);
      expect(definitions.every(x => !x.includes(unit))).toBe(true);
      expect(html).toContain(`(${unit}): -13 / 0 / +13`);
    }
  });
  test('accepted negative zero inputs have the same presentation as zero', () => {
    for (const locale of ['en', 'es'] as const) {
      expect(render({ locale, initialDetectionPercent: -0 })).toBe(render({ locale, initialDetectionPercent: 0 }));
      expect(render({ locale, benefit: -0, lossPerUser: -0, fine: -0, administration: -0 })).toBe(
        render({ locale, benefit: 0, lossPerUser: 0, fine: 0, administration: 0 }),
      );
    }
  });
  test('largest accepted coefficients retain safe exact products and combined balances', () => {
    for (const model of [
      { benefit: 0, lossPerUser: 10_000, fine: 10_000, administration: 10_000 },
      { benefit: 10_000, lossPerUser: 0, fine: 10_000, administration: 10_000 },
    ]) for (const percent of [0, 100]) for (const profile of commonsProfiles()) {
      const result = commonsAccounts(model, percent, profile);
      expect([...result.personal, result.fund, result.combined, result.fineTransfers, result.unilateral].every(Number.isSafeInteger)).toBe(true);
      const additions = profile.reduce<number>((sum, choice) => sum + choice, 0);
      const expected = 100n * ((BigInt(model.benefit) - 3n * BigInt(model.lossPerUser)) * BigInt(additions) - BigInt(model.administration));
      expect(BigInt(result.combined)).toBe(expected);
    }
  });
  test('rejects invalid authored values with a named error before hooks', () => {
    for (const field of ['benefit', 'lossPerUser', 'fine', 'administration'] as const) for (const bad of [-1, 0.1, NaN, Infinity, 10001, Number.MAX_SAFE_INTEGER]) {
      expect(() => render({ [field]: bad })).toThrow(`CommonsRuleLedger: ${field}`);
    }
    for (const bad of [-1, 0.6, NaN, 101]) expect(() => render({ initialDetectionPercent: bad })).toThrow('CommonsRuleLedger: detectionPercent');
    expect(() => render({ users: ['A', 'A', 'C'] })).toThrow('CommonsRuleLedger: users');
    expect(() => render({ users: ['A', ' A ', 'C'] })).toThrow('CommonsRuleLedger: users');
    expect(() => render({ users: Array(3) as [string, string, string] })).toThrow('CommonsRuleLedger: users');
    expect(() => render({ initialProfile: Array(3) as [0, 0, 0] })).toThrow('CommonsRuleLedger: profile');
    expect(() => render({ title: ' ' })).toThrow('CommonsRuleLedger: title');
    expect(() => render({ labels: { unit: '' } })).toThrow('CommonsRuleLedger: labels.unit');
    expect(() => commonsAccounts(main, 66 + 2 / 3, [0, 0, 0])).toThrow('CommonsRuleLedger: detectionPercent');
  });
});
