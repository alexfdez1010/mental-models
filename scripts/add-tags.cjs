const fs = require('fs');
const path = require('path');

const TAGS = {
  'investing-basics': [
    'money-and-value', 'investing-basics', 'interest-and-yield', 'money-time-value',
    'loans-and-mortgages', 'history-of-money', 'economics-for-finance',
    'investment-psychology', 'investment-metrics', 'bonds-and-rates'
  ],
  'crypto': [
    'crypto-basics', 'bitcoin', 'ethereum', 'stablecoins', 'defi-amms',
    'defi-lending', 'mev-and-ordering', 'zcash'
  ],
  'quantitative-finance': [
    'statistics-for-finance', 'portfolio-theory', 'portfolio-optimization',
    'factor-models', 'risk-of-ruin', 'kelly-and-cagr', 'value-at-risk',
    'monte-carlo-finance', 'stochastic-processes', 'time-series-finance',
    'extreme-value-and-tails', 'bayesian-finance'
  ],
  'derivatives': [
    'options-basics', 'options-pricing', 'greeks-and-hedging'
  ],
  'prediction-markets': [
    'polymarket-prediction-markets'
  ]
};

const topicToTags = {};
for (const [tag, topics] of Object.entries(TAGS)) {
  for (const t of topics) {
    if (!topicToTags[t]) topicToTags[t] = [];
    topicToTags[t].push(tag);
  }
}

const BASE = 'src/content/topics';

for (const lang of ['en', 'es']) {
  const dir = path.join(BASE, lang);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx'));
  for (const file of files) {
    const slug = file.replace(/\.mdx$/, '');
    const tags = topicToTags[slug];
    if (!tags) {
      console.warn(`No tags for ${lang}/${slug}`);
      continue;
    }
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('tags:')) {
      console.log(`Skipping ${lang}/${slug} — already has tags`);
      continue;
    }
    const tagsYaml = `tags:\n  - ${tags.join('\n  - ')}`;
    // Try to insert after the dependencies block and before seo:
    const depBlockRe = /(dependencies:\s*(?:\n(?:  - [^\n]+|\[\]))*\n)(seo:)/;
    if (depBlockRe.test(content)) {
      content = content.replace(depBlockRe, `$1${tagsYaml}\n$2`);
    } else {
      console.warn(`Could not find insertion point for ${lang}/${slug}`);
      continue;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Added tags to ${lang}/${slug}`);
  }
}
