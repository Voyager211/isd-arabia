/**
 * Generator for realistic demo products.
 *
 * Two jobs, and they pull in the same direction:
 *
 *   1. Give the client something to click through before they have entered
 *      any real data — an empty catalogue is impossible to evaluate.
 *   2. Provide the volume needed to verify the `$facet` aggregation and the
 *      listing indexes at catalogue scale (PROJECT_PLAN.md §17.1 risk 4).
 *
 * The names are deliberately plausible rather than random: `lorem ipsum` in a
 * product grid hides exactly the layout problems this data exists to expose —
 * a two-line product name wrapping to three, a part number too long for its
 * column.
 */

/** Per-category name fragments, so a nozzle is never called a "Trolley". */
const PATTERNS: Record<string, { nouns: string[]; qualifiers: string[]; prefix: string }> = {
  default: {
    nouns: ['Assembly', 'Kit', 'Set', 'Unit'],
    qualifiers: ['Standard', 'Heavy Duty', 'Industrial', 'Professional'],
    prefix: 'GEN',
  },
  'tig-torches-kits': {
    nouns: ['TIG Torch WP-17', 'TIG Torch WP-26', 'TIG Torch WP-9', 'Torch Body Kit'],
    qualifiers: ['Air Cooled', 'Water Cooled', 'Flexible Head', '4m Lead', '8m Lead'],
    prefix: 'WP',
  },
  'ceramic-nozzles': {
    nouns: ['Ceramic Nozzle #4', 'Ceramic Nozzle #5', 'Ceramic Nozzle #6', 'Gas Lens Nozzle'],
    qualifiers: ['Alumina', 'Long Reach', 'Standard', 'Pyrex'],
    prefix: 'CN',
  },
  'tungsten-electrodes': {
    nouns: ['Tungsten Electrode 1.6mm', 'Tungsten Electrode 2.4mm', 'Tungsten Electrode 3.2mm'],
    qualifiers: ['2% Thoriated', '2% Lanthanated', '2% Ceriated', 'Pure'],
    prefix: 'TE',
  },
  'contact-tips': {
    nouns: ['Contact Tip M6', 'Contact Tip M8', 'Contact Tip M10'],
    qualifiers: ['0.8mm', '1.0mm', '1.2mm', '1.6mm', 'Heavy Duty'],
    prefix: 'CT',
  },
  'safety-gloves': {
    nouns: ['Welding Gauntlet', 'Rigger Glove', 'Cut Resistant Glove', 'Heat Resistant Glove'],
    qualifiers: ['Size 9', 'Size 10', 'Size 11', 'Kevlar Stitched', 'Leather'],
    prefix: 'SG',
  },
  'cutting-grinding-discs': {
    nouns: ['Cutting Disc 115mm', 'Cutting Disc 230mm', 'Grinding Disc 125mm'],
    qualifiers: ['1.0mm', '2.5mm', '6.0mm', 'Stainless', 'Inox'],
    prefix: 'CD',
  },
  'welding-helmets-masks': {
    nouns: ['Auto-Darkening Helmet', 'Passive Welding Helmet', 'Flip-Front Helmet'],
    qualifiers: ['Shade 9-13', 'Shade 10', 'Large View', 'Grind Mode'],
    prefix: 'WH',
  },
};

const UNITS = ['piece', 'pack', 'box', 'roll', 'metre', 'set'] as const;
const AVAILABILITY = ['in_stock', 'made_to_order', 'on_request'] as const;

export interface GeneratedProduct {
  name: string;
  sku: string;
  shortDescription: string;
  description: string;
  keyFeatures: string[];
  specifications: { label: string; value: string }[];
  unit: (typeof UNITS)[number];
  minOrderQuantity: number;
  availability: (typeof AVAILABILITY)[number];
  isFeatured: boolean;
  isNewArrival: boolean;
}

/**
 * A tiny deterministic PRNG.
 *
 * Seeded so a given run is reproducible: when a performance number moves, the
 * data is not what changed.
 */
function createRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100_000) / 100_000;
  };
}

export function generateProducts(
  categorySlug: string,
  count: number,
  seed: number,
): GeneratedProduct[] {
  const random = createRandom(seed);
  const pattern = PATTERNS[categorySlug] ?? PATTERNS.default;
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];

  const products: GeneratedProduct[] = [];
  const usedNames = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    const noun = pick(pattern.nouns);
    const qualifier = pick(pattern.qualifiers);

    let name = `${noun} — ${qualifier}`;
    // The SKU carries the index, so it is unique regardless; the name gets a
    // suffix only when it would otherwise repeat within the category.
    if (usedNames.has(name)) name = `${name} (${index + 1})`;
    usedNames.add(name);

    const sku = `${pattern.prefix}-${String(seed % 1000).padStart(3, '0')}-${String(index + 1).padStart(4, '0')}`;

    products.push({
      name,
      sku,
      shortDescription: `${qualifier} ${noun.toLowerCase()} for industrial welding and fabrication. Supplied across the Kingdom.`,
      description: `<p>${noun} in a ${qualifier.toLowerCase()} specification, held in stock for fast dispatch to site.</p><p>Suitable for general fabrication, maintenance and shutdown work. Contact us for volume pricing and certification requirements.</p>`,
      keyFeatures: [
        `${qualifier} specification`,
        'Stocked locally for fast dispatch',
        'Volume pricing available on request',
      ],
      specifications: [
        { label: 'Type', value: noun },
        { label: 'Specification', value: qualifier },
        { label: 'Country of origin', value: pick(['China', 'India', 'Turkey', 'Germany']) },
      ],
      unit: pick(UNITS),
      minOrderQuantity: pick([1, 1, 1, 5, 10, 25]),
      availability: pick(AVAILABILITY),
      // Roughly 6% featured and 12% new — enough to fill the home page rails
      // without every product carrying a badge.
      isFeatured: random() < 0.06,
      isNewArrival: random() < 0.12,
    });
  }

  return products;
}
