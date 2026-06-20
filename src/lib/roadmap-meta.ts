/**
 * Roadmap metadata — PURE data, no astro:content imports, so it is safe to
 * import from anywhere including `astro.config.mjs` (which uses it to emit a
 * 301 redirect per tag from the retired /roadmap/<tag> pages to the catalog's
 * `?tag=` filter). A roadmap is a curated learning path (a subset of the
 * catalog) with a bilingual title, description, and icon. The tag itself
 * lives on each topic's frontmatter (`tags:`), so adding a course to a
 * roadmap is just editing its MDX file — no code changes here.
 *
 * ── TEMPLATE NOTE ──────────────────────────────────────────────────────────
 * Replace the example roadmap below with the learning paths (tag taxonomy) for
 * your subject — see TOPIC.md ("Tag taxonomy"). Each entry's `tag` must match a
 * `tags:` value used in your topic MDX frontmatter. The `bootstrap-topic` skill
 * helps you define these.
 */

export interface RoadmapMeta {
  /** Tag slug — matches the `tags:` value in topic MDX frontmatter. */
  tag: string;
  /** Emoji / icon for the roadmap card. */
  icon: string;
  /** Bilingual title. */
  title: { en: string; es: string };
  /** Bilingual one-line description. */
  description: { en: string; es: string };
  /** Display order on the home page (lower = earlier). */
  order: number;
}

/**
 * The principal categories of mental models, as learning paths. Each is a
 * cross-disciplinary "drawer" of the latticework (see TOPIC.md). A topic can
 * carry several tags — most models belong to more than one category.
 */
export const roadmaps: RoadmapMeta[] = [
  {
    tag: 'foundations',
    icon: '🧱',
    order: 0,
    title: { en: 'Foundations', es: 'Fundamentos' },
    description: {
      en: 'Start here. What a mental model is, the latticework idea, and the base models everything else builds on — map vs. territory, first principles.',
      es: 'Empieza aquí. Qué es un modelo mental, la idea de la red de modelos y los modelos base sobre los que se construye todo: el mapa no es el territorio, primeros principios.',
    },
  },
  {
    tag: 'decision-making',
    icon: '⚖️',
    order: 1,
    title: { en: 'Decision-Making & Judgment', es: 'Decisiones y Criterio' },
    description: {
      en: 'Choosing well under uncertainty: inversion, second-order thinking, opportunity cost, margin of safety and expected value.',
      es: 'Decidir bien bajo incertidumbre: inversión, pensamiento de segundo orden, coste de oportunidad, margen de seguridad y valor esperado.',
    },
  },
  {
    tag: 'probability',
    icon: '🎲',
    order: 2,
    title: { en: 'Probability & Uncertainty', es: 'Probabilidad e Incertidumbre' },
    description: {
      en: 'Thinking in odds: base rates, Bayesian updating, regression to the mean, fat tails and sample size.',
      es: 'Pensar en probabilidades: tasas base, actualización bayesiana, regresión a la media, colas anchas y tamaño muestral.',
    },
  },
  {
    tag: 'psychology',
    icon: '🧠',
    order: 3,
    title: { en: 'Human Nature & Bias', es: 'Naturaleza Humana y Sesgos' },
    description: {
      en: 'How minds misfire: the major cognitive biases, incentives, social proof and commitment & consistency.',
      es: 'Cómo falla la mente: los principales sesgos cognitivos, los incentivos, la prueba social y el compromiso y la coherencia.',
    },
  },
  {
    tag: 'systems-thinking',
    icon: '🔄',
    order: 4,
    title: { en: 'Systems & Feedback', es: 'Sistemas y Retroalimentación' },
    description: {
      en: 'Wholes over parts: feedback loops, stocks & flows, bottlenecks, emergence and leverage points.',
      es: 'El todo sobre las partes: bucles de retroalimentación, stocks y flujos, cuellos de botella, emergencia y puntos de apalancamiento.',
    },
  },
  {
    tag: 'economics',
    icon: '📈',
    order: 5,
    title: { en: 'Economics & Markets', es: 'Economía y Mercados' },
    description: {
      en: 'Incentives at scale: supply & demand, comparative advantage, externalities and the tragedy of the commons.',
      es: 'Incentivos a escala: oferta y demanda, ventaja comparativa, externalidades y la tragedia de los comunes.',
    },
  },
  {
    tag: 'problem-solving',
    icon: '🧩',
    order: 6,
    title: { en: 'Problem-Solving', es: 'Resolución de Problemas' },
    description: {
      en: 'Cracking hard problems: first principles, inversion, thought experiments and Occam’s & Hanlon’s razors.',
      es: 'Resolver problemas difíciles: primeros principios, inversión, experimentos mentales y las navajas de Occam y Hanlon.',
    },
  },
  {
    tag: 'science-engineering',
    icon: '⚙️',
    order: 7,
    title: { en: 'Science & Engineering', es: 'Ciencia e Ingeniería' },
    description: {
      en: 'Borrowed from the hard sciences: critical mass, equilibrium, leverage, compounding and algorithms.',
      es: 'Tomados de las ciencias exactas: masa crítica, equilibrio, apalancamiento, interés compuesto y algoritmos.',
    },
  },
  {
    tag: 'biology-evolution',
    icon: '🧬',
    order: 8,
    title: { en: 'Biology & Evolution', es: 'Biología y Evolución' },
    description: {
      en: 'Models from life itself: natural selection, adaptation, ecosystems and niches, and the Red Queen effect of constant co-evolution.',
      es: 'Modelos tomados de la propia vida: selección natural, adaptación, ecosistemas y nichos, y el efecto de la Reina Roja de coevolución constante.',
    },
  },
  {
    tag: 'strategy',
    icon: '♟️',
    order: 9,
    title: { en: 'Strategy & Competition', es: 'Estrategia y Competencia' },
    description: {
      en: 'Winning repeated games: game theory, moats, comparative advantage and the Red Queen effect.',
      es: 'Ganar juegos repetidos: teoría de juegos, fosos competitivos, ventaja comparativa y el efecto de la Reina Roja.',
    },
  },
];

/** Quick lookup by tag. */
export const roadmapByTag = new Map<string, RoadmapMeta>(roadmaps.map((r) => [r.tag, r]));

/** All tag slugs in order. */
export const roadmapTags: string[] = roadmaps.map((r) => r.tag);
