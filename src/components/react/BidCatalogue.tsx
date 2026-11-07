import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Fixed payment rule for our bidder; losing and abstaining pay nothing. */
export type BidPaymentRule = 'first-price' | 'second-price';

/** One hypothetical state conditional on the information available before bidding. */
export interface BidCatalogueState {
  /** Author-supplied state name. */
  label: string;
  /** Common gross value in non-negative, safe integer units. */
  value: number;
  /** Fixed rival bid in the same units. */
  rivalBid: number;
  /** Positive safe integer relative probability weight, not a sample count. */
  weight: number;
}

/** Exact weighted sum over a strictly positive denominator. */
export interface BidFraction { numerator: number; denominator: number }

/** Our outcome in one state, after allocation, payment and winning-only cost. */
export interface BidCatalogueRow extends BidCatalogueState {
  awarded: boolean;
  payment: number;
  cost: number;
  profit: number;
}

/** Conditional means are null when no state awards the lot to us. */
export interface BidCatalogueResult {
  bid: number;
  rows: BidCatalogueRow[];
  winProbability: BidFraction;
  priorValue: BidFraction;
  conditionalValue: BidFraction | null;
  conditionalPayment: BidFraction | null;
  conditionalProfit: BidFraction | null;
  overallProfit: BidFraction;
}

/** All built-in control, table, result and chart copy can be overridden. */
export interface BidCatalogueLabels {
  bid: string;
  abstain: string;
  firstPrice: string;
  secondPrice: string;
  cost: string;
  costColumn: string;
  tableUnits: string;
  state: string;
  weight: string;
  value: string;
  rival: string;
  allocation: string;
  awarded: string;
  notAwarded: string;
  lostTie: string;
  payment: string;
  profit: string;
  priorValue: string;
  winProbability: string;
  conditionalValue: string;
  conditionalPayment: string;
  conditionalProfit: string;
  overallProfit: string;
  notApplicable: string;
  chart: string;
  selected: string;
}

/** A finite candidate comparison, with a fixed rival rule and format per island. */
export interface BidCatalogueProps {
  /** Complete authored conditional catalogue; actual state is unknown when bidding. */
  states: BidCatalogueState[];
  /** Distinct non-negative safe integer bids; include zero for abstention. */
  bids: number[];
  paymentRule: BidPaymentRule;
  /** Additional non-negative safe integer burden incurred only when awarded. */
  winningCost?: number;
  /** Initially selected candidate, which must occur in bids. Defaults to the first. */
  initialBid?: number;
  /** Shared positive bound for both sides of the profit chart; must not clip any candidate. */
  profitLimit?: number;
  locale?: 'en' | 'es';
  unit?: string;
  title?: string;
  instructions?: string;
  caption?: string;
  labels?: Partial<BidCatalogueLabels>;
  className?: string;
}

const COPY: Record<'en' | 'es', BidCatalogueLabels> = {
  en: { bid: 'Our candidate bid', abstain: 'Abstain', firstPrice: 'First price: pay our bid if awarded', secondPrice: 'Second price: pay the rival bid if awarded', cost: 'Additional cost only if awarded', costColumn: 'Cost', tableUnits: 'Value, bids, payment, cost and profit are in', state: 'State', weight: 'Probability weight', value: 'Gross value', rival: 'Rival bid', allocation: 'Our allocation', awarded: 'Awarded', notAwarded: 'Not awarded', lostTie: 'Not awarded: lost tie', payment: 'Payment', profit: 'Net profit', priorValue: 'Mean gross value before selection', winProbability: 'Probability of an award', conditionalValue: 'Mean gross value if awarded', conditionalPayment: 'Mean payment if awarded', conditionalProfit: 'Mean net profit if awarded', overallProfit: 'Expected net profit per opportunity', notApplicable: '— no winning states', chart: 'Expected net profit of every candidate', selected: 'Selected' },
  es: { bid: 'Nuestra puja candidata', abstain: 'Abstenerse', firstPrice: 'Primer precio: pagamos nuestra puja si se nos adjudica', secondPrice: 'Segundo precio: pagamos la puja rival si se nos adjudica', cost: 'Coste adicional solo si se nos adjudica', costColumn: 'Coste', tableUnits: 'Valor, pujas, pago, coste y beneficio se expresan en', state: 'Caso', weight: 'Peso de probabilidad', value: 'Valor bruto', rival: 'Puja rival', allocation: 'Nuestra adjudicación', awarded: 'Adjudicado', notAwarded: 'No adjudicado', lostTie: 'No adjudicado: empate perdido', payment: 'Pago', profit: 'Beneficio neto', priorValue: 'Valor bruto medio antes de seleccionar', winProbability: 'Probabilidad de adjudicación', conditionalValue: 'Valor bruto medio si se nos adjudica', conditionalPayment: 'Pago medio si se nos adjudica', conditionalProfit: 'Beneficio neto medio si se nos adjudica', overallProfit: 'Beneficio neto esperado por oportunidad', notApplicable: '— sin casos adjudicados', chart: 'Beneficio neto esperado de cada candidato', selected: 'Seleccionada' },
};

const nonNegativeInteger = (n: number) => Number.isSafeInteger(n) && n >= 0;
function safe(n: number): number {
  if (!Number.isSafeInteger(n)) throw new Error('BidCatalogue: weighted arithmetic exceeds safe integer units. Rescale the authored data.');
  return n;
}

/**
 * Evaluate one bid in an authored catalogue. Zero always abstains; positive bids
 * win only when strictly above the rival, so we lose ties. This is an accounting
 * calculation for a fixed rival, not an equilibrium or continuous optimization.
 * Integer inputs retain exact numerators; no-award conditional means stay null.
 */
export function evaluateBidCatalogue(states: BidCatalogueState[], bid: number, paymentRule: BidPaymentRule, winningCost = 0): BidCatalogueResult {
  if (!Array.isArray(states) || !states.length) throw new Error('BidCatalogue: states must be a non-empty catalogue.');
  if (!nonNegativeInteger(bid) || !nonNegativeInteger(winningCost)) throw new Error('BidCatalogue: bid and winningCost must be non-negative safe integers.');
  if (!['first-price', 'second-price'].includes(paymentRule)) throw new Error('BidCatalogue: paymentRule must be first-price or second-price.');
  let totalWeight = 0, prior = 0, winWeight = 0, valueSum = 0, paymentSum = 0, profitSum = 0;
  const rows = Array.from(states).map((state, index) => {
    if (!state || typeof state.label !== 'string' || !state.label.trim() || !nonNegativeInteger(state.value) || !nonNegativeInteger(state.rivalBid) || !Number.isSafeInteger(state.weight) || state.weight <= 0) {
      throw new Error(`BidCatalogue: state ${index} needs a non-empty label, non-negative safe integer value/rivalBid and positive safe integer weight.`);
    }
    totalWeight = safe(totalWeight + state.weight);
    prior = safe(prior + safe(state.weight * state.value));
    const awarded = bid !== 0 && bid > state.rivalBid;
    const payment = awarded ? (paymentRule === 'first-price' ? bid : state.rivalBid) : 0;
    const cost = awarded ? winningCost : 0;
    const profit = awarded ? safe(state.value - payment - cost) : 0;
    profitSum = safe(profitSum + safe(state.weight * profit));
    if (awarded) {
      winWeight = safe(winWeight + state.weight);
      valueSum = safe(valueSum + safe(state.weight * state.value));
      paymentSum = safe(paymentSum + safe(state.weight * payment));
    }
    return { ...state, awarded, payment, cost, profit };
  });
  return { bid, rows, winProbability: { numerator: winWeight, denominator: totalWeight }, priorValue: { numerator: prior, denominator: totalWeight }, conditionalValue: winWeight ? { numerator: valueSum, denominator: winWeight } : null, conditionalPayment: winWeight ? { numerator: paymentSum, denominator: winWeight } : null, conditionalProfit: winWeight ? { numerator: profitSum, denominator: winWeight } : null, overallProfit: { numerator: profitSum, denominator: totalWeight } };
}

function gcd(a: number, b: number): number { while (b) [a, b] = [b, a % b]; return a; }

/** Deterministic filtering, exact conditional accounting and a finite-menu chart. */
export function BidCatalogue({ states, bids, paymentRule, winningCost = 0, initialBid, profitLimit, locale = 'en', unit, title, instructions, caption, labels, className }: BidCatalogueProps) {
  if (!['en', 'es'].includes(locale)) throw new Error('BidCatalogue: locale must be en or es.');
  if (labels && Object.values(labels).some(label => typeof label !== 'string' || !label.trim())) throw new Error('BidCatalogue: label overrides must be non-empty strings.');
  if (!Array.isArray(bids) || bids.length < 2 || !bids.includes(0) || Array.from(bids).some(b => !nonNegativeInteger(b)) || new Set(bids).size !== bids.length) throw new Error('BidCatalogue: bids need at least two distinct non-negative safe integers, including zero for abstention.');
  const initial = initialBid ?? bids[0];
  if (!bids.includes(initial)) throw new Error('BidCatalogue: initialBid must occur in bids.');
  const candidates = bids.map(bid => evaluateBidCatalogue(states, bid, paymentRule, winningCost));
  const maxAbs = Math.max(1, ...candidates.map(c => Math.abs(c.overallProfit.numerator / c.overallProfit.denominator)));
  if (profitLimit !== undefined && (!Number.isFinite(profitLimit) || profitLimit <= 0 || profitLimit < maxAbs)) throw new Error('BidCatalogue: profitLimit must be positive and include every candidate expected profit.');
  if (unit !== undefined && (typeof unit !== 'string' || !unit.trim())) throw new Error('BidCatalogue: unit must be a non-empty string when provided.');
  const [selectedBid, setSelectedBid] = useState(initial);
  const id = useId();
  const copy = { ...COPY[locale], ...labels };
  const suffix = unit ?? (locale === 'es' ? 'créditos' : 'credits');
  const num = (n: number) => n.toLocaleString(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 2 });
  const amount = (n: number) => `${num(n)} ${suffix}`;
  const fraction = (v: BidFraction, units = true, approximate = true) => {
    const divisor = gcd(Math.abs(v.numerator), v.denominator), a = v.numerator / divisor, b = v.denominator / divisor;
    const exact = b === 1 ? num(a) : `${num(a)}/${num(b)}`;
    return `${exact}${b !== 1 && approximate ? ` (≈ ${num(a / b)})` : ''}${units ? ` ${suffix}` : ''}`;
  };
  const active = candidates.find(c => c.bid === selectedBid) ?? candidates[0];
  const limit = profitLimit ?? maxAbs;
  const bidText = (bid: number) => bid === 0 ? copy.abstain : amount(bid);
  const metrics: Array<[string, BidFraction | null, boolean]> = [[copy.priorValue, active.priorValue, true], [copy.winProbability, active.winProbability, false], [copy.conditionalValue, active.conditionalValue, true], [copy.conditionalPayment, active.conditionalPayment, true], [copy.conditionalProfit, active.conditionalProfit, true], [copy.overallProfit, active.overallProfit, true]];
  return (
    <figure className={cx('not-prose brutal my-6 bg-surface p-5 sm:p-6', className)} aria-labelledby={title ? `${id}-title` : undefined}>
      {title ? <p id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</p> : null}
      {instructions ? <p className="mt-2 text-sm text-ink-700">{instructions}</p> : null}
      <p className="mt-3 text-sm font-semibold text-ink-900">{paymentRule === 'first-price' ? copy.firstPrice : copy.secondPrice}</p>
      <p className="mt-1 text-sm text-ink-700">{copy.cost}: {amount(winningCost)}</p>
      <label htmlFor={`${id}-bid`} className="mt-4 block text-sm font-semibold text-ink-800">{copy.bid}</label>
      <select id={`${id}-bid`} value={active.bid} onChange={e => setSelectedBid(Number(e.target.value))} aria-controls={`${id}-result`} className="mt-1 max-w-full rounded-card border-2 border-ink-500 bg-surface px-3 py-2 text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
        {bids.map(b => <option key={b} value={b}>{bidText(b)}</option>)}
      </select>
      <div id={`${id}-result`} aria-live="polite" aria-atomic="true">
        <p className="mt-4 text-xs text-ink-600">{copy.tableUnits} {suffix}.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr>{[copy.state, copy.weight, copy.value, copy.rival, copy.allocation, copy.payment, copy.costColumn, copy.profit].map((heading, i) => <th key={i} scope="col" className="px-2 py-2 font-semibold text-ink-700">{heading}</th>)}</tr></thead>
            <tbody>{active.rows.map((row, i) => <tr key={i} className={cx(row.awarded ? 'bg-brand-50' : 'bg-surface')}>
              <th scope="row" className="px-2 py-3 font-medium text-ink-900">{row.label}</th>
              <td className="px-2 py-3 font-mono">{fraction({ numerator: row.weight, denominator: active.winProbability.denominator }, false, false)}</td>
              <td className="px-2 py-3 font-mono">{num(row.value)}</td><td className="px-2 py-3 font-mono">{num(row.rivalBid)}</td>
              <td className="px-2 py-3 font-medium">{row.awarded ? copy.awarded : active.bid !== 0 && active.bid === row.rivalBid ? copy.lostTie : copy.notAwarded}</td>
              <td className="px-2 py-3 font-mono">{num(row.payment)}</td><td className="px-2 py-3 font-mono">{num(row.cost)}</td><td className="px-2 py-3 font-mono">{num(row.profit)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{metrics.map(([label, value, units]) => <div key={label}><dt className="text-ink-600">{label}</dt><dd className="mt-1 font-mono font-semibold text-ink-900">{value ? fraction(value, units, units) : copy.notApplicable}</dd></div>)}</dl>
      </div>
      <p className="mt-6 font-semibold text-ink-900">{copy.chart}</p>
      <div className="mt-2 grid grid-cols-3 text-xs font-mono text-ink-600" aria-hidden="true"><span>−{amount(limit)}</span><span className="text-center">0</span><span className="text-right">+{amount(limit)}</span></div>
      <ul className="mt-2 space-y-4">{candidates.map(candidate => {
        const expected = candidate.overallProfit.numerator / candidate.overallProfit.denominator;
        return <li key={candidate.bid}>
          <div className="flex flex-wrap justify-between gap-x-3 text-sm"><span className={cx(candidate.bid === active.bid && 'font-semibold')}>{bidText(candidate.bid)}{candidate.bid === active.bid ? ` — ${copy.selected}` : ''}</span><span className="font-mono">{fraction(candidate.overallProfit)}</span></div>
          <div aria-hidden="true" className="mt-1 flex h-2 bg-surface-sunken"><div className="relative w-1/2 border-r border-ink-500"><div className="absolute inset-0 origin-right bg-danger transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleX(${expected < 0 ? -expected / limit : 0})` }} /></div><div className="relative w-1/2"><div className="absolute inset-0 origin-left bg-brand-600 transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleX(${expected > 0 ? expected / limit : 0})` }} /></div></div>
        </li>;
      })}</ul>
      {caption ? <figcaption className="mt-4 text-sm text-ink-600">{caption}</figcaption> : null}
    </figure>
  );
}

export default BidCatalogue;
