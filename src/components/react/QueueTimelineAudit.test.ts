import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueueTimelineAudit, computeFCFSRows, type QueueTimelineJob, type QueueTimelineAuditProps, type QueueTimelineLabels } from '@/components/react/QueueTimelineAudit';

const labels: QueueTimelineLabels = {
  title: 'Four jobs on one clock', instructions: 'Move the cursor. The shaded interval is observed; the complete supplied trace remains visible.',
  scenario: 'Trace', window: 'Observation window', cursor: 'Cursor time (min)', reset: 'Reset diagram',
  chart: 'Job intervals and occupancy', chartDescription: 'Dashed job bars are waiting; solid bars are service. The lower steps show N in the system and Nq waiting, after events at each time.',
  timeAxis: 'Time (min)', waitingLegend: 'Dashed bars: waiting', serviceLegend: 'Solid bars: service', windowLegend: 'Shaded window',
  system: 'In system (N)', waiting: 'Waiting (Nq)', inService: 'In service', duration: 'Window duration (min)',
  systemArea: 'System area (job·min)', waitingArea: 'Waiting area (job·min)', serviceArea: 'Service area (job·min)',
  meanSystem: 'Mean in system (jobs)', meanWaiting: 'Mean waiting (jobs)', busyFraction: 'Busy fraction',
  table: 'Complete trace and observed exposures', job: 'Job', arrival: 'Arrival (min)', service: 'Service (min)', start: 'Start (min)',
  departure: 'Departure (min)', wait: 'Full wait (min)', stay: 'Full stay (min)', observedStay: 'Observed stay (min)',
  observedWait: 'Observed wait (min)', observedService: 'Observed service (min)',
};

const main: QueueTimelineJob[] = [
  { id: 'A', arrival: 0, service: 3 }, { id: 'B', arrival: 1, service: 2 },
  { id: 'C', arrival: 2, service: 1 }, { id: 'D', arrival: 6, service: 2 },
];
function props(jobs = main, from = 0, to = 10, axisEnd = 10): QueueTimelineAuditProps {
  return { scenarios: [{ id: 'main', label: 'Main trace', jobs: jobs.map((j) => ({ ...j })), windows: [{ id: 'w', label: 'Window', from, to }] }], axisEnd, labels };
}
function render(p: QueueTimelineAuditProps): string { return renderToStaticMarkup(createElement(QueueTimelineAudit, p)); }

/** Independent whole-minute event clock: no max-arrival/previous-departure recurrence. */
function clock(jobs: QueueTimelineJob[]) {
  const rows = jobs.map((job) => ({ ...job, start: -1, departure: -1, wait: -1, stay: -1 }));
  const queue: number[] = [];
  let active: number | null = null;
  let remaining = 0;
  for (let time = 0; time <= 120; time++) {
    if (active !== null && remaining === 0) { rows[active]!.departure = time; active = null; }
    jobs.forEach((job, index) => { if (job.arrival === time) queue.push(index); });
    if (active === null && queue.length) { active = queue.shift()!; rows[active]!.start = time; remaining = jobs[active]!.service; }
    if (active !== null) remaining--;
    if (rows.every((row) => row.departure >= 0)) break;
  }
  return rows.map((row) => ({ ...row, wait: row.start - row.arrival, stay: row.departure - row.arrival }));
}
function numerator(html: string, key: string) {
  const match = html.match(new RegExp('data-queue-metric="' + key + '" data-numerator="(\\d+)"'));
  expect(match).not.toBeNull();
  return Number(match![1]);
}

describe('QueueTimelineAudit finite model', () => {
  test('matches an independent event clock across ties, idle gaps and service lengths', () => {
    for (let a = 0; a <= 3; a++) for (let b = a; b <= 3; b++) for (let sa = 1; sa <= 3; sa++) for (let sb = 1; sb <= 3; sb++) {
      const jobs = [{ id: 'Z', arrival: a, service: sa }, { id: 'A', arrival: b, service: sb }];
      expect(computeFCFSRows(jobs)).toEqual(clock(jobs));
    }
    expect(computeFCFSRows(main)).toEqual(clock(main));
    const largest = Array.from({ length: 8 }, (_, i) => ({ id: 'J' + i, arrival: 30, service: 10 }));
    expect(computeFCFSRows(largest)).toEqual(clock(largest));
    expect(computeFCFSRows(largest).at(-1)!.departure).toBe(110);
  });

  test('preserves original order at equal times and serves an older waiter before a simultaneous arrival', () => {
    const jobs = [{ id: 'Z', arrival: 0, service: 3 }, { id: 'A', arrival: 0, service: 1 }, { id: 'B', arrival: 3, service: 2 }];
    expect(computeFCFSRows(jobs).map((r) => r.start)).toEqual([0, 3, 4]);
    expect(computeFCFSRows([jobs[1]!, jobs[0]!, jobs[2]!]).map((r) => r.start)).toEqual([0, 1, 4]);
    const html = render(props(jobs, 3, 4, 6));
    expect(html).toContain('data-time="3" data-system="2" data-waiting="1" data-service="1"');
  });

  test('counts clipped system, waiting and service exposure independently', () => {
    for (const [from, to] of [[0, 10], [0, 4], [2, 5], [8, 10]]) {
      const rows = clock(main), html = render(props(main, from!, to!));
      let area = 0, wait = 0, busy = 0;
      for (let t = from!; t < to!; t++) {
        const u = t + 0.5;
        const n = rows.filter((r) => r.arrival <= u && u < r.departure).length;
        const nq = rows.filter((r) => r.arrival <= u && u < r.start).length;
        const b = rows.filter((r) => r.start <= u && u < r.departure).length;
        expect(n).toBe(nq + b);
        expect(nq === 0 || b === 1).toBe(true);
        area += n; wait += nq; busy += b;
      }
      expect(numerator(html, 'system-area')).toBe(area);
      expect(numerator(html, 'waiting-area')).toBe(wait);
      expect(numerator(html, 'service-area')).toBe(busy);
    }
    expect(numerator(render(props()), 'system-area')).toBe(13);
    expect(numerator(render(props()), 'waiting-area')).toBe(5);
  });

  test('keeps full times separate from zero observed exposure and never invents an empty cohort mean', () => {
    const jobs = [{ id: 'A', arrival: 2, service: 1 }, { id: 'B', arrival: 4, service: 1 }];
    const html = render(props(jobs, 0, 1, 6));
    expect(numerator(html, 'system-area')).toBe(0);
    expect(html).toContain('data-queue-row="A" data-arrival="2" data-start="2" data-departure="3"');
    expect(html).not.toMatch(/NaN|Infinity|Mean cohort/);
    expect(html).not.toContain('data-queue-wait="0"');
    expect(render(props())).toContain('13/10 = 1.3');
  });

  test('provides stable axes, native controls, named scroll regions and one concise live region', () => {
    const p = props();
    p.scenarios[0]!.windows.push({ id: 'clip', label: 'Short window', from: 0, to: 4 });
    p.scenarios.push({ id: 'second', label: 'Other trace', jobs: main.map((j) => ({ ...j })), windows: [{ id: 'full', label: 'Full', from: 0, to: 10 }] });
    const html = render(p);
    expect((html.match(/<select/g) ?? []).length).toBe(2);
    const range = html.match(/<input[^>]*type="range"[^>]*>/)![0];
    for (const attr of ['min="0"', 'max="10"', 'step="1"', 'value="0"']) expect(range).toContain(attr);
    expect((html.match(/aria-live="polite"/g) ?? []).length).toBe(1);
    expect((html.match(/tabindex="0" role="region"/g) ?? []).length).toBe(2);
    expect(html).toContain('display:table;overflow:visible;margin:0;min-width:58rem');
    expect(html).toContain('stroke-dasharray="5 3"');
    expect(html).toContain('disabled=""');
  });

  test('normalizes numeric negative zero', () => {
    const p = props([{ id: 'A', arrival: -0, service: 1 }, { id: 'B', arrival: 0, service: 1 }], -0, 2, 2);
    expect(computeFCFSRows(p.scenarios[0]!.jobs)[0]!.arrival).toBe(0);
    expect(Object.is(computeFCFSRows(p.scenarios[0]!.jobs)[0]!.arrival, -0)).toBe(false);
    expect(render(p)).not.toMatch(/value="-0"|>-0</);
  });

  test('rejects malformed, sparse and hidden data before rendering', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, 121]) expect(() => render({ ...props(), axisEnd: bad })).toThrow('QueueTimelineAudit:');
    for (const bad of [0, -1, 1.5, NaN, Infinity, 11]) {
      const p = props(); p.scenarios[0]!.jobs[1]!.service = bad;
      expect(() => render(p)).toThrow('QueueTimelineAudit:');
    }
    const cases: QueueTimelineAuditProps[] = [];
    const holes = props(); holes.scenarios = new Array(2); cases.push(holes);
    const sparse = props(); sparse.scenarios[0]!.jobs = new Array(2); cases.push(sparse);
    const unordered = props(); unordered.scenarios[0]!.jobs = [{ id: 'A', arrival: 2, service: 1 }, { id: 'B', arrival: 1, service: 1 }]; cases.push(unordered);
    const duplicated = props(); duplicated.scenarios[0]!.jobs[1]!.id = 'A'; cases.push(duplicated);
    const badWindow = props(); badWindow.scenarios[0]!.windows.push({ id: 'hidden', label: 'Hidden', from: 5, to: 5 }); cases.push(badWindow);
    const hidden = props(); hidden.scenarios.push({ id: 'hidden', label: 'Hidden', jobs: [{ id: 'X', arrival: 30, service: 10 }, { id: 'Y', arrival: 30, service: 10 }], windows: [{ id: 'w', label: 'W', from: 0, to: 10 }] }); cases.push(hidden);
    const noLabels = props(); noLabels.labels = {} as QueueTimelineLabels; cases.push(noLabels);
    for (const p of cases) expect(() => render(p)).toThrow('QueueTimelineAudit:');
  });
});
