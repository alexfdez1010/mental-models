import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One certain final amount and an equiprobable two-outcome alternative. */
export interface ReferenceChoiceCase {
  label: string;
  safe: number;
  low: number;
  high: number;
}
/** Interface strings; authored cases and titles use the lesson's language. */
export interface ReferenceChoiceLabels {
  scenario: string; reference: string; coefficient: string; rule: string; scales: string;
  changeAxis: string; scoreAxis: string; certain: string; risky: string; low: string; high: string;
  outcome: string; probability: string; finalCredits: string; change: string; score: string; contribution: string;
  table: string; calculation: string; safeScore: string; riskyScore: string; difference: string;
  safePreferred: string; riskyPreferred: string; tie: string;
}
/** Bounded linear reference audit, with ordinary probabilities fixed at one half. */
export interface ReferenceChoiceAuditProps {
  title: string;
  cases: ReferenceChoiceCase[];
  initialCaseIndex?: number;
  initialReference?: 80 | 90 | 100 | 130;
  /** Four times lambda: 4,6,8,9,12 represent 1,1.5,2,2.25,3. */
  initialLambdaQuarter?: 4 | 6 | 8 | 9 | 12;
  locale?: 'en' | 'es';
  labels?: Partial<ReferenceChoiceLabels>;
  className?: string;
}
/** All score arithmetic uses integer quarter/eighth units, without tie tolerance. */
export interface ReferenceChoiceResult {
  rows: { finalCredits: number; change: number; scoreQuarters: number; contributionEighths: number; denominator: 1 | 2 }[];
  safeScoreEighths: number;
  riskyScoreEighths: number;
  differenceEighths: number;
}
const references = [80, 90, 100, 130] as const;
const coefficients = [4, 6, 8, 9, 12] as const;
const defaults: Record<'en' | 'es', ReferenceChoiceLabels> = {
  en: {
    scenario: 'Final-outcome menu', reference: 'Reference R', coefficient: 'Loss coefficient λ',
    rule: 'Fixed rule: v(x) = x for gains or zero, and λx for losses. The risky outcomes each have probability one half. Both alternatives use the same reference.',
    scales: 'Fixed scales: change from −50 to +50 credits; valuation score from −150 to +50. Points are outcome scores, not observed feelings or choice probabilities.',
    changeAxis: 'Final credits minus reference R', scoreAxis: 'Valuation score', certain: 'Certain alternative', risky: 'Risky alternative', low: 'Risky: lower outcome', high: 'Risky: higher outcome',
    outcome: 'Outcome', probability: 'Probability', finalCredits: 'Final credits', change: 'Change from R', score: 'Score', contribution: 'Weighted score',
    table: 'Complete score calculation', calculation: 'Sum the two risky weighted scores to compare with the certain score. Credits and valuation-score units are different quantities.',
    safeScore: 'Certain score', riskyScore: 'Risky expected score', difference: 'Risky minus certain score',
    safePreferred: 'This declared score rule prefers the certain alternative.', riskyPreferred: 'This declared score rule prefers the risky alternative.', tie: 'This declared score rule is indifferent: the alternatives tie.',
  },
  es: {
    scenario: 'Menú de resultados finales', reference: 'Referencia R', coefficient: 'Coeficiente de pérdidas λ',
    rule: 'Regla fija: v(x) = x para ganancias o cero, y λx para pérdidas. Cada resultado arriesgado tiene probabilidad de un medio. Ambas alternativas usan la misma referencia.',
    scales: 'Escalas fijas: cambio de −50 a +50 créditos; puntuación de valoración de −150 a +50. Los puntos son puntuaciones de resultados, no sentimientos observados ni probabilidades de elección.',
    changeAxis: 'Créditos finales menos referencia R', scoreAxis: 'Puntuación de valoración', certain: 'Alternativa segura', risky: 'Alternativa arriesgada', low: 'Arriesgada: resultado menor', high: 'Arriesgada: resultado mayor',
    outcome: 'Resultado', probability: 'Probabilidad', finalCredits: 'Créditos finales', change: 'Cambio respecto a R', score: 'Puntuación', contribution: 'Puntuación ponderada',
    table: 'Cálculo completo de las puntuaciones', calculation: 'Suma las dos puntuaciones arriesgadas ponderadas para compararlas con la puntuación segura. Los créditos y las unidades de valoración son cantidades distintas.',
    safeScore: 'Puntuación de la alternativa segura', riskyScore: 'Puntuación esperada de la alternativa arriesgada', difference: 'Puntuación arriesgada menos segura',
    safePreferred: 'Esta regla de puntuación declarada prefiere la alternativa segura.', riskyPreferred: 'Esta regla de puntuación declarada prefiere la alternativa arriesgada.', tie: 'Esta regla de puntuación declarada es indiferente: las alternativas empatan.',
  },
};
function validateCase(item: ReferenceChoiceCase): void {
  if (!item || typeof item.label !== 'string' || !item.label.trim()) throw new Error('ReferenceChoiceAudit: each case needs a nonempty label.');
  if (![item.safe, item.low, item.high].every(x => Number.isSafeInteger(x) && x >= 80 && x <= 130) || !(item.low < item.safe && item.safe < item.high)) {
    throw new Error('ReferenceChoiceAudit: final amounts must be integers from 80 to 130, with low < safe < high.');
  }
}
/** Evaluate this restricted linear law exactly; final amounts are never recoded as score units. */
export function getReferenceChoiceResult(item: ReferenceChoiceCase, reference: number, lambdaQuarter: number): ReferenceChoiceResult {
  validateCase(item);
  if (!(references as readonly number[]).includes(reference) || !(coefficients as readonly number[]).includes(lambdaQuarter)) throw new Error('ReferenceChoiceAudit: unsupported reference or loss coefficient.');
  const rows = [item.safe, item.low, item.high].map((finalCredits, index) => {
    const change = finalCredits - reference, scoreQuarters = change * (change < 0 ? lambdaQuarter : 4), denominator = (index === 0 ? 1 : 2) as 1 | 2;
    return { finalCredits, change, scoreQuarters, contributionEighths: scoreQuarters * (denominator === 1 ? 2 : 1), denominator };
  });
  const safeScoreEighths = rows[0]!.contributionEighths;
  const riskyScoreEighths = rows[1]!.contributionEighths + rows[2]!.contributionEighths;
  return { rows, safeScoreEighths, riskyScoreEighths, differenceEighths: riskyScoreEighths - safeScoreEighths };
}
/** Compare both alternatives at a shared reference with exact ties and a fixed-scale curve. */
export function ReferenceChoiceAudit({ title, cases, initialCaseIndex = 0, initialReference = 100, initialLambdaQuarter = 8, locale = 'en', labels, className }: ReferenceChoiceAuditProps) {
  // Validate hidden authored cases and all parameters before hooks/SSR output.
  if (typeof title !== 'string' || !title.trim()) throw new Error('ReferenceChoiceAudit: title must be nonempty.');
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > 2) throw new Error('ReferenceChoiceAudit: author one or two cases.');
  for (const item of Array.from(cases)) validateCase(item);
  if (!Number.isSafeInteger(initialCaseIndex) || initialCaseIndex < 0 || initialCaseIndex >= cases.length) throw new Error('ReferenceChoiceAudit: invalid initial case.');
  getReferenceChoiceResult(cases[initialCaseIndex]!, initialReference, initialLambdaQuarter);
  if (locale !== 'en' && locale !== 'es') throw new Error('ReferenceChoiceAudit: locale must be en or es.');
  if (labels !== undefined && (!labels || typeof labels !== 'object' || Array.isArray(labels))) throw new Error('ReferenceChoiceAudit: labels must be an object.');
  for (const [key, value] of Object.entries(labels ?? {})) if (!Object.hasOwn(defaults.en, key) || typeof value !== 'string' || !value.trim()) throw new Error(`ReferenceChoiceAudit: invalid label ${key}.`);
  const id = useId();
  const [caseIndex, setCaseIndex] = useState(initialCaseIndex);
  const [reference, setReference] = useState(initialReference);
  const [lambdaQuarter, setLambdaQuarter] = useState(initialLambdaQuarter);
  const item = cases[caseIndex]!, result = getReferenceChoiceResult(item, reference, lambdaQuarter), text = { ...defaults[locale], ...labels };
  const number = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 3, useGrouping: false });
  const signed = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 3, useGrouping: false, signDisplay: 'exceptZero' });
  const fmt = (x: number) => signed.format(x / 8);
  const sx = (x: number) => 24 + (x + 50) / 100 * 432;
  const sy = (y: number) => 24 + (50 - y) / 200 * 232;
  const path = `M ${sx(-50)},${sy(-50 * lambdaQuarter / 4)} L ${sx(0)},${sy(0)} L ${sx(50)},${sy(50)}`;
  const selectClass = 'mt-auto min-h-11 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-sm font-normal text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  const labelClass = 'flex min-w-0 flex-col gap-2 text-sm font-semibold';
  const cell = { padding: 'calc(var(--spacing) * 2) calc(var(--spacing) * 3)', verticalAlign: 'middle' as const };
  return (
    <figure className={cx('not-prose my-8 text-ink-900', className)} aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="mb-3 font-display text-lg font-semibold">{title}</figcaption>
      <p className="m-0 text-sm leading-relaxed text-ink-700">{text.rule}</p>
      <div className="my-5 grid gap-4 sm:grid-cols-3">
        <label className={labelClass} htmlFor={`${id}-case`}><span>{text.scenario}</span>
          <select id={`${id}-case`} className={selectClass} value={caseIndex} onChange={event => setCaseIndex(Number(event.currentTarget.value))}>{cases.map((entry, index) => <option key={index} value={index}>{entry.label}</option>)}</select>
        </label>
        <label className={labelClass} htmlFor={`${id}-reference`}><span>{text.reference}</span>
          <select id={`${id}-reference`} className={selectClass} value={reference} onChange={event => setReference(Number(event.currentTarget.value) as typeof reference)}>{references.map(value => <option key={value} value={value}>{number.format(value)}</option>)}</select>
        </label>
        <label className={labelClass} htmlFor={`${id}-lambda`}><span>{text.coefficient}</span>
          <select id={`${id}-lambda`} className={selectClass} value={lambdaQuarter} onChange={event => setLambdaQuarter(Number(event.currentTarget.value) as typeof lambdaQuarter)}>{coefficients.map(value => <option key={value} value={value}>{number.format(value / 4)}</option>)}</select>
        </label>
      </div>
      <p className="mb-2 text-sm leading-relaxed text-ink-700">{text.scales}</p>
      <div aria-hidden="true">
        <div className="flex justify-between gap-3 text-xs text-ink-600"><span>{text.scoreAxis}: −150 … +50</span><span>λ = {number.format(lambdaQuarter / 4)}</span></div>
        <div className="relative pl-12">
          <div className="absolute inset-y-0 left-0 w-10 font-mono text-xs tabular-nums text-ink-600">
            {[{value:50,top:24/280*100},{value:0,top:82/280*100},{value:-150,top:256/280*100}].map(tick => <span key={tick.value} className="absolute right-0 -translate-y-1/2" style={{top:`${tick.top}%`}}>{signed.format(tick.value)}</span>)}
          </div>
          <svg viewBox="0 0 480 280" className="block h-auto w-full">
          <line x1="24" y1={sy(0)} x2="456" y2={sy(0)} stroke="var(--color-ink-500)" />
          <line x1={sx(0)} y1="24" x2={sx(0)} y2="256" stroke="var(--color-ink-500)" />
          <path d={path} stroke="var(--color-brand-700)" strokeWidth="2" fill="none" />
          {result.rows.slice(1).map((row, index) => <circle key={index} cx={sx(row.change)} cy={sy(row.scoreQuarters / 4)} r="6" fill="var(--color-surface)" stroke="var(--color-brand-700)" strokeWidth="3" />)}
          <rect x={sx(result.rows[0]!.change) - 5} y={sy(result.rows[0]!.scoreQuarters / 4) - 5} width="10" height="10" fill="var(--color-ink-900)" />
        </svg>
        </div>
        <div className="ml-12 flex justify-between font-mono text-xs tabular-nums text-ink-600" style={{paddingInline:"5%"}}><span>−50</span><span>0</span><span>+50</span></div>
        <p className="mt-1 ml-12 text-center text-xs text-ink-600">{text.changeAxis}</p>
      </div>
      <div className="my-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-700">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-2.5 bg-ink-900" />{text.certain}</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-full border-2 border-brand-700 bg-surface" />{text.risky}</span>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-ink-700">{text.calculation}</p>
      <div role="region" aria-label={text.table} tabIndex={0} className="max-w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700">
        <table className="w-full border-collapse text-sm" style={{ margin: 0, boxShadow: 'none', borderRadius: 0, display: 'table', overflow: 'visible' }}>
          <caption className="mb-2 text-left text-sm font-semibold">{text.table}</caption>
          <thead><tr className="border-b border-ink-300">{[text.outcome,text.probability,text.finalCredits,text.change,text.score,text.contribution].map((label,index) => <th key={index} scope="col" style={{...cell,textAlign:index===0?'left':'right'}}>{label}</th>)}</tr></thead>
          <tbody>{result.rows.map((row,index) => <tr key={index} className="border-b border-ink-200">
            <th scope="row" style={{...cell,textAlign:'left'}}>{[text.certain,text.low,text.high][index]}</th>
            {[row.denominator===1?'1':'1/2',number.format(row.finalCredits),signed.format(row.change),signed.format(row.scoreQuarters/4),fmt(row.contributionEighths)].map((value,j) => <td key={j} style={{...cell,textAlign:'right'}} className="font-mono tabular-nums">{value}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className="mt-5 border-l-2 border-ink-900 pl-4 text-sm leading-relaxed">
        <p className="m-0">{text.safeScore}: <strong className="font-mono">{fmt(result.safeScoreEighths)}</strong>. {text.riskyScore}: <strong className="font-mono">{fmt(result.riskyScoreEighths)}</strong>.</p>
        <p className="my-1">{text.difference}: <strong className="font-mono">{fmt(result.differenceEighths)}</strong>.</p>
        <p className="m-0">{result.differenceEighths===0?text.tie:result.differenceEighths>0?text.riskyPreferred:text.safePreferred}</p>
      </div>
    </figure>
  );
}
export default ReferenceChoiceAudit;
