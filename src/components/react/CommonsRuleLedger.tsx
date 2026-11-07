import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One additional unit or none for each of exactly three users. */
export type CommonsProfile = [0 | 1, 0 | 1, 0 | 1];

/** Fixed, one-period credit values, all integers from zero through ten thousand. */
export interface CommonsRuleModel {
  /** Private production benefit of an additional unit, before shared losses. */
  benefit: number;
  /** Loss imposed on EACH user by EACH additional unit, including its owner. */
  lossPerUser: number;
  /** Collected payment per detected additional unit into the passive fund. */
  fine: number;
  /** Real fund expenditure once per period, even with no additional units. */
  administration: number;
}

/** Exact expected accounts in hundredths of a credit, not rounded decisions. */
export interface CommonsAccounts {
  profile: CommonsProfile;
  additions: number;
  personal: [number, number, number];
  fund: number;
  combined: number;
  fineTransfers: number;
  /** Private gain from adding while holding the other users' actions fixed. */
  unilateral: number;
}

/** Localizable control and result labels; omitted entries use locale defaults. */
export interface CommonsRuleLabels {
  choices: string;
  addUnit: string;
  detection: string;
  expectedFine: string;
  unilateral: string;
  prediction: string;
  predictAdd: string;
  predictNone: string;
  predictTie: string;
  predictionScope: string;
  selected: string;
  accounts: string;
  fund: string;
  combined: string;
  unit: string;
  scale: string;
  transfers: string;
  usersPay: string;
  fundReceives: string;
  allProfiles: string;
  profile: string;
  choicesHint: string;
  baseline: string;
}

/** A bounded hypothetical ledger, not an ecological or behavioral simulation. */
export interface CommonsRuleLedgerProps extends CommonsRuleModel {
  /** Exactly three distinct user names in the lesson's language. */
  users: [string, string, string];
  title: string;
  /** Integer percentage from zero through one hundred; zero does not remove administration. */
  initialDetectionPercent?: number;
  /** Hypothetical choices; changing detection never overwrites them. */
  initialProfile?: CommonsProfile;
  locale?: 'en' | 'es';
  labels?: Partial<CommonsRuleLabels>;
  className?: string;
}

const defaults: Record<'en' | 'es', CommonsRuleLabels> = {
  en: {
    choices: 'Hypothetical choices', addUnit: 'Add one unit', detection: 'Detection probability',
    expectedFine: 'Expected fine per addition', unilateral: 'Private change from adding',
    prediction: 'Model prediction', predictAdd: 'Each strictly prefers adding; only all-add is an equilibrium.',
    predictNone: 'Each strictly prefers no addition; only no-add is an equilibrium.',
    predictTie: 'Each is indifferent; all eight profiles are equilibria. No unique choice is predicted.',
    predictionScope: 'Linear personal-credit preferences and the stated one-period assumptions; not observed behavior.',
    selected: 'Selected hypothetical profile', accounts: 'Expected balances for the selected profile',
    fund: 'Passive fund', combined: 'Users + fund', unit: 'credits',
    scale: 'Shared bar scale; zero in the centre', transfers: 'Fines already included in these balances',
    usersPay: 'Users pay', fundReceives: 'Fund receives', allProfiles: 'All hypothetical profiles', profile: 'Profile',
    choicesHint: 'One means an additional unit; zero means none. Choices stay fixed when detection changes.',
    baseline: 'No fine is charged; any stated administration remains a real cost.',
  },
  es: {
    choices: 'Decisiones hipotéticas', addUnit: 'Añadir una unidad', detection: 'Probabilidad de detección',
    expectedFine: 'Multa esperada por unidad añadida', unilateral: 'Cambio privado al añadir',
    prediction: 'Predicción del modelo', predictAdd: 'Todos prefieren estrictamente añadir; solo el perfil en que todos añaden es un equilibrio.',
    predictNone: 'Todos prefieren estrictamente no añadir; solo el perfil sin añadidos es un equilibrio.',
    predictTie: 'Todos son indiferentes; los ocho perfiles son equilibrios. No se predice una decisión única.',
    predictionScope: 'Preferencias lineales sobre los créditos personales y supuestos de un solo periodo; no es conducta observada.',
    selected: 'Perfil hipotético elegido', accounts: 'Saldos esperados del perfil elegido',
    fund: 'Fondo pasivo', combined: 'Usuarios + fondo', unit: 'créditos',
    scale: 'Escala común de las barras; cero en el centro', transfers: 'Multas ya incluidas en estos saldos',
    usersPay: 'Pagan los usuarios', fundReceives: 'Recibe el fondo', allProfiles: 'Todos los perfiles hipotéticos', profile: 'Perfil',
    choicesHint: 'Uno indica una unidad adicional; cero, ninguna. Las decisiones se mantienen al cambiar la detección.',
    baseline: 'No se cobra multa; el coste administrativo indicado sigue siendo un coste real.',
  },
};

function validateModel(model: CommonsRuleModel): void {
  if (!model || typeof model !== 'object') throw new Error('CommonsRuleLedger: model is required.');
  for (const key of ['benefit', 'lossPerUser', 'fine', 'administration'] as const) {
    if (!Number.isSafeInteger(model[key]) || model[key] < 0 || model[key] > 10_000) {
      throw new Error(`CommonsRuleLedger: ${key} must be an integer from zero through ten thousand.`);
    }
  }
}

function validatePercent(percent: number): void {
  if (!Number.isSafeInteger(percent) || percent < 0 || percent > 100) {
    throw new Error('CommonsRuleLedger: detectionPercent must be an integer from zero through one hundred.');
  }
}

function validateProfile(profile: CommonsProfile): void {
  if (!Array.isArray(profile) || profile.length !== 3 || Array.from(profile).some(x => x !== 0 && x !== 1)) {
    throw new Error('CommonsRuleLedger: profile must contain exactly three binary choices.');
  }
}

/** Enumerate all binary profiles, without selecting behavior for indifferent users. */
export function commonsProfiles(): CommonsProfile[] {
  return Array.from({ length: 8 }, (_, n) => [(n >> 2) & 1, (n >> 1) & 1, n & 1] as CommonsProfile);
}

/**
 * Compute exact hundredths: no epsilon is used for the sign of a private incentive.
 * The actors are self-regarding, the fund passive, and fine receipts are not rebated.
 */
export function commonsAccounts(model: CommonsRuleModel, detectionPercent: number, profile: CommonsProfile): CommonsAccounts {
  validateModel(model);
  validatePercent(detectionPercent);
  validateProfile(profile);
  const n = profile[0] + profile[1] + profile[2];
  const fineEach = detectionPercent * model.fine;
  const personal = profile.map(x => 100 * (model.benefit * x - model.lossPerUser * n) - fineEach * x) as [number, number, number];
  const fineTransfers = fineEach * n;
  const fund = fineTransfers - 100 * model.administration;
  return {
    profile: [...profile], additions: n, personal, fund, fineTransfers,
    combined: personal[0] + personal[1] + personal[2] + fund,
    unilateral: 100 * (model.benefit - model.lossPerUser) - fineEach,
  };
}

/**
 * Explore exact expected credits with native controls, a signed common-scale chart
 * and the complete eight-profile ledger. A selected profile is always hypothetical;
 * detection changes only the accounts/prediction, never the user's chosen profile.
 */
export function CommonsRuleLedger({
  users, title, benefit, lossPerUser, fine, administration,
  initialDetectionPercent = 0, initialProfile = [0, 0, 0], locale = 'en', labels, className,
}: CommonsRuleLedgerProps) {
  const model = { benefit, lossPerUser, fine, administration };
  validateModel(model);
  validatePercent(initialDetectionPercent);
  validateProfile(initialProfile);
  if (!Array.isArray(users) || users.length !== 3 || Array.from(users).some(x => typeof x !== 'string' || !x.trim()) || new Set(users.map(x => x.trim())).size !== 3) {
    throw new Error('CommonsRuleLedger: users must contain exactly three distinct nonempty names.');
  }
  if (typeof title !== 'string' || !title.trim()) throw new Error('CommonsRuleLedger: title must be nonempty.');
  if (locale !== 'en' && locale !== 'es') throw new Error('CommonsRuleLedger: locale must be en or es.');
  if (labels !== undefined && (!labels || typeof labels !== 'object' || Array.isArray(labels))) throw new Error('CommonsRuleLedger: labels must be an object.');
  for (const [key, value] of Object.entries(labels ?? {})) {
    if (!Object.hasOwn(defaults.en, key) || typeof value !== 'string' || !value.trim()) throw new Error(`CommonsRuleLedger: labels.${key} must be a supported nonempty label.`);
  }
  const copy = { ...defaults[locale], ...labels };
  const id = useId();
  const [percent, setPercent] = useState(initialDetectionPercent);
  const [profile, setProfile] = useState<CommonsProfile>(() => [...initialProfile]);
  const selected = commonsAccounts(model, percent, profile);
  const profiles = commonsProfiles();
  const rows = profiles.map(p => commonsAccounts(model, percent, p));
  const extremes = [0, 100].flatMap(q => profiles.map(p => commonsAccounts(model, q, p)));
  const peak = Math.max(100, ...extremes.flatMap(row => [...row.personal, row.fund, row.combined].map(Math.abs)));
  const numberLocale = locale === 'es' ? 'es-ES' : 'en-US';
  const format = (hundredths: number, signed = true) => new Intl.NumberFormat(numberLocale, {
    maximumFractionDigits: 2, signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(hundredths === 0 ? 0 : hundredths / 100);
  const raw = (value: number) => new Intl.NumberFormat(numberLocale).format(value === 0 ? 0 : value);
  const q = new Intl.NumberFormat(numberLocale, { style: 'percent', maximumFractionDigits: 0 }).format(percent === 0 ? 0 : percent / 100);
  const balances = [...users.map((name, i) => ({ name, value: selected.personal[i]! })), { name: copy.fund, value: selected.fund }, { name: copy.combined, value: selected.combined }];
  const prediction = selected.unilateral > 0 ? copy.predictAdd : selected.unilateral < 0 ? copy.predictNone : copy.predictTie;
  const cell = { padding: 'calc(var(--spacing) * 2) calc(var(--spacing) * 3)', verticalAlign: 'middle' as const };
  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';

  return <figure className={cx('not-prose my-8 min-w-0 space-y-6', className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-ink-900">{copy.choices}</legend>
      <p className="mb-3 text-sm leading-relaxed text-ink-700">{copy.choicesHint}</p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {users.map((user, i) => <label key={user} className="flex min-h-11 items-center gap-2 text-sm text-ink-900">
          <input type="checkbox" checked={profile[i] === 1} onChange={e => {
            const checked = e.currentTarget.checked;
            setProfile(previous => previous.map((x, j) => i === j ? (checked ? 1 : 0) : x) as CommonsProfile);
          }} className={cx('h-5 w-5 accent-brand-700', focus)} />
          <span>{user}: {copy.addUnit}</span>
        </label>)}
      </div>
    </fieldset>
    {fine > 0 ? <div>
      <label htmlFor={`${id}-q`} className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold text-ink-900">
        <span>{copy.detection}</span><output htmlFor={`${id}-q`} className="font-mono tabular-nums">{q}</output>
      </label>
      <input id={`${id}-q`} type="range" min={0} max={100} step={1} value={percent} onChange={e => setPercent(Number(e.currentTarget.value))}
        className={cx('mt-2 h-11 w-full accent-brand-700', focus)} aria-valuetext={q} />
    </div> : <p className="text-sm text-ink-700">{copy.baseline}</p>}
    <div aria-live="polite" aria-atomic="true" className="space-y-5">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm text-ink-700">{copy.expectedFine} ({copy.unit})</dt><dd className="mt-1 font-mono text-sm tabular-nums text-ink-900">{q} × {raw(fine)} = {format(percent * fine, false)}</dd></div>
        <div><dt className="text-sm text-ink-700">{copy.unilateral} ({copy.unit})</dt><dd className="mt-1 font-mono text-sm tabular-nums text-ink-900">{raw(benefit)} − {raw(lossPerUser)} − {format(percent * fine, false)} = {format(selected.unilateral)}</dd></div>
      </dl>
      <div className="bg-surface-sunken p-4">
        <p className="text-sm font-semibold text-ink-900">{copy.prediction}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-900">{prediction}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">{copy.predictionScope}</p>
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-900">{copy.selected}: <span className="font-mono">{profile.join('')}</span></p>
        <p className="mt-1 text-sm text-ink-700">{copy.accounts} ({copy.unit})</p>
        <ul className="mt-4 space-y-3" role="list">
          {balances.map(({ name, value }, i) => <li key={i}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm"><span className="text-ink-900">{name}</span><span className="font-mono tabular-nums text-ink-900">{format(value)}</span></div>
            <div aria-hidden="true" className="relative h-3 bg-ink-100">
              <div className="absolute inset-y-0 left-1/2 w-px bg-ink-600" />
              <div className={cx('absolute inset-y-0 w-1/2 bg-brand-700 transition-transform duration-200 motion-reduce:transition-none', value < 0 ? 'right-1/2 origin-right' : 'left-1/2 origin-left')}
                style={{ transform: `scaleX(${Math.abs(value) / peak})` }} />
            </div>
          </li>)}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-ink-700">{copy.scale} ({copy.unit}): {format(-peak)} / 0 / {format(peak)}</p>
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-900">{copy.transfers}</p>
        <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-700"><span>{copy.usersPay}: <span className="font-mono">{format(-selected.fineTransfers)}</span></span><span>{copy.fundReceives}: <span className="font-mono">{format(selected.fineTransfers)}</span></span><span>{copy.combined}: <span className="font-mono">0 {copy.unit}</span></span></p>
      </div>
    </div>
    <div>
      <p id={`${id}-table`} className="mb-2 text-sm font-semibold text-ink-900">{copy.allProfiles} ({copy.unit})</p>
      <div className={cx("max-w-full overflow-x-auto", focus)} role="region" tabIndex={0} aria-labelledby={`${id}-table`}>
        <table className="w-full text-left text-sm" style={{ boxShadow: 'none', borderRadius: 0 }} aria-describedby={`${id}-table`}>
          <thead><tr><th scope="col" style={{ ...cell, textAlign: 'left' }} className="px-3 py-2">{copy.profile}</th>{[...users, copy.fund, copy.combined].map((name, i) => <th key={i} scope="col" style={{ ...cell, textAlign: 'right' }} className="px-3 py-2 text-right font-semibold">{name}</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.profile.join('')} className={cx(row.profile.join('') === profile.join('') && 'bg-brand-100')}>
            <th scope="row" style={{ ...cell, textAlign: 'left' }} className="px-3 py-2 font-mono font-medium tabular-nums">{row.profile.join('')}{row.profile.join('') === profile.join('') ? <span className="sr-only"> — {copy.selected}</span> : null}</th>
            {[...row.personal, row.fund, row.combined].map((value, i) => <td key={i} style={{ ...cell, textAlign: 'right' }} className="px-3 py-2 text-right font-mono tabular-nums">{format(value)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  </figure>;
}

export default CommonsRuleLedger;
