import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SignallingSeparator } from '@/components/react/SignallingSeparator';
const samples = [
  {},
  {
    "initialCostHigh": 6,
    "initialCostLow": 6,
    "initialPrior": 0
  },
  {
    "initialCostHigh": 6,
    "initialCostLow": 6,
    "initialPrior": 40
  },
  {
    "initialCostHigh": 6,
    "initialCostLow": 6,
    "initialPrior": 100
  },
  {
    "initialCostHigh": 6,
    "initialCostLow": 26,
    "initialPrior": 0
  },
  {
    "initialCostHigh": 6,
    "initialCostLow": 26,
    "initialPrior": 40
  },
  {
    "initialCostHigh": 6,
    "initialCostLow": 26,
    "initialPrior": 100
  },
  {
    "initialCostHigh": 6,
    "initialCostLow": 40,
    "initialPrior": 0
  },
  {
    "initialCostHigh": 6,
    "initialCostLow": 40,
    "initialPrior": 40
  },
  {
    "initialCostHigh": 6,
    "initialCostLow": 40,
    "initialPrior": 100
  },
  {
    "initialCostHigh": 12,
    "initialCostLow": 6,
    "initialPrior": 0
  },
  {
    "initialCostHigh": 12,
    "initialCostLow": 6,
    "initialPrior": 40
  },
  {
    "initialCostHigh": 12,
    "initialCostLow": 6,
    "initialPrior": 100
  },
  {
    "initialCostHigh": 12,
    "initialCostLow": 26,
    "initialPrior": 0
  },
  {
    "initialCostHigh": 12,
    "initialCostLow": 26,
    "initialPrior": 40
  },
  {
    "initialCostHigh": 12,
    "initialCostLow": 26,
    "initialPrior": 100
  },
  {
    "initialCostHigh": 12,
    "initialCostLow": 40,
    "initialPrior": 0
  },
  {
    "initialCostHigh": 12,
    "initialCostLow": 40,
    "initialPrior": 40
  },
  {
    "initialCostHigh": 12,
    "initialCostLow": 40,
    "initialPrior": 100
  },
  {
    "initialCostHigh": 22,
    "initialCostLow": 6,
    "initialPrior": 0
  },
  {
    "initialCostHigh": 22,
    "initialCostLow": 6,
    "initialPrior": 40
  },
  {
    "initialCostHigh": 22,
    "initialCostLow": 6,
    "initialPrior": 100
  },
  {
    "initialCostHigh": 22,
    "initialCostLow": 26,
    "initialPrior": 0
  },
  {
    "initialCostHigh": 22,
    "initialCostLow": 26,
    "initialPrior": 40
  },
  {
    "initialCostHigh": 22,
    "initialCostLow": 26,
    "initialPrior": 100
  },
  {
    "initialCostHigh": 22,
    "initialCostLow": 40,
    "initialPrior": 0
  },
  {
    "initialCostHigh": 22,
    "initialCostLow": 40,
    "initialPrior": 40
  },
  {
    "initialCostHigh": 22,
    "initialCostLow": 40,
    "initialPrior": 100
  },
  {
    "initialCostHigh": 40,
    "initialCostLow": 6,
    "initialPrior": 0
  },
  {
    "initialCostHigh": 40,
    "initialCostLow": 6,
    "initialPrior": 40
  },
  {
    "initialCostHigh": 40,
    "initialCostLow": 6,
    "initialPrior": 100
  },
  {
    "initialCostHigh": 40,
    "initialCostLow": 26,
    "initialPrior": 0
  },
  {
    "initialCostHigh": 40,
    "initialCostLow": 26,
    "initialPrior": 40
  },
  {
    "initialCostHigh": 40,
    "initialCostLow": 26,
    "initialPrior": 100
  },
  {
    "initialCostHigh": 40,
    "initialCostLow": 40,
    "initialPrior": 0
  },
  {
    "initialCostHigh": 40,
    "initialCostLow": 40,
    "initialPrior": 40
  },
  {
    "initialCostHigh": 40,
    "initialCostLow": 40,
    "initialPrior": 100
  }
];
// Captured from the unchanged source before the optional label extension.
const originalEnglish = [
  "05ca264dbc513a1193c1a2065d6228a3b009c2b0b2ff46e4dd898af89abec51c",
  "09eba1616ab6efab43d0b97cb7537b9064a168c4eac1fd3f41ccfd7b6d1fae0e",
  "f89812f15716e0175878a1174fcb3ad2ca2ec24330ac8875c07cdead40b64206",
  "e42f7231e78427a3fb168d79591baebfecdeb84af7681f23a6a50da93cfbc311",
  "7896c76c161be55755802b92df55861c00a84897ec3c95096be89779b89ee557",
  "91305b3342dc022852bdbe667e623e717aa99ba89bb7fc67a4d2b0ef45218230",
  "bd1c48a2491428b8f78a9554a86b8e575a2f0993e6377eb98911708dc0c4851e",
  "2f85b73aa1c09b816cc677b36d16bbb45295d40b87c4806b2eec46b9aaafe5cc",
  "6842288d460f77f8b7bd08bc01c4026369cfd4a6a6a8eef648865f11f0ce484a",
  "314640d5c1276c14ce561fd4f30945c033cfb27dec4db45647391899d508a36b",
  "233a52a84eafad9a26407b472a2e415329d77cd189a70c5033a0f3fa70a59bb0",
  "c0e4f3558f8a404a4c721debcda394380506d348ed114ee930ef9ed368f23e50",
  "6d84ed14ec5c95d84f9af67d60259b6de981dcbc2b5481984b1fe3e23574d853",
  "1243f2104fcf2fa9e647a255dbadb875b6cdbd0adac5ed9449f0ebae0935daec",
  "05ca264dbc513a1193c1a2065d6228a3b009c2b0b2ff46e4dd898af89abec51c",
  "d67faeca0d3899b24a4a6e2a887fdb00e4d13be5aa5a58fda2195fa405bc4413",
  "fb8af4b9fe91dd56d160ce34ba34c2810a47abb9b03e29a5c3e35f6420874e3a",
  "aa0779ce23695abb13e6ec5e6924d5538f588e5502ce225fa182e6700e4e1822",
  "15903a0c1fc909d5c2a1ff1b0545e72265aee62f0616b84d81cde02eb0f632ab",
  "4317798a510cd603f6c187618fab2cea95877bdb87095d9fc12a3b17a9d16f13",
  "88ec487c201db70436097fa19d537312bdd3adc6f4ec9049bff95f407ec7c9de",
  "e510f9fc6881c243fb30aa870ac7383ef856a44c8ec464a028388cdd85d631f3",
  "debe8867155df019b2d8325c4b5f225886df7e740ef2caed38c1dcf459c895ea",
  "94964114ca57df46781a9843d3dede50fa1d641c0c080c889998483441465ed2",
  "19cfd2eb35a05ba3d28e509e9a6fa2289ea2ad1193541192990f43ffb7d6e618",
  "77faaefd8e52d8437349430a95a4c97446fb3cc1399db8c15104b7bed534a538",
  "d29840dbe995d20f33cfecc2a48f0e233cf094cef8f94ad76f07dddefecb0b73",
  "e21bf275f4f3c3d3332f21451165e7d50f629df45564d8d3804c7d3ca7e26315",
  "57fa6e828515cb6a20375fd36ff7d06957e4d1410096cc0690a2a5ab83e59297",
  "3d17676987e891119b42b9c10d92be131866d5022726b1cfb8e24fc1ae90d942",
  "aa0b272b83433fcdcfbbd8490ed19c1bfa10182f0a94f796eec5974a34b86d5e",
  "6d30d2fe0ea6c0b77f3980da5020fa43fd6fda5694dd1a54cbcaf4bcc230f282",
  "e6c241ff946cdcec182e28dba546f40b053cc21d6ca660041ca947337b0efe26",
  "8e891d53c64eeebfe4f1fd7ab851eaa0b5616ca3966e058ddc5257f60867bfdb",
  "0f5dc10ac80c53a7a0d5e4e954cdd23f1dab1b6cf99bb21d98b124ae3a012496",
  "be1d1f9c88c528af03a900e9ddcf9a0c15d983f8a7ad5430cde2dbe4253ca63c",
  "232880687b92e4688084839434a73bb6f0a20c7fc9d334d7b9f0987074ad7176"
];
const clean = (s: string) => s.replaceAll(/_R_[^_]*_/g, '_ID_');
const render = (p: Parameters<typeof SignallingSeparator>[0]) => clean(renderToStaticMarkup(createElement(SignallingSeparator, p)));
const geometry = (html: string) => html.match(/<svg[\s\S]*?<\/svg>/)![0].replace(/aria-label="[^"]*"/g, '').replace(/>[^<]+</g, '><');
describe('SignallingSeparator optional language templates', () => {
 test('preserves original default English markup across costs, priors and display branches', () => {
  for (let i = 0; i < samples.length; i++) expect(createHash('sha256').update(render(samples[i]!)).digest('hex')).toBe(originalEnglish[i]);
 });
 test('localises ticks and all accessible descriptions without changing geometry', () => {
  for (const sample of samples) {
   const p = { ...sample, noneTickLabel: 'ninguna', maxTickLabel: 'máxima', moreTickLabel: 'más →', chartAriaTemplate: 'Coste H {costHigh}; coste L {costLow}; {axisLabel}; {xAxisLabel}; {status}.', highCostAriaTemplate: '{value} unidades para H', lowCostAriaTemplate: '{value} unidades para L', priorAriaTemplate: '{value}% de H', axisLabel: 'Coste', xAxisLabel: 'Intensidad', separatingWord: 'Ventana visible', poolingWord: 'Sin ventana visible' };
   const english = render(sample), spanish = render(p);
   expect(geometry(spanish)).toBe(geometry(english));
   expect(spanish).toContain('>ninguna</text>'); expect(spanish).toContain('>máxima</text>'); expect(spanish).toContain('>más →</text>');
   expect(spanish).toContain('aria-valuetext="' + (sample.initialCostHigh ?? 12) + ' unidades para H"');
   expect(spanish).toContain('aria-valuetext="' + (sample.initialCostLow ?? 26) + ' unidades para L"');
   expect(spanish).toContain('aria-valuetext="' + (sample.initialPrior ?? 40) + '% de H"');
   expect(spanish).toContain('aria-label="Coste H ' + (sample.initialCostHigh ?? 12) + '; coste L ' + (sample.initialCostLow ?? 26));
   expect(spanish).not.toMatch(/aria-(?:label|valuetext)="[^"]*\{(?:value|status|costHigh|costLow)\}/);
  }
 });
});
