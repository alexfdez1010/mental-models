import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** The bounded menu used by both independent randomisation controls. */
export const MIXED_AUDIT_PERCENTAGES = [0, 25, 40, 50, 75, 100] as const;
export type MixedAuditPercent = (typeof MIXED_AUDIT_PERCENTAGES)[number];
/** Row utility in each cell; column utility is its negative, by definition. */
export type MixedAuditMatrix = [[number, number], [number, number]];

/** Localisable interface text; authored player and action names are separate props. */
export interface MixedStrategyAuditLabels {
  instructions: string;
  probabilityTemplate: string;
  jointTitle: string;
  jointRegion: string;
  outcome: string;
  cellUtilities: string;
  probability: string;
  rowContribution: string;
  columnContribution: string;
  chartTitle: string;
  chartLegend: string;
  utilityUnit: string;
  auditRegion: string;
  player: string;
  currentMean: string;
  pureAlternatives: string;
  bestPure: string;
  gain: string;
  tie: string;
  equilibrium: string;
  profitable: string;
  summaryTemplate: string;
}

/** A fixed zero-sum game, audited over two independent binary mixtures. */
export interface MixedStrategyAuditProps {
  title: string;
  rowPlayer: string;
  colPlayer: string;
  rowStrategies: [string, string];
  colStrategies: [string, string];
  /** Dense 2×2 integer matrix; each absolute utility must be at most 1000. */
  rowPayoffs: MixedAuditMatrix;
  initialRowPercent?: MixedAuditPercent;
  initialColumnPercent?: MixedAuditPercent;
  locale?: 'en' | 'es';
  labels?: Partial<MixedStrategyAuditLabels>;
  caption?: string;
  className?: string;
}

/** All numerators share the exact denominator 10000, including utility sums. */
export interface MixedStrategyAuditResult {
  denominator: 10000;
  jointNumerators: [number, number, number, number];
  rowContributionNumerators: [number, number, number, number];
  columnContributionNumerators: [number, number, number, number];
  rowMeanNumerator: number;
  columnMeanNumerator: number;
  rowPureNumerators: [number, number];
  columnPureNumerators: [number, number];
  bestRowIndices: number[];
  bestColumnIndices: number[];
  rowGainNumerator: number;
  columnGainNumerator: number;
}

const defaults: Record<'en' | 'es', MixedStrategyAuditLabels> = {
  en: {
    instructions: 'Each player chooses privately. The two random draws are independent; changing a selector changes a probability rule, not an observed action.',
    probabilityTemplate: '{player}: probability of {action}',
    jointTitle: 'Four possible action pairs',
    jointRegion: 'Joint probabilities and utility contributions',
    outcome: 'Row action / column action',
    cellUtilities: 'Cell utilities (row, column)',
    probability: 'Exact probability',
    rowContribution: 'Row utility contribution',
    columnContribution: 'Column utility contribution',
    chartTitle: 'Expected utility and best pure response',
    chartLegend: 'Filled bar: current expected utility. Marker: best pure-response utility against the other player’s fixed mixture.',
    utilityUnit: 'Utility points',
    auditRegion: 'Both players’ unilateral deviation audit',
    player: 'Player',
    currentMean: 'Current expected utility',
    pureAlternatives: 'Pure-response utilities',
    bestPure: 'Best pure response',
    gain: 'Unilateral deviation gain',
    tie: 'Tie',
    equilibrium: 'Both gains are zero: this independent profile is a Nash equilibrium of the stated game.',
    profitable: 'At least one gain is positive: this profile fails the Nash test.',
    summaryTemplate: '{verdict} {row}: expected utility {rowMean}, best pure utility {rowBest}, gain {rowGain}. {column}: expected utility {columnMean}, best pure utility {columnBest}, gain {columnGain}.',
  },
  es: {
    instructions: 'Cada jugador elige en privado. Los dos sorteos son independientes; cambiar un selector cambia una regla de probabilidad, no una acción observada.',
    probabilityTemplate: '{player}: probabilidad de {action}',
    jointTitle: 'Las cuatro parejas de acciones posibles',
    jointRegion: 'Probabilidades conjuntas y contribuciones a la utilidad',
    outcome: 'Acción de filas / acción de columnas',
    cellUtilities: 'Utilidades de la casilla (filas, columnas)',
    probability: 'Probabilidad exacta',
    rowContribution: 'Contribución a la utilidad de filas',
    columnContribution: 'Contribución a la utilidad de columnas',
    chartTitle: 'Utilidad esperada y mejor respuesta pura',
    chartLegend: 'Barra rellena: utilidad esperada actual. Marca: utilidad de la mejor respuesta pura ante la mezcla fija del otro jugador.',
    utilityUnit: 'Puntos de utilidad',
    auditRegion: 'Comprobación de los desvíos unilaterales de ambos jugadores',
    player: 'Jugador',
    currentMean: 'Utilidad esperada actual',
    pureAlternatives: 'Utilidades de las respuestas puras',
    bestPure: 'Mejor respuesta pura',
    gain: 'Mejora por desvío unilateral',
    tie: 'Empate',
    equilibrium: 'Ambas mejoras son cero: este perfil independiente es un equilibrio de Nash del juego declarado.',
    profitable: 'Al menos una mejora es positiva: este perfil no supera la prueba de Nash.',
    summaryTemplate: '{verdict} {row}: utilidad esperada {rowMean}, mejor utilidad pura {rowBest}, mejora {rowGain}. {column}: utilidad esperada {columnMean}, mejor utilidad pura {columnBest}, mejora {columnGain}.',
  },
};

const negate = (value: number): number => value === 0 ? 0 : -value;

function densePair(value: unknown): value is [unknown, unknown] {
  return Array.isArray(value) && value.length === 2 && Object.hasOwn(value, 0) && Object.hasOwn(value, 1);
}

function validateMatrix(matrix: MixedAuditMatrix): void {
  if (!densePair(matrix) || !matrix.every((row) => densePair(row) && row.every((value) => Number.isSafeInteger(value) && Math.abs(value as number) <= 1000))) {
    throw new Error('MixedStrategyAudit: rowPayoffs must be a dense 2×2 integer matrix with absolute utilities at most 1000.');
  }
}

function validatePercent(value: number): void {
  if (!MIXED_AUDIT_PERCENTAGES.some((candidate) => candidate === value)) {
    throw new Error('MixedStrategyAudit: probabilities must belong to the fixed percentage menu.');
  }
}

/** Exact audit; only safe integer products are used, never a near-equilibrium tolerance. */
export function auditMixedStrategy(matrix: MixedAuditMatrix, rowPercent: MixedAuditPercent, columnPercent: MixedAuditPercent): MixedStrategyAuditResult {
  validateMatrix(matrix);
  validatePercent(rowPercent);
  validatePercent(columnPercent);
  const p = rowPercent;
  const q = columnPercent;
  const jointNumerators: MixedStrategyAuditResult['jointNumerators'] = [p*q, p*(100-q), (100-p)*q, (100-p)*(100-q)];
  const values = [matrix[0][0], matrix[0][1], matrix[1][0], matrix[1][1]];
  const rowContributionNumerators = jointNumerators.map((weight, index) => weight * values[index]!) as MixedStrategyAuditResult['rowContributionNumerators'];
  const columnContributionNumerators = rowContributionNumerators.map(negate) as MixedStrategyAuditResult['columnContributionNumerators'];
  const rowMeanNumerator = rowContributionNumerators.reduce((sum, value) => sum + value, 0);
  const columnMeanNumerator = negate(rowMeanNumerator);
  const rowPureNumerators: [number, number] = [0, 1].map((r) => 100*(q*matrix[r]![0] + (100-q)*matrix[r]![1])) as [number, number];
  const columnPureNumerators: [number, number] = [0, 1].map((c) => negate(100*(p*matrix[0][c]! + (100-p)*matrix[1][c]!))) as [number, number];
  const rowBest = Math.max(...rowPureNumerators);
  const columnBest = Math.max(...columnPureNumerators);
  return {
    denominator: 10000, jointNumerators, rowContributionNumerators, columnContributionNumerators,
    rowMeanNumerator, columnMeanNumerator, rowPureNumerators, columnPureNumerators,
    bestRowIndices: [0, 1].filter((index) => rowPureNumerators[index] === rowBest),
    bestColumnIndices: [0, 1].filter((index) => columnPureNumerators[index] === columnBest),
    rowGainNumerator: rowBest - rowMeanNumerator,
    columnGainNumerator: columnBest - columnMeanNumerator,
  };
}

/** Reduced exact fraction for an integer numerator and positive integer denominator. */
export function mixedAuditFraction(numerator: number, denominator = 10000): string {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error('MixedStrategyAudit: an exact fraction needs safe integers and a positive denominator.');
  }
  let a = Math.abs(numerator);
  let b = denominator;
  while (b !== 0) [a, b] = [b, a % b];
  const divisor = a || 1;
  const n = numerator / divisor;
  const d = denominator / divisor;
  return d === 1 ? String(n) : `${n}/${d}`;
}

/**
 * Audit a read-only zero-sum 2×2 game over 36 independent mixture profiles.
 * Probability bars use a fixed zero-to-one scale; utility bars use the fixed
 * symmetric bound from the authored matrix. Tables retain exact fractions,
 * zero-probability cells and tied best responses. No sample or learning path is generated.
 */
export function MixedStrategyAudit({
  title, rowPlayer, colPlayer, rowStrategies, colStrategies, rowPayoffs,
  initialRowPercent = 25, initialColumnPercent = 75, locale = 'en', labels, caption, className,
}: MixedStrategyAuditProps) {
  // Author errors must fail even when an invalid datum is not initially selected.
  validateMatrix(rowPayoffs);
  validatePercent(initialRowPercent);
  validatePercent(initialColumnPercent);
  if (locale !== 'en' && locale !== 'es') throw new Error('MixedStrategyAudit: locale must be en or es.');
  for (const [key, value] of Object.entries({ title, rowPlayer, colPlayer })) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`MixedStrategyAudit: ${key} must be nonempty.`);
  }
  for (const [key, actions] of Object.entries({ rowStrategies, colStrategies })) {
    if (!densePair(actions) || !actions.every((action) => typeof action === 'string' && action.trim()) || actions[0] === actions[1]) {
      throw new Error(`MixedStrategyAudit: ${key} needs two distinct nonempty action labels.`);
    }
  }
  if (caption !== undefined && (typeof caption !== 'string' || !caption.trim())) throw new Error('MixedStrategyAudit: caption must be nonempty when provided.');
  if (labels !== undefined) {
    if (!labels || typeof labels !== 'object' || Array.isArray(labels) || ![Object.prototype, null].includes(Object.getPrototypeOf(labels))) {
      throw new Error('MixedStrategyAudit: labels must be a plain object without inherited overrides.');
    }
    for (const key of Reflect.ownKeys(labels)) {
      if (typeof key !== 'string' || !Object.hasOwn(defaults.en, key) || typeof labels[key as keyof MixedStrategyAuditLabels] !== 'string' || !labels[key as keyof MixedStrategyAuditLabels]?.trim()) {
        throw new Error('MixedStrategyAudit: every label override must have an own known key and nonempty string.');
      }
    }
  }
  const text = { ...defaults[locale], ...labels };
  const id = useId();
  const [p, setP] = useState<MixedAuditPercent>(initialRowPercent);
  const [q, setQ] = useState<MixedAuditPercent>(initialColumnPercent);
  const audit = auditMixedStrategy(rowPayoffs, p, q);
  const fraction = mixedAuditFraction;
  const percent = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { style: 'percent', maximumFractionDigits: 2 });
  const integer = new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US');
  const bound = Math.max(1, ...rowPayoffs.flat().map(Math.abs));
  const players = [
    { name: rowPlayer, actions: rowStrategies, mean: audit.rowMeanNumerator, pures: audit.rowPureNumerators, indices: audit.bestRowIndices, gain: audit.rowGainNumerator },
    { name: colPlayer, actions: colStrategies, mean: audit.columnMeanNumerator, pures: audit.columnPureNumerators, indices: audit.bestColumnIndices, gain: audit.columnGainNumerator },
  ];
  const verdict = audit.rowGainNumerator === 0 && audit.columnGainNumerator === 0 ? text.equilibrium : text.profitable;
  const replacements: Record<string, string> = {
    verdict, row: rowPlayer, column: colPlayer,
    rowMean: fraction(audit.rowMeanNumerator), columnMean: fraction(audit.columnMeanNumerator),
    rowBest: fraction(Math.max(...audit.rowPureNumerators)), columnBest: fraction(Math.max(...audit.columnPureNumerators)),
    rowGain: fraction(audit.rowGainNumerator), columnGain: fraction(audit.columnGainNumerator),
  };
  const summary = text.summaryTemplate.replace(/\{([A-Za-z]+)\}/g, (match, key: string) => replacements[key] ?? match);
  const tableStyle = { display: 'table', overflow: 'visible', width: '100%', maxWidth: 'none', margin: 0, boxShadow: 'none' } as const;
  const cellStyle = { padding: '0.65rem 0.75rem', verticalAlign: 'middle', textAlign: 'left' } as const;
  const regionClass = 'max-w-full overflow-x-auto rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';
  const controlClass = 'mt-2 min-h-11 w-full rounded-card border border-ink-300 bg-surface px-3 py-2 font-mono text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';

  return (
    <figure className={cx('not-prose my-8 space-y-6', className)} aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="m-0 font-display text-lg font-semibold text-ink-900">{title}</figcaption>
      <p className="m-0 text-sm leading-relaxed text-ink-700">{text.instructions}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {[[rowPlayer, rowStrategies[0], p], [colPlayer, colStrategies[0], q]].map(([player, action, value], index) => (
          <div key={index} className="min-w-0">
            <label htmlFor={`${id}-${index}`} className="block text-sm font-semibold text-ink-800">{text.probabilityTemplate.replaceAll('{player}', String(player)).replaceAll('{action}', String(action))}</label>
            <select id={`${id}-${index}`} className={controlClass} value={value} onChange={(event) => (index === 0 ? setP : setQ)(Number(event.currentTarget.value) as MixedAuditPercent)}>
              {MIXED_AUDIT_PERCENTAGES.map((option) => <option key={option} value={option}>{percent.format(option / 100)}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div>
        <p className="m-0 mb-3 font-semibold text-ink-900">{text.jointTitle}</p>
        <div role="region" aria-label={text.jointRegion} tabIndex={0} className={regionClass}>
          <table style={{ ...tableStyle, minWidth: '45rem' }}>
            <thead><tr>{[text.outcome, text.cellUtilities, text.probability, text.rowContribution, text.columnContribution].map((header) => <th key={header} scope="col" style={cellStyle} className="text-sm font-semibold text-ink-900">{header}</th>)}</tr></thead>
            <tbody>{audit.jointNumerators.map((weight, index) => (
              <tr key={index}>
                <th scope="row" style={cellStyle} className="text-sm font-medium text-ink-900">{rowStrategies[Math.floor(index / 2)]} / {colStrategies[index % 2]}</th>
                <td style={cellStyle} className="font-mono text-sm tabular-nums text-ink-800">({integer.format(rowPayoffs[Math.floor(index / 2)]![index % 2]!)}, {integer.format(negate(rowPayoffs[Math.floor(index / 2)]![index % 2]!))})</td>
                <td style={cellStyle}>
                  <span className="font-mono text-sm tabular-nums text-ink-800">{fraction(weight)} ({percent.format(weight / 10000)})</span>
                  <span aria-hidden="true" className="mt-2 block h-2 w-full overflow-hidden rounded-pill bg-surface-sunken"><span className="block h-full w-full origin-left rounded-pill bg-brand-600 transition-transform duration-200 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${weight / 10000})` }} /></span>
                </td>
                <td style={cellStyle} className="font-mono text-sm tabular-nums text-ink-800">{fraction(audit.rowContributionNumerators[index]!)}</td>
                <td style={cellStyle} className="font-mono text-sm tabular-nums text-ink-800">{fraction(audit.columnContributionNumerators[index]!)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div>
        <p className="m-0 font-semibold text-ink-900">{text.chartTitle}</p>
        <p className="m-0 mt-2 text-sm leading-relaxed text-ink-700">{text.chartLegend}</p>
        <div aria-hidden="true" className="mt-4 space-y-4">
          {players.map((player) => <div key={player.name}>
            <p className="m-0 mb-1 text-sm font-medium text-ink-800">{player.name}</p>
            <div className="relative h-8 bg-surface-sunken">
              <span className="absolute inset-y-0 left-1/2 w-px bg-ink-400" />
              <span className={cx('absolute inset-y-2 w-1/2 bg-brand-600 transition-transform duration-200 ease-out motion-reduce:transition-none', player.mean < 0 ? 'left-0 origin-right' : 'left-1/2 origin-left')} style={{ transform: `scaleX(${Math.abs(player.mean) / (10000 * bound)})` }} />
              <span className="absolute inset-y-1 w-1 bg-ink-900" style={{ left: `calc(${50 + Math.max(...player.pures) / (200 * bound)}% - 2px)` }} />
            </div>
          </div>)}
          <div className="flex justify-between font-mono text-xs tabular-nums text-ink-700"><span>−{integer.format(bound)}</span><span>0</span><span>{integer.format(bound)}</span></div>
        </div>
        <p className="m-0 mt-2 text-sm text-ink-600">{text.utilityUnit}</p>
      </div>
      <div role="region" aria-label={text.auditRegion} tabIndex={0} className={regionClass}>
        <table style={{ ...tableStyle, minWidth: '43rem' }}>
          <thead><tr>{[text.player, text.currentMean, text.pureAlternatives, text.bestPure, text.gain].map((header) => <th key={header} scope="col" style={cellStyle} className="text-sm font-semibold text-ink-900">{header}</th>)}</tr></thead>
          <tbody>{players.map((player) => <tr key={player.name}>
            <th scope="row" style={cellStyle} className="text-sm font-medium text-ink-900">{player.name}</th>
            <td style={cellStyle} className="font-mono text-sm tabular-nums text-ink-800">{fraction(player.mean)}</td>
            <td style={cellStyle} className="text-sm text-ink-800">{player.actions.map((action, index) => <span key={index} className="block">{action}: <span className="font-mono tabular-nums">{fraction(player.pures[index]!)}</span></span>)}</td>
            <td style={cellStyle} className="text-sm text-ink-800">{player.indices.length === 2 ? `${text.tie}: ` : ''}{player.indices.map((index) => player.actions[index]).join(' / ')}: <span className="font-mono tabular-nums">{fraction(Math.max(...player.pures))}</span></td>
            <td style={cellStyle} className="font-mono text-sm font-semibold tabular-nums text-ink-900">{fraction(player.gain)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p aria-live="polite" aria-atomic="true" className="m-0 text-sm leading-relaxed text-ink-800">{summary}</p>
      {caption ? <p className="m-0 text-sm leading-relaxed text-ink-600">{caption}</p> : null}
    </figure>
  );
}

export default MixedStrategyAudit;
