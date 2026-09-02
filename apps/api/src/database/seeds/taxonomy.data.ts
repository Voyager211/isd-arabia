/**
 * Seed taxonomy (PROJECT_PLAN.md §6.1–6.3).
 *
 * This runs once at setup to give the client a tree to hang products on. From
 * that point the admin UI owns the taxonomy — re-running the seed must not
 * clobber their edits, which is why the runner upserts by slug and never
 * touches an existing record's editable fields.
 */

export interface SeedCategory {
  name: string;
  /** Level-2 leaves. Omitted on a leaf. */
  children?: SeedCategory[];
  /**
   * Flat categories exist for the filter sidebar but stay out of the
   * mega-menu, which only has room for the two main product lines.
   */
  showInMenu?: boolean;
}

/** WELDING and TOOLS & EQUIPMENT — the two mega-menu trees. */
export const SEED_CATEGORY_TREE: SeedCategory[] = [
  {
    name: 'Welding',
    children: [
      {
        name: 'Consumables',
        children: [
          { name: 'Fire Blankets' },
          { name: 'Welding Helmets & Masks' },
          { name: 'Fibre Glass Tapes' },
          { name: 'Purging Paper' },
          { name: 'Chipping Hammers' },
          { name: 'Welding Curtains' },
          { name: 'Electrode Ovens' },
        ],
      },
      {
        name: 'TIG Welding',
        children: [
          { name: 'TIG Torches & Kits' },
          { name: 'Ceramic Nozzles' },
          { name: 'Tungsten Electrodes' },
        ],
      },
      {
        name: 'MIG Welding',
        children: [{ name: 'Contact Tips' }, { name: 'Jerrycans' }],
      },
      {
        name: 'Arc Welding',
        children: [
          { name: 'Welding Holders' },
          { name: 'Grounding Clamps' },
          { name: 'Welding Rods' },
          { name: 'Cable Adapters' },
          { name: 'Wrap Around' },
          { name: 'Cable Connectors' },
        ],
      },
      {
        name: 'Gas Welding & Cutting',
        children: [
          { name: 'Welding Regulators' },
          { name: 'Welding Electrodes' },
          { name: 'Welding Nozzles' },
          { name: 'Heating Nozzles' },
          { name: 'Twin Hoses' },
          { name: 'Torch Accessories' },
          { name: 'Cylinder Trolleys' },
        ],
      },
    ],
  },
  {
    name: 'Tools & Equipment',
    children: [
      {
        name: 'Safety',
        children: [
          { name: 'Finger Guards' },
          { name: 'Tool Lanyards' },
          { name: 'Safety Gloves' },
          { name: 'Aprons & Sleeves' },
          { name: 'Face Shields & Headgear' },
          { name: 'Safety Padlocks' },
          { name: 'Face Masks' },
          { name: 'Suspension Trauma Straps' },
          { name: 'Safety Harnesses' },
        ],
      },
      {
        name: 'Scaffolding Tools',
        children: [
          { name: 'Scaffolding Buckets' },
          { name: 'Scaffolding Bags' },
          { name: 'Scaffolding Spanners' },
          { name: 'Scaffolding Belts' },
          { name: 'Aramco Scaff Tags' },
          { name: 'Aramco Tag Holders' },
          { name: 'Flame Resistant Face Hoods' },
        ],
      },
      {
        name: 'Wire Brushes',
        children: [
          { name: 'Cup Brushes' },
          { name: 'Wheel Brushes' },
          { name: 'End Brushes' },
          { name: '4-Row Wire Brushes' },
          { name: 'Non-Sparking Shovels' },
          { name: 'Hose Repair Kits' },
        ],
      },
      {
        name: 'Tooling & Cutting',
        children: [
          { name: 'Magnetic Cutters' },
          { name: 'Pilot Pins' },
          { name: 'Carbide Burrs' },
          { name: 'Diamond Cutting Discs' },
          { name: 'Diamond Grinding Discs' },
          { name: 'Stainless Steel Files' },
          { name: 'Cutting & Grinding Discs' },
          { name: 'Flap Wheels & Discs' },
        ],
      },
    ],
  },
];

/**
 * Flat top-level categories for the filter sidebar only (§6.1).
 * `showInMenu: false` keeps them out of the mega-menu.
 */
export const SEED_FLAT_CATEGORIES: SeedCategory[] = [
  { name: 'Chemicals', showInMenu: false },
  { name: 'Measurement Tools', showInMenu: false },
  { name: 'Non-Sparking Tools', showInMenu: false },
  { name: 'Adhesives', showInMenu: false },
  { name: 'Abrasives', showInMenu: false },
  { name: 'Hardware', showInMenu: false },
  { name: 'Metal Markers', showInMenu: false },
  { name: 'Hand Tools', showInMenu: false },
];

/** §6.2 */
export const SEED_BRANDS: string[] = [
  'KASWELD',
  'KASWELD PREMIUM',
  'KASPRO',
  'KASPRO PREMIUM',
  'MARKAL',
  'ESAB',
  'AQUASOL',
  'EMTEK',
  'MOLYKOTE',
  'STERWISE',
];

/** §6.3 */
export const SEED_INDUSTRIES: { name: string; description: string }[] = [
  {
    name: 'Steel Construction',
    description:
      'Structural fabrication and erection — welding consumables, cutting discs and fall-protection equipment for steel frame projects.',
  },
  {
    name: 'Manufacturing',
    description:
      'Production line consumables and MRO supply for fabrication shops and process plants.',
  },
  {
    name: 'Pipelines',
    description:
      'Pipeline welding and inspection consumables, purging materials and root-pass supplies.',
  },
  {
    name: 'Ship Building',
    description:
      'Marine fabrication and repair — corrosion-resistant consumables and confined-space safety equipment.',
  },
  {
    name: 'Railway',
    description:
      'Rolling stock and track maintenance consumables, cutting tools and non-sparking equipment.',
  },
  {
    name: 'Oil & Gas',
    description:
      'Upstream and downstream supply — Aramco-compliant scaffolding tags, non-sparking tools and welding consumables.',
  },
  {
    name: 'Petrochemical',
    description:
      'Plant turnaround and shutdown supply, flame-resistant PPE and specialised welding consumables.',
  },
  {
    name: 'Repair & Maintenance',
    description: 'General MRO consumables for facilities, workshops and maintenance contractors.',
  },
  {
    name: 'Power Generation',
    description:
      'Boiler, turbine and transmission maintenance — high-temperature consumables and safety equipment.',
  },
];
