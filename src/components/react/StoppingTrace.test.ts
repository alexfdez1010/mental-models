import { describe, expect, test } from 'bun:test';
import { stoppingView, validateStoppingExamples } from '@/components/react/StoppingTrace';

const A = [2, 5, 1, 4, 6, 3];
const B = [2, 4, 5, 1, 6, 3];
const C = [6, 1, 2, 3, 4, 5];

describe('StoppingTrace declared policy and information', () => {
  test('reveals relative comparisons only and locks on the first eligible record', () => {
    expect(stoppingView(A, 2, 0)).toEqual({ observedCount: 0, selectedPosition: null, rows: [] });
    expect(stoppingView(A, 2, 2).rows).toEqual([
      { position: 1, relativeRank: 2, action: 'sample' },
      { position: 2, relativeRank: 1, action: 'sample' },
    ]);
    const stop = stoppingView(A, 2, 6);
    expect(stop.observedCount).toBe(5);
    expect(stop.selectedPosition).toBe(5);
    expect(stop.rows.at(-1)?.action).toBe('record');
    expect(stop.rows.map(row => row.relativeRank).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(stop).not.toHaveProperty('order');
    expect(stop.rows[0]).not.toHaveProperty('globalRank');
  });

  test('sound policy can stop before the true greatest and cannot reveal later candidates', () => {
    const stop = stoppingView(B, 2, 6);
    expect(stop.selectedPosition).toBe(3);
    expect(stop.observedCount).toBe(3);
    expect(stop.rows).toHaveLength(3);
  });

  test('zero cutoff accepts first; final fallback selects even a nonrecord', () => {
    expect(stoppingView(A, 0, 6).selectedPosition).toBe(1);
    expect(stoppingView(C, 2, 5).selectedPosition).toBeNull();
    expect(stoppingView(C, 2, 6).rows.at(-1)?.action).toBe('final');
    expect(stoppingView(C, 2, 6).selectedPosition).toBe(6);
    expect(stoppingView(A, 5, 6).selectedPosition).toBe(6);
  });

  test('same observed comparisons have the same public view despite other absolute ranks and unseen future', () => {
    expect(stoppingView([2, 5, 1, 4, 6, 3], 2, 2)).toEqual(stoppingView([4, 6, 3, 2, 1, 5], 2, 2));
    expect(stoppingView([2, 5, 1, 4, 6, 3], 2, 3)).toEqual(stoppingView([4, 6, 1, 3, 2, 5], 2, 3));
    expect(stoppingView([2, 4, 5, 1, 6, 3], 2, 6)).toEqual(stoppingView([1, 3, 4, 6, 2, 5], 2, 6));
  });

  test('validates all examples, including initially hidden examples', () => {
    expect(() => validateStoppingExamples([{ label: 'A', order: A }, { label: 'B', order: B }])).not.toThrow();
    for (const order of [[1, 1], [0, 2], [1, 2.5], [1, Infinity], [1, 3], [1]]) {
      expect(() => validateStoppingExamples([{ label: 'invalid', order }])).toThrow();
    }
    expect(() => validateStoppingExamples([{ label: 'A', order: A }, { label: 'invalid', order: [1, 1, 2, 3, 4, 5] }])).toThrow();
    expect(() => validateStoppingExamples([{ label: 'A', order: A }, { label: 'other horizon', order: [1, 2] }])).toThrow();
    expect(() => validateStoppingExamples([{ label: ' ', order: A }])).toThrow();
    expect(() => validateStoppingExamples([{ label: 42 as unknown as string, order: A }])).toThrow('StoppingTrace examples require labels and the same horizon from two to eight.');
    expect(() => validateStoppingExamples([])).toThrow();
  });

  test('rejects invalid cutoff and reveal counts', () => {
    for (const cutoff of [-1, 6, 1.5, NaN]) expect(() => stoppingView(A, cutoff, 0)).toThrow();
    for (const count of [-1, 7, 1.5, NaN]) expect(() => stoppingView(A, 2, count)).toThrow();
  });
});
