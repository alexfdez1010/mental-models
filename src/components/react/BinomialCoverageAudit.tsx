import { useId, useState } from 'react';
import { rational, rationalText, rationalNumber, addRational, compareRational, validateRationalInput, requireText, type ExactRational, type RationalInput } from '@/components/react/SamplingCatalogue';

export type BinomialIntervalMethod = 'wald' | 'exact';
export type CoverageCaseId = 'iid4-quarter' | 'iid4-half' | 'iid4-three-quarters' | 'iid8-half' | 'two-bits-copied-four';
export interface BinomialInterval { readonly k: number; readonly n: number; readonly method: BinomialIntervalMethod }
const catalogue: Record<CoverageCaseId,{ n:number; truth:RationalInput; weights:number[]; denominator:number }> = {
  'iid4-quarter': {n:4,truth:{numerator:1,denominator:4},weights:[81,108,54,12,1],denominator:256},
  'iid4-half': {n:4,truth:{numerator:1,denominator:2},weights:[1,4,6,4,1],denominator:16},
  'iid4-three-quarters': {n:4,truth:{numerator:3,denominator:4},weights:[1,12,54,108,81],denominator:256},
  'iid8-half': {n:8,truth:{numerator:1,denominator:2},weights:[1,8,28,56,70,56,28,8,1],denominator:256},
  'two-bits-copied-four': {n:8,truth:{numerator:1,denominator:2},weights:[1,0,0,0,2,0,0,0,1],denominator:4},
};
// The audit exposes the closed model for inspection, never as mutable shared state.
for (const entry of Object.values(catalogue)) { Object.freeze(entry.truth); Object.freeze(entry.weights); Object.freeze(entry); }
Object.freeze(catalogue);
export const coverageCaseIds: readonly CoverageCaseId[] = Object.freeze(Object.keys(catalogue) as CoverageCaseId[]);
/** Construction deliberately has no truth argument. */
export function makeBinomialInterval(k: number, n: number, method: BinomialIntervalMethod): BinomialInterval {
  if (!Number.isSafeInteger(n) || n<1 || n>8 || !Number.isSafeInteger(k) || k<0 || k>n || (method!=='wald'&&method!=='exact')) throw new Error('Invalid bounded binomial interval specification.');
  return Object.freeze({ k,n,method });
}
function validateSpec(s: BinomialInterval) {
  if (!s || typeof s!=='object') throw new Error('An interval specification is required.');
  return makeBinomialInterval(s.k,s.n,s.method);
}
/** Exact binomial masses via a Bernoulli convolution, not floating-point endpoints. */
export function binomialMasses(n: number, truth: RationalInput): ExactRational[] {
  if (!Number.isSafeInteger(n)||n<1||n>8) throw new Error('Binomial n must be one through eight.');
  const p=validateRationalInput(truth,true), a=p.numerator, b=p.denominator;
  let weights=[1n];
  for(let i=0;i<n;i++) { const next=Array<bigint>(weights.length+1).fill(0n); weights.forEach((w,k)=>{ next[k]+=w*(b-a); next[k+1]+=w*a; }); weights=next; }
  return weights.map(w=>rational(w,b**BigInt(n)));
}
function tails(k:number,n:number,p:RationalInput) {
  const masses=binomialMasses(n,p);
  return { lower:masses.slice(0,k+1).reduce(addRational,rational(0n)), upper:masses.slice(k).reduce(addRational,rational(0n)) };
}
/** Audit membership separately. The endpoints used for drawing are never consulted. */
export function intervalContains(spec: BinomialInterval, truth: RationalInput): boolean {
  const s=validateSpec(spec), p=validateRationalInput(truth,true);
  if(s.method==='exact') { const t=tails(s.k,s.n,truth); return compareRational(t.lower,rational(1n,40n))>=0&&compareRational(t.upper,rational(1n,40n))>=0; }
  const n=BigInt(s.n), k=BigInt(s.k), a=p.numerator, b=p.denominator, d=k*b-a*n;
  // |p-k/n|² <= (49/25)² k(n-k)/n³; clipping cannot change membership for p in [0,1].
  return 625n*n*d*d <= 2401n*b*b*k*(n-k);
}
/** Outward four-decimal presentation bounds, using exact comparisons on the display grid. */
export function intervalOutwardGrid(spec: BinomialInterval): { lower:number; upper:number } {
  const s=validateSpec(spec), grid=10_000;
  const lowerSide=(j:number)=>{
    if(s.method==='exact') return compareRational(tails(s.k,s.n,{numerator:j,denominator:grid}).upper,rational(1n,40n))<=0;
    const n=BigInt(s.n),k=BigInt(s.k),d=k*10000n-BigInt(j)*n;
    return d>=0n&&625n*n*d*d>=2401n*10000n**2n*k*(n-k);
  };
  const upperSide=(j:number)=>{
    if(s.method==='exact') return compareRational(tails(s.k,s.n,{numerator:j,denominator:grid}).lower,rational(1n,40n))<=0;
    const n=BigInt(s.n),k=BigInt(s.k),d=BigInt(j)*n-k*10000n;
    return d>=0n&&625n*n*d*d>=2401n*10000n**2n*k*(n-k);
  };
  let lower=0,upper=grid;
  if(s.k!==0 && !intervalContains(s,{numerator:0,denominator:1})) { let lo=0,hi=grid; while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(lowerSide(mid))lo=mid;else hi=mid-1;} lower=lo; }
  if(s.k!==s.n && !intervalContains(s,{numerator:1,denominator:1})) { let lo=0,hi=grid;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(upperSide(mid))hi=mid;else lo=mid+1;}upper=lo; }
  return {lower,upper};
}
export function auditBinomialCoverage(id:CoverageCaseId,method:BinomialIntervalMethod) {
  if(!Object.hasOwn(catalogue,id)) throw new Error('Unknown coverage case.');
  const c=catalogue[id]; makeBinomialInterval(0,c.n,method);
  const rows=c.weights.map((w,k)=>{const interval=makeBinomialInterval(k,c.n,method);return {k,interval,probability:rational(BigInt(w),BigInt(c.denominator)),covers:intervalContains(interval,c.truth),...intervalOutwardGrid(interval)};});
  const coverage=rows.reduce((s,r)=>r.covers?addRational(s,r.probability):s,rational(0n));
  return {...c,rows,coverage};
}
export interface CoverageCaseLabel { id:CoverageCaseId; label:string; note:string }
export interface BinomialCoverageLabels {
  caseLabel:string; methodLabel:string; countLabel:string; waldLabel:string; exactLabel:string;
  chartLabel:string; chartDescription:string; xAxisLabel:string; countAxisLabel:string; tableLabel:string;
  countColumn:string; probabilityColumn:string; intervalColumn:string; coverageColumn:string;
  containsLabel:string; excludesLabel:string; truthLabel:string; nominalLabel:string; coverageLabel:string;
  boundsNote:string; selectionTemplate:string;
}
export interface BinomialCoverageAuditProps {
  title:string; instructions:string; cases:CoverageCaseLabel[]; labels:BinomialCoverageLabels;
  initialMethod?:BinomialIntervalMethod; locale?:'en'|'es'; className?:string;
}
const labelKeys:(keyof BinomialCoverageLabels)[]=['caseLabel','methodLabel','countLabel','waldLabel','exactLabel','chartLabel','chartDescription','xAxisLabel','countAxisLabel','tableLabel','countColumn','probabilityColumn','intervalColumn','coverageColumn','containsLabel','excludesLabel','truthLabel','nominalLabel','coverageLabel','boundsNote','selectionTemplate'];
export function validateBinomialCoverageAudit(p:BinomialCoverageAuditProps) {
  requireText(p.title,'title');requireText(p.instructions,'instructions');
  if(p.locale!==undefined&&p.locale!=='en'&&p.locale!=='es')throw new Error('Invalid locale.');
  if(p.initialMethod!==undefined&&p.initialMethod!=='wald'&&p.initialMethod!=='exact')throw new Error('Invalid initial method.');
  if(!Array.isArray(p.cases)||p.cases.length<1||p.cases.length>5)throw new Error('Expected one through five coverage cases.');
  const ids=new Set<string>();
  for(let i=0;i<p.cases.length;i++){const c=p.cases[i];if(!c||!Object.hasOwn(catalogue,c.id)||ids.has(c.id))throw new Error('Invalid or duplicate coverage case.');ids.add(c.id);requireText(c.label,'label');requireText(c.note,'note');}
  if(!p.labels)throw new Error('Coverage labels are required.');labelKeys.forEach(k=>requireText(p.labels[k],k));
  let t=p.labels.selectionTemplate;for(const token of ['count','interval','status','coverage']){const marker=`{${token}}`;if(t.split(marker).length!==2)throw new Error('Coverage template needs each token exactly once.');t=t.replace(marker,'');}if(/[{}]/.test(t))throw new Error('Unknown coverage token.');
}
export function BinomialCoverageAudit(props:BinomialCoverageAuditProps) {
  validateBinomialCoverageAudit(props);
  const id=useId(),[caseIndex,setCaseIndex]=useState(0),[method,setMethod]=useState<BinomialIntervalMethod>(props.initialMethod??'wald'),[k,setK]=useState(0);
  const entry=props.cases[caseIndex],a=auditBinomialCoverage(entry.id,method),r=a.rows[k],l=props.labels,locale=props.locale??'en';
  const decimal=(j:number)=>`${Math.floor(j/10000)}${locale==='es'?',':'.'}${String(j%10000).padStart(4,'0')}`;
  const bounds=(row:typeof r)=>`[${decimal(row.lower)}${locale==='es'?';':','} ${decimal(row.upper)}]`;
  const status=r.covers?l.containsLabel:l.excludesLabel;
  const values={count:String(k),interval:bounds(r),status,coverage:rationalText(a.coverage)};
  const result=l.selectionTemplate.replace(/\{(count|interval|status|coverage)\}/g,(_,key:keyof typeof values)=>values[key]);
  const h=90+32*a.n, y=(count:number)=>36+32*(a.n-count);
  return <section className={`not-prose my-8 rounded-card border border-ink-200 bg-surface p-4 sm:p-6 ${props.className??''}`} aria-labelledby={`${id}-title`} data-binomial-coverage="" data-case={entry.id} data-method={method} data-coverage={rationalText(a.coverage)}>
    <h3 id={`${id}-title`} className="m-0 font-display text-xl font-semibold text-ink-900">{props.title}</h3><p className="mt-2 text-sm leading-relaxed text-ink-700">{props.instructions}</p>
    <div className="my-4 flex flex-wrap items-end gap-4">
      {props.cases.length>1&&<label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">{l.caseLabel}<select className="max-w-full rounded-lg border border-ink-300 bg-surface px-3 py-2 font-normal" value={caseIndex} onChange={e=>{setCaseIndex(Number(e.target.value));setK(0);}}>{props.cases.map((c,i)=><option key={c.id} value={i}>{c.label}</option>)}</select></label>}
      <label className="flex flex-col gap-1 text-sm font-semibold">{l.methodLabel}<select className="rounded-lg border border-ink-300 bg-surface px-3 py-2 font-normal" value={method} onChange={e=>setMethod(e.target.value as BinomialIntervalMethod)}><option value="wald">{l.waldLabel}</option><option value="exact">{l.exactLabel}</option></select></label>
      <label className="flex flex-col gap-1 text-sm font-semibold">{l.countLabel}<select className="rounded-lg border border-ink-300 bg-surface px-3 py-2 font-normal" value={k} onChange={e=>setK(Number(e.target.value))}>{a.rows.filter(v=>v.probability.numerator>0n).map(v=><option key={v.k} value={v.k}>{v.k}</option>)}</select></label>
    </div><p className="my-3 text-sm leading-relaxed text-ink-700">{entry.note}</p>
    <dl className="my-4 grid grid-cols-3 gap-2">{[[l.truthLabel,rationalText(validateRationalInput(a.truth,true))],[l.nominalLabel,'19/20'],[l.coverageLabel,rationalText(a.coverage)]].map(([label,value])=><div key={label} className="rounded-lg bg-surface-sunken p-3"><dt className="text-xs text-ink-600">{label}</dt><dd className="m-0 mt-1 font-mono text-sm">{value}</dd></div>)}</dl>
    <div tabIndex={0} role="region" aria-label={l.chartLabel} className="overflow-x-auto rounded-lg border border-ink-200 focus-visible:outline-2 focus-visible:outline-brand-500"><svg viewBox={`0 0 640 ${h}`} className="block w-full min-w-[32rem]" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-desc`}><title id={`${id}-chart-title`}>{l.chartLabel}</title><desc id={`${id}-chart-desc`}>{l.chartDescription}</desc>
      <text x="20" y="18" fontSize="12" fill="var(--color-ink-900)">{l.countAxisLabel}</text><line data-truth="" x1={70+520*rationalNumber(validateRationalInput(a.truth,true))} x2={70+520*rationalNumber(validateRationalInput(a.truth,true))} y1="22" y2={h-50} stroke="var(--color-ink-700)" strokeDasharray="4 4"/>
      {a.rows.map(row=><g key={row.k} data-count={row.k} data-lower={row.lower} data-upper={row.upper} data-covers={String(row.covers)}><text x="48" y={y(row.k)+4} textAnchor="end" fontSize="12" fill="var(--color-ink-700)">{row.k}</text><line x1={70+520*row.lower/10000} x2={70+520*row.upper/10000} y1={y(row.k)} y2={y(row.k)} stroke={row.covers?'var(--color-brand-600)':'var(--color-ink-500)'} strokeWidth={row.k===k?5:2} opacity={row.probability.numerator===0n?0.3:1}/>{[row.lower,row.upper].map((v,i)=><circle key={i} cx={70+520*v/10000} cy={y(row.k)} r={row.k===k?4:3} fill={row.covers?'var(--color-brand-600)':'var(--color-ink-500)'}/>)}</g>)}
      <line x1="70" x2="590" y1={h-45} y2={h-45} stroke="var(--color-ink-400)"/>{[0,2500,5000,7500,10000].map(v=><text key={v} x={70+520*v/10000} y={h-27} textAnchor="middle" fontSize="12" fill="var(--color-ink-700)">{decimal(v)}</text>)}<text x="330" y={h-7} textAnchor="middle" fontSize="13" fill="var(--color-ink-900)">{l.xAxisLabel}</text>
    </svg></div>
    <p className="my-3 text-xs leading-relaxed text-ink-600">{l.boundsNote}</p><p role="status" aria-live="polite" aria-atomic="true" className="my-4 rounded-lg bg-brand-50 p-3 text-sm text-ink-900" data-selected-count={k}>{result}</p>
    <div tabIndex={0} role="region" aria-label={l.tableLabel} className="overflow-x-auto rounded-lg border border-ink-200 focus-visible:outline-2 focus-visible:outline-brand-500"><table className="w-full min-w-[36rem] border-collapse text-left text-sm" style={{ display: 'table', overflow: 'visible', margin: 0 }}><caption className="p-3 text-left font-semibold">{l.tableLabel}</caption><thead><tr>{[l.countColumn,l.probabilityColumn,l.intervalColumn,l.coverageColumn].map(t=><th key={t} className="border-b border-ink-200 p-3 font-semibold">{t}</th>)}</tr></thead><tbody>{a.rows.map(row=><tr key={row.k} className={row.k===k?'bg-brand-50':''} style={row.k===k?{backgroundColor:'var(--color-brand-50)'}:undefined}><th scope="row" className="border-b border-ink-100 p-3 font-mono font-normal">{row.k}</th><td className="border-b border-ink-100 p-3 font-mono">{rationalText(row.probability)}</td><td className="border-b border-ink-100 p-3 font-mono">{bounds(row)}</td><td className="border-b border-ink-100 p-3">{row.covers?l.containsLabel:l.excludesLabel}</td></tr>)}</tbody></table></div>
  </section>;
}
