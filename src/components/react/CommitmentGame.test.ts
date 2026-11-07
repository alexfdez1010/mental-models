import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { CommitmentGame, type CommitmentGameProps } from '@/components/react/CommitmentGame';

// Render the delivered component at a controlled reachable state. This hook seam
// changes no production handlers and makes no claim about browser hydration.
const source = fs.readFileSync(path.join(import.meta.dir, 'CommitmentGame.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
function at(own: number, rival: number, committed: boolean, props: CommitmentGameProps = {}) {
  const state = [committed, own, rival]; let index = 0;
  const module = { exports: {} as { CommitmentGame?: typeof CommitmentGame } };
  const require = (name: string) => name === 'react' ? { ...React, useId: () => 'controlled-id', useMemo: (f: () => unknown) => f(), useState: () => [state[index++], () => {}] } : name === 'react/jsx-runtime' ? undefined : name === '@/components/react/cx' ? { cx: (...v: unknown[]) => v.filter(Boolean).join(' ') } : (() => { throw Error('Unexpected dependency ' + name); })();
  new Function('require', 'module', 'exports', 'React', compiled)(require, module, module.exports, React);
  return renderToStaticMarkup(module.exports.CommitmentGame!(props));
}
function oracle(own: number, rival: number, committed: boolean) {
  const fight = committed || own > 5;
  const challenge = (fight ? rival : 7) > 4;
  return challenge ? fight ? { outcome: 'You fight', you: own, rival } : { outcome: 'You yield', you: 5, rival: 7 } : { outcome: 'Rival stays away', you: 10, rival: 4 };
}
const tags = { verdictDeters: 'VERDICT_DETERS', verdictCredibleAnyway: 'VERDICT_CREDIBLE', verdictRedundant: 'VERDICT_REDUNDANT', verdictTrap: 'VERDICT_TRAP', verdictExposed: 'VERDICT_EXPOSED', tieVerdict: 'VERDICT_TIE' };
function legacyCategory(own: number, rival: number, committed: boolean) {
  const current = oracle(own, rival, committed), other = oracle(own, rival, !committed);
  return committed ? current.outcome === 'Rival stays away' ? other.outcome === 'Rival stays away' ? tags.verdictRedundant : tags.verdictDeters : tags.verdictTrap : current.outcome === 'Rival stays away' ? tags.verdictCredibleAnyway : tags.verdictExposed;
}
describe('CommitmentGame selected continuations', () => {
  test('all 242 states retain numerical outcomes and the explicit Yield / Stay tie policies', () => {
    let unchanged = 0, corrected = 0, frontier = 0;
    for (let own = -2; own <= 8; own++) for (let rival = -2; rival <= 8; rival++) for (const committed of [false, true]) {
      const html = at(own, rival, committed, tags), answer = oracle(own, rival, committed);
      expect(html).toContain(`Equilibrium: ${answer.outcome}. You get ${answer.you}, the rival gets ${answer.rival}.`);
      expect((html.match(/type="range"/g) ?? []).length).toBe(2);
      expect((html.match(/type="checkbox"/g) ?? []).length).toBe(1);
      expect(html).toContain(`aria-valuetext="your fight payoff ${own}"`);
      expect(html).toContain(`aria-valuetext="rival fight payoff ${rival}"`);
      const category = html.match(/VERDICT_[A-Z]+/)?.[0];
      if (own === 5 || rival === 4) { frontier++; expect(category).toBe(tags.tieVerdict); }
      else if (own > 5 && rival > 4) { corrected++; expect(category).toBe(tags.verdictRedundant); expect(category).not.toBe(legacyCategory(own, rival, committed)); }
      else { unchanged++; expect(category).toBe(legacyCategory(own, rival, committed)); }
    }
    expect([unchanged, corrected, frontier]).toEqual([176, 24, 42]);
  });
  test('default English markup, controls and initial values remain compatible', () => {
    const html = renderToStaticMarkup(createElement(CommitmentGame, {}));
    expect(html).toContain('Equilibrium: You yield. You get 5, the rival gets 7.');
    expect(html).toContain('Exposed. With your retreat intact');
    expect(html).toContain('min="-2" max="8" step="1"');
    expect(html).toContain('aria-valuetext="your fight payoff 2"');
    expect(html).toContain('aria-valuetext="rival fight payoff 1"');
    expect(html).not.toContain('At these settings at least one comparison is tied.');
  });
  test('boundary copy does not infer a unique equilibrium or an initial installation value', () => {
    for (const [own, rival] of [[5, 3], [5, 4], [5, 5], [4, 4], [6, 4]]) for (const committed of [false, true]) {
      const html = at(own!, rival!, committed);
      expect(html).toContain('This model selects Yield');
      expect(html).toContain('a tie does not establish a unique equilibrium or that committing raises your payoff.');
    }
    for (const committed of [false, true]) {
      const html = at(6, 5, committed);
      expect(html).toContain('Committing changed nothing this time');
      expect(html).not.toContain('Exposed.'); expect(html).not.toContain('A commitment trap.');
    }
  });
  test('localized accessible templates compose negative, zero and maximum values without changing inputs', () => {
    for (const value of [-2, 0, 8]) {
      const html = at(value, value, false, { yourFightValueTemplate: 'tu pago al luchar {value}', rivalFightValueTemplate: 'pago del rival al luchar {value}' });
      expect(html).toContain(`aria-valuetext="tu pago al luchar ${value}"`);
      expect(html).toContain(`aria-valuetext="pago del rival al luchar ${value}"`);
      expect(html).not.toContain('aria-valuetext="your fight payoff');
    }
    expect(at(5, 4, false, { tieVerdict: 'Empate: se muestra una continuación elegida.' })).toContain('Empate: se muestra una continuación elegida.');
  });
});
