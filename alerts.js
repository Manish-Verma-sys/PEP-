// ---------------------------------------------------------------------------
// Seed regulatory dataset.
// This is illustrative/fictional data so the app works out-of-the-box with no
// external dependencies. The live-fetch layer (server/sources.js) can replace
// or augment this once a real data provider / API key is confirmed.
// ---------------------------------------------------------------------------

export const ALERTS = [
  {
    id: 'efsa-sweetener-reeval',
    sev: 'critical', reg: 'EFSA', when: '2h ago',
    focus: 'Sugar reduction',
    title: 'EFSA opens re-evaluation of a high-intensity sweetener used in zero-sugar lines',
    desc: 'A scheduled safety re-evaluation could tighten permitted-use levels for a widely used sweetener across EU soft-drink categories.',
    tags: ['Sugar reduction', 'Beverages', 'EU'],
    impact: '2 zero-sugar SKUs in EU may need reformulation',
    region: 'European Union', stage: 'Public consultation open',
    enforce: 'Est. 2026 Q3 (if adopted)', lead: '~180 days',
    detail: 'The authority has placed a commonly used high-intensity sweetener on its re-evaluation schedule. If the acceptable daily intake is revised downward, formulations relying on it near the current permitted ceiling would need adjustment. A public consultation is open — a window to model exposure and prepare alternatives before any binding change.',
    skus: [
      { name: 'Zero-sugar cola (EU)', market: 'EU', dep: 'Near permitted ceiling', risk: 'high' },
      { name: 'Zero-sugar citrus (EU)', market: 'EU', dep: 'Moderate use level', risk: 'med' },
      { name: 'Low-sugar iced tea RTD', market: 'EU', dep: 'Blend, low reliance', risk: 'low' }
    ]
  },
  {
    id: 'fssai-fop-sugar',
    sev: 'critical', reg: 'FSSAI', when: '6h ago',
    focus: 'Labelling / reformulation',
    title: 'FSSAI draft amendment on front-of-pack labelling thresholds for added sugar',
    desc: 'Draft revises the added-sugar threshold that triggers front-of-pack disclosure for packaged beverages and snacks in India.',
    tags: ['Labelling', 'India'],
    impact: 'FOP labels may change across the India snack portfolio',
    region: 'India', stage: 'Draft — comment period',
    enforce: 'Est. 2026, 12-month transition', lead: '~120 days to comment',
    detail: 'A draft amendment lowers the added-sugar threshold at which a front-of-pack indicator becomes mandatory. Products currently just under the old line could cross the new one, changing on-pack presentation and consumer perception. An open comment period precedes finalisation.',
    skus: [
      { name: 'Cola regular (India)', market: 'IN', dep: 'Above proposed line', risk: 'high' },
      { name: 'Fruit-flavoured snack', market: 'IN', dep: 'Just below line', risk: 'med' }
    ]
  },
  {
    id: 'fda-packaging-additive',
    sev: 'critical', reg: 'FDA', when: '1d ago',
    focus: 'Sustainable packaging',
    title: 'FDA proposes phase-out timeline for a packaging additive (food-contact)',
    desc: 'A food-contact substance used in certain flexible packaging is proposed for phased restriction over migration concerns.',
    tags: ['Sustainable packaging', 'Food-contact', 'US'],
    impact: 'Flexible-film supplier qualification may be affected',
    region: 'United States', stage: 'Proposed rule',
    enforce: 'Phased over 24 months', lead: '~90 days to comment',
    detail: 'The proposal targets a food-contact additive present in some flexible-film structures. Migration limits would tighten on a phased schedule. Packaging and supplier-qualification teams would need lead time to validate compliant alternatives without compromising barrier performance.',
    skus: [
      { name: 'Flexible-film snack packs', market: 'US', dep: 'Uses affected additive', risk: 'high' }
    ]
  },
  {
    id: 'fda-gras-sweetener',
    sev: 'high', reg: 'FDA', when: '1d ago',
    focus: 'Sugar reduction',
    title: 'FDA GRAS notice filed for a novel plant-based sweetener',
    desc: 'A new GRAS notification signals a plant-derived sweetener moving toward US market availability.',
    tags: ['Sugar reduction', 'Functional ingredients', 'US'],
    impact: 'Potential new reformulation lever — opportunity',
    region: 'United States', stage: 'GRAS notice submitted',
    enforce: 'N/A — opportunity signal', lead: 'Early — pre-availability',
    detail: 'A supplier has filed a GRAS notification for a plant-based sweetener. If it clears, it becomes a usable reformulation tool in the US without full pre-market approval — a positive signal worth tracking as a sourcing and formulation option.',
    skus: []
  },
  {
    id: 'codex-colour-additive',
    sev: 'high', reg: 'Codex', when: '2d ago',
    focus: 'Labelling / reformulation',
    title: 'Codex committee revisits maximum levels for a colour additive',
    desc: 'A Codex committee has tabled revised maximum levels for a colour additive used in some snack coatings.',
    tags: ['Label simplification', 'Snacks', 'Global'],
    impact: 'May influence multiple national regimes downstream',
    region: 'Global reference', stage: 'Committee discussion',
    enforce: 'Non-binding; influences national rules', lead: 'Long horizon',
    detail: 'Codex sets reference standards many national regulators later align to. A revision to permitted colour-additive levels is under committee discussion. While non-binding, it is an early indicator of where national rules may head, giving a long planning runway.',
    skus: []
  },
  {
    id: 'efsa-fermentation-protein',
    sev: 'high', reg: 'EFSA', when: '3d ago',
    focus: 'Functional ingredients',
    title: 'EFSA novel-food dossier accepted for a fermentation-derived protein',
    desc: 'A dossier for a precision-fermentation protein has been accepted for evaluation in the EU.',
    tags: ['Functional ingredients', 'Protein', 'EU'],
    impact: 'Watch for future functional-ingredient sourcing',
    region: 'European Union', stage: 'Dossier under evaluation',
    enforce: 'Multi-year evaluation', lead: 'Long horizon',
    detail: 'A novel-food dossier for a fermentation-derived protein has entered evaluation. Approval would open a new functional-ingredient sourcing avenue in the EU, though the evaluation timeline is measured in years — a strategic watch rather than a near-term action.',
    skus: []
  },
  {
    id: 'fssai-recycled-content',
    sev: 'watch', reg: 'FSSAI', when: '4d ago',
    focus: 'Sustainable packaging',
    title: 'FSSAI consultation on recycled-content requirements for packaging',
    desc: 'Early consultation on minimum recycled-content thresholds for certain packaging formats in India.',
    tags: ['Sustainable packaging', 'EPR', 'India'],
    impact: 'Long-lead packaging planning input',
    region: 'India', stage: 'Early consultation',
    enforce: 'Not yet scheduled', lead: 'Long horizon',
    detail: 'An early-stage consultation explores minimum recycled-content requirements. No timeline is set, but it signals direction of travel for packaging strategy in India and feeds long-lead material scouting.',
    skus: []
  },
  {
    id: 'efsa-fibre-claim',
    sev: 'watch', reg: 'EFSA', when: '5d ago',
    focus: 'Functional ingredients',
    title: 'EFSA opinion clarifies health-claim wording for a fibre ingredient',
    desc: 'An updated scientific opinion refines the conditions for a digestive-health claim on a fibre ingredient.',
    tags: ['Functional ingredients', 'Health claims', 'EU'],
    impact: 'Could enable an on-pack claim — opportunity',
    region: 'European Union', stage: 'Opinion published',
    enforce: 'N/A — enabling', lead: 'Available now',
    detail: 'A refined opinion clarifies the evidence conditions under which a digestive-health claim may be made for a fibre ingredient. Meeting those conditions could unlock a substantiated on-pack claim, supporting positive-nutrition positioning.',
    skus: []
  }
];

// Focus areas tracked, used by portfolio view + coverage bars.
export const FOCUS_AREAS = [
  'Sugar reduction',
  'Sodium reduction',
  'Functional ingredients',
  'Sustainable packaging',
  'Labelling / reformulation'
];

export const REGULATORS = ['FSSAI', 'FDA', 'EFSA', 'Codex'];
