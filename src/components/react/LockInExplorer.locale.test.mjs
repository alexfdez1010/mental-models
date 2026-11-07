import { test, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { createHash } from 'node:crypto';
import { LockInExplorer } from '@/components/react/LockInExplorer';
const hash = (s) => createHash('sha256').update(s).digest('hex');
// Golden hashes captured from the original Git-matched component before the locale change.
const fixtures = [
  {
    "label": "default",
    "props": {
      "initialStrength": 0
    },
    "sha256": "4cb19ab9be639aa4b8ad12c328e01e79b2aa875609a957e2d69c8e9eda4c17ad",
    "svgSha256": "26aec54ba491d224cbba2e01d3ac586b82ade84b81c28c34d1ab5e067c3632d5"
  },
  {
    "label": "default",
    "props": {
      "initialStrength": 150
    },
    "sha256": "0b3a865932cf25b935d25b401fa78779ba5ee2762632b03f4dd3db6b984f66e4",
    "svgSha256": "26aec54ba491d224cbba2e01d3ac586b82ade84b81c28c34d1ab5e067c3632d5"
  },
  {
    "label": "default",
    "props": {
      "initialStrength": 300
    },
    "sha256": "951567492ed710dbc6819ed1d3e2d9026751b04fb401b80263172f7b9e124149",
    "svgSha256": "26aec54ba491d224cbba2e01d3ac586b82ade84b81c28c34d1ab5e067c3632d5"
  },
  {
    "label": "authored",
    "props": {
      "title": "Feedback and the adoption sequence",
      "eyebrow": "",
      "instructions": "Compare a run without adoption feedback with a run where existing users influence later choices. B has the higher fixed quality score in this toy model.",
      "caption": "The finite display threshold is a reporting convention. Use the model to inspect a mechanism; real adoption, switching and welfare require their own evidence.",
      "labelA": "Standard A",
      "labelB": "Standard B",
      "betterTag": "higher quality score",
      "qualityCaption": "Fixed model scores; they do not include every social consequence.",
      "strengthLabel": "Weight of existing adoption in the next choice",
      "strengthLowLabel": "no adoption feedback",
      "strengthHighLabel": "strong adoption feedback",
      "shareLabel": "Share of model adopters",
      "historyCaption": "A share through the finite sequence of adoptions.",
      "stepLabel": "Add adopters",
      "runLabel": "Run",
      "pauseLabel": "Pause",
      "shockLabel": "External shock",
      "resetLabel": "New run",
      "verdictContested": "neither option has crossed the display threshold",
      "verdictLockedBetter": "{winner} crossed the display threshold and has the higher fixed score",
      "verdictLockedWorse": "{winner} crossed the display threshold despite its lower fixed score",
      "readout": "Feedback weight {strength}; adopters {adopters}; A share {shareA} percent; B share {shareB} percent: {verdict}.",
      "initialStrength": 0
    },
    "sha256": "0d7bfee47c891988f9202036c31d191a43abffae05344f835400ccac559ef1cb",
    "svgSha256": "26aec54ba491d224cbba2e01d3ac586b82ade84b81c28c34d1ab5e067c3632d5"
  },
  {
    "label": "authored",
    "props": {
      "title": "Feedback and the adoption sequence",
      "eyebrow": "",
      "instructions": "Compare a run without adoption feedback with a run where existing users influence later choices. B has the higher fixed quality score in this toy model.",
      "caption": "The finite display threshold is a reporting convention. Use the model to inspect a mechanism; real adoption, switching and welfare require their own evidence.",
      "labelA": "Standard A",
      "labelB": "Standard B",
      "betterTag": "higher quality score",
      "qualityCaption": "Fixed model scores; they do not include every social consequence.",
      "strengthLabel": "Weight of existing adoption in the next choice",
      "strengthLowLabel": "no adoption feedback",
      "strengthHighLabel": "strong adoption feedback",
      "shareLabel": "Share of model adopters",
      "historyCaption": "A share through the finite sequence of adoptions.",
      "stepLabel": "Add adopters",
      "runLabel": "Run",
      "pauseLabel": "Pause",
      "shockLabel": "External shock",
      "resetLabel": "New run",
      "verdictContested": "neither option has crossed the display threshold",
      "verdictLockedBetter": "{winner} crossed the display threshold and has the higher fixed score",
      "verdictLockedWorse": "{winner} crossed the display threshold despite its lower fixed score",
      "readout": "Feedback weight {strength}; adopters {adopters}; A share {shareA} percent; B share {shareB} percent: {verdict}.",
      "initialStrength": 150
    },
    "sha256": "e63d23010333b023910fd61c60e5d01d69bb6bd3f9c9aedf8437a0daf2c71192",
    "svgSha256": "26aec54ba491d224cbba2e01d3ac586b82ade84b81c28c34d1ab5e067c3632d5"
  },
  {
    "label": "authored",
    "props": {
      "title": "Feedback and the adoption sequence",
      "eyebrow": "",
      "instructions": "Compare a run without adoption feedback with a run where existing users influence later choices. B has the higher fixed quality score in this toy model.",
      "caption": "The finite display threshold is a reporting convention. Use the model to inspect a mechanism; real adoption, switching and welfare require their own evidence.",
      "labelA": "Standard A",
      "labelB": "Standard B",
      "betterTag": "higher quality score",
      "qualityCaption": "Fixed model scores; they do not include every social consequence.",
      "strengthLabel": "Weight of existing adoption in the next choice",
      "strengthLowLabel": "no adoption feedback",
      "strengthHighLabel": "strong adoption feedback",
      "shareLabel": "Share of model adopters",
      "historyCaption": "A share through the finite sequence of adoptions.",
      "stepLabel": "Add adopters",
      "runLabel": "Run",
      "pauseLabel": "Pause",
      "shockLabel": "External shock",
      "resetLabel": "New run",
      "verdictContested": "neither option has crossed the display threshold",
      "verdictLockedBetter": "{winner} crossed the display threshold and has the higher fixed score",
      "verdictLockedWorse": "{winner} crossed the display threshold despite its lower fixed score",
      "readout": "Feedback weight {strength}; adopters {adopters}; A share {shareA} percent; B share {shareB} percent: {verdict}.",
      "initialStrength": 300
    },
    "sha256": "06afc8aec4c46e4839ccc7ef0b8f439c0fe1ed10cfed16d88b5f104bb4f0de25",
    "svgSha256": "26aec54ba491d224cbba2e01d3ac586b82ade84b81c28c34d1ab5e067c3632d5"
  }
];
for (const fixture of fixtures) test(`preserves original English and SVG at ${fixture.label} ${fixture.props.initialStrength}`, () => {
  const p=fixture.props;
  const en=render(createElement(LockInExplorer,p));
  const explicit=render(createElement(LockInExplorer,{...p,locale:'en'}));
  const es=render(createElement(LockInExplorer,{...p,locale:'es'}));
  expect(hash(en)).toBe(fixture.sha256);expect(explicit).toBe(en);
  const svg=(es.match(/<svg[\s\S]*?<\/svg>/g)??[]).join('');
  expect(hash(svg.replace(/aria-label="[^"]*"/g,''))).toBe(fixture.svgSha256);
  const english=(p.initialStrength / 100).toFixed(1),spanish=english.replace('.',',');
  // Reverse the formatted text only, including accessible labels. Geometry and machine values are untouched.
  const restored=es.replace(/>([^<]*)</g,(_all,text)=>'>'+text.replaceAll(spanish,english)+'<').replace(/(aria-label|aria-valuetext)="([^"]*)"/g,(_all,attr,text)=>attr+'="'+text.replaceAll(spanish,english)+'"');
  expect(restored).toBe(en);
  expect(es).toContain(spanish+'×');
});

test('localizes the hidden strength name using the authored Spanish template', () => {
  const s=render(createElement(LockInExplorer,{locale:'es',strengthValueTemplate:'Fuerza de realimentación {strength}',initialStrength:150}));
  expect(s).toContain('aria-valuetext="Fuerza de realimentación 1,5"');
  expect(s).toContain('value="150"');
  expect(() => render(createElement(LockInExplorer,{strengthValueTemplate:'missing token'}))).toThrow('strengthValueTemplate');
});
