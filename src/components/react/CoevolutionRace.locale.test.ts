import { createElement } from 'react';
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoevolutionRace } from '@/components/react/CoevolutionRace';

test('the optional label preserves the default English output', () => {
  for (const props of [{}, { start: 0 }, { start: 65, youLabel: 'Alpha', rivalLabel: 'Beta' }]) {
    expect(renderToStaticMarkup(createElement(CoevolutionRace, props))).toBe(
      renderToStaticMarkup(createElement(CoevolutionRace, { ...props, aheadLabel: 'ahead' })),
    );
  }
});

test('the meter translates both racer labels without changing geometry or controls', () => {
  const props = { youLabel: 'Tú', rivalLabel: 'Rival' };
  const english = renderToStaticMarkup(createElement(CoevolutionRace, props));
  const spanish = renderToStaticMarkup(createElement(CoevolutionRace, { ...props, aheadLabel: 'por delante' }));
  expect(english).toContain('<span>Rival ahead</span>');
  expect(english).toContain('<span>Tú ahead</span>');
  expect(spanish).toContain('<span>Rival por delante</span>');
  expect(spanish).toContain('<span>Tú por delante</span>');
  expect(spanish).not.toContain(' ahead');
  expect(spanish.replaceAll(' por delante</span>', ' ahead</span>')).toBe(english);
});
