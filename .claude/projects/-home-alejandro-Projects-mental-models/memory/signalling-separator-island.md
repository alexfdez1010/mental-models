---
name: signalling-separator-island
description: SignallingSeparator island for the signaling-and-costly-signals course — Spence separating window explorer; English-default props so es must translate.
metadata:
  type: reference
---

`SignallingSeparator` (`src/components/react/SignallingSeparator.tsx`, in the barrel) is the
signaling-and-costly-signals course island: two sliders for the signal's per-unit cost to a
HIGH vs a LOW type (6–40) plus a receiver-prior slider (0–100). It draws each type's cost
line vs signal intensity against a flat benefit line; the wedge below the benefit between the
two cost lines is the **separating window**, which exists only when the HIGH line is flatter
(the Spence single-crossing condition). Readout: equilibrium (Separating/Pooling), who
signals, receiver belief, and pure cost burned.

- Separating config = wide gap, e.g. `initialCostHigh={12} initialCostLow={30}`.
- Pooling config = narrow gap, e.g. `initialCostHigh={22} initialCostLow={26}`.
- **English-default labels** (costHighLabel, costLowLabel, priorLabel, priorHint, axisLabel,
  xAxisLabel, benefitLabel, highLineLabel, lowLineLabel, windowLabel, readoutLabel, the four
  stat labels, separatingWord/poolingWord/onlyHighWord/noneWord/beliefHighWord, analysisLabel,
  poolingNote/wastefulNote/separatingNote, eyebrow, instructions) — es lessons MUST pass the
  Spanish prop set (canonical translations live in `es/.../00-introduction.mdx`).

Same family as [[contract-designer-island]], [[payoff-explorer-island]].
