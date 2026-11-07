import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MarketBuyer {
  id: string;
  label: string;
  /** Maximum willingness and ability to pay for one identical unit. */
  value: number;
}
export interface MarketSeller {
  id: string;
  label: string;
  /** Minimum acceptable receipt for one unit, including opportunity cost. */
  cost: number;
}
export interface MarketEligibilityLabels {
  price: string;
  buyers: string;
  sellers: string;
  buyerThreshold: string;
  sellerThreshold: string;
  willing: string;
  unwilling: string;
  buyerCount: string;
  sellerCount: string;
  maximum: string;
  boundHint: string;
  priceMarker: string;
  reservationBar: string;
}
export interface MarketEligibilityProps {
  title: string;
  instructions: string;
  caption: string;
  buyers: MarketBuyer[];
  sellers: MarketSeller[];
  /** Increasing comparison prices, none equal to any reservation threshold. */
  prices: number[];
  initialPrice: number;
  /** Unit or abbreviation shown after each reservation/price, such as "cr". */
  valueUnit: string;
  locale?: 'en' | 'es';
  labels: MarketEligibilityLabels;
  className?: string;
}

function validateParticipants(buyers: MarketBuyer[], sellers: MarketSeller[]) {
  for (const [name, people, key] of [['buyers', buyers, 'value'], ['sellers', sellers, 'cost']] as const) {
    if (!Array.isArray(people) || !people.length) throw new Error(`MarketEligibility ${name} must not be empty`);
    const ids = new Set<string>();
    for (const person of people) {
      if (!person || typeof person.id !== 'string' || !person.id.trim() || ids.has(person.id)) throw new Error(`MarketEligibility ${name} needs unique nonempty ids`);
      ids.add(person.id);
      if (typeof person.label !== 'string' || !person.label.trim()) throw new Error(`MarketEligibility ${name} needs nonempty labels`);
      const threshold = key === 'value' ? (person as MarketBuyer).value : (person as MarketSeller).cost;
      if (!Number.isFinite(threshold) || threshold < 0) throw new Error(`MarketEligibility ${name} ${key} must be finite and nonnegative`);
    }
  }
}

/** A bound on matching size; this function never selects or executes trades. */
export function marketEligibilityAtPrice(buyers: MarketBuyer[], sellers: MarketSeller[], price: number) {
  validateParticipants(buyers, sellers);
  if (!Number.isFinite(price) || price < 0) throw new Error('MarketEligibility price must be finite and nonnegative');
  if (buyers.some(b => b.value === price) || sellers.some(s => s.cost === price)) throw new Error('MarketEligibility price equals a reservation threshold; choose a comparison price without indifference');
  const willingBuyers = buyers.filter(b => b.value > price);
  const willingSellers = sellers.filter(s => s.cost < price);
  return { buyerIds: willingBuyers.map(b => b.id), sellerIds: willingSellers.map(s => s.id), maximum: Math.min(willingBuyers.length, willingSellers.length) };
}

/** Inspect finite reservation thresholds without inventing curves or sales. */
export function MarketEligibility({ title, instructions, caption, buyers, sellers, prices, initialPrice, valueUnit, locale = 'en', labels, className }: MarketEligibilityProps) {
  validateParticipants(buyers, sellers);
  if ([title, instructions, caption].some(text => typeof text !== 'string' || !text.trim())) throw new Error('MarketEligibility title, instructions and caption must be nonempty');
  if (!Array.isArray(prices) || !prices.length || prices.some((p, i) => !Number.isFinite(p) || p < 0 || (i > 0 && p <= prices[i - 1]))) throw new Error('MarketEligibility prices must be finite, nonnegative and strictly increasing');
  if (!prices.includes(initialPrice)) throw new Error('MarketEligibility initialPrice must occur in prices');
  for (const price of prices) marketEligibilityAtPrice(buyers, sellers, price);
  if (locale !== 'en' && locale !== 'es') throw new Error('MarketEligibility locale must be en or es');
  const labelKeys: (keyof MarketEligibilityLabels)[] = ['price','buyers','sellers','buyerThreshold','sellerThreshold','willing','unwilling','buyerCount','sellerCount','maximum','boundHint','priceMarker','reservationBar'];
  if (!labels || labelKeys.some(k => typeof labels[k] !== 'string' || !labels[k].trim())) throw new Error('MarketEligibility labels must supply all nonempty UI strings');
  if (typeof valueUnit !== 'string' || !valueUnit.trim()) throw new Error('MarketEligibility valueUnit must be nonempty');
  const id = useId();
  const [price, setPrice] = useState(initialPrice);
  const result = marketEligibilityAtPrice(buyers, sellers, price);
  const formatter = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumSignificantDigits: 21 });
  const format = (n: number) => `${formatter.format(n)} ${valueUnit.trim()}`;
  const domain = Math.max(...prices, ...buyers.map(b => b.value), ...sellers.map(s => s.cost), 1);
  const groups = [
    { id: 'buyers', title: labels.buyers, threshold: labels.buyerThreshold, rows: buyers.map(b => ({id:b.id,label:b.label,reservation:b.value,willing:result.buyerIds.includes(b.id)})) },
    { id: 'sellers', title: labels.sellers, threshold: labels.sellerThreshold, rows: sellers.map(s => ({id:s.id,label:s.label,reservation:s.cost,willing:result.sellerIds.includes(s.id)})) },
  ];
  return <figure className={cx('not-prose brutal my-6 bg-surface p-5 sm:p-6', className)} aria-labelledby={`${id}-title`}>
    <p id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</p>
    <p className="mt-2 text-sm text-ink-700">{instructions}</p>
    <label className="mt-4 grid min-w-0 gap-1 text-sm font-semibold text-ink-800" htmlFor={`${id}-price`}>
      {labels.price}
      <select id={`${id}-price`} value={price} onChange={e => setPrice(Number(e.target.value))} className="min-h-11 min-w-0 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
        {prices.map(p => <option key={p} value={p}>{format(p)}</option>)}
      </select>
    </label>
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-700">
      <span className="inline-flex items-center gap-2"><span aria-hidden className="h-4 w-0.5 bg-ink-800" />{labels.priceMarker}</span>
      <span className="inline-flex items-center gap-2"><span aria-hidden className="h-2 w-5 bg-brand-500" />{labels.reservationBar}</span>
    </div>
    <div className="mt-4 grid gap-6 sm:grid-cols-2">
      {groups.map(group => <section key={group.id} aria-label={group.title} className="min-w-0">
        <p className="font-display font-semibold text-ink-900">{group.title}</p>
        <p className="mt-1 text-xs text-ink-600">{group.threshold}</p>
        <ul className="mt-3 list-none space-y-4 p-0">
          {group.rows.map(person => <li key={person.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-sm">
              <span className="min-w-0 break-words font-semibold text-ink-900">{person.label} — {format(person.reservation)}</span>
              <span className={cx('text-xs', person.willing ? 'font-semibold text-brand-700' : 'text-ink-600')}>{person.willing ? labels.willing : labels.unwilling}</span>
            </div>
            <div aria-hidden className="relative mt-2 h-2 bg-surface-sunken">
              <div className={cx('h-2 transition-colors motion-reduce:transition-none', person.willing ? 'bg-brand-500' : 'bg-ink-300')} style={{width:`${(person.reservation/domain)*100}%`}} />
              <span className="absolute -top-1 h-4 w-0.5 bg-ink-800" style={{left:`calc(${(price/domain)*100}% - 1px)`}} />
            </div>
          </li>)}
        </ul>
      </section>)}
    </div>
    <div aria-live="polite" aria-atomic="true" className="mt-6">
      <dl className="grid gap-3 sm:grid-cols-3">
        {[[labels.buyerCount,result.buyerIds.length],[labels.sellerCount,result.sellerIds.length],[labels.maximum,result.maximum]].map(([label,value], index) => <div key={index} className="flex min-w-0 flex-col justify-between gap-2 bg-surface-sunken p-3">
          <dt className="text-xs font-semibold text-ink-600">{label}</dt><dd className="m-0 font-display text-xl font-semibold text-ink-900">{value}</dd>
        </div>)}
      </dl>
      <p className="mt-3 text-sm font-medium text-ink-800">{labels.boundHint}</p>
    </div>
    <figcaption className="mt-3 text-sm text-ink-600">{caption}</figcaption>
  </figure>;
}

export default MarketEligibility;
