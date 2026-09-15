import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Demo product imagery.
 *
 * `seed-demo-images.ts` searches Wikimedia Commons for freely licensed photos,
 * uploads them to Cloudinary and records the result in the manifest below. The
 * demo product seed reads that manifest, so the network-heavy step runs once
 * and every later `seed:demo` is fast and offline from Commons.
 *
 * Only Cloudinary URLs end up on products: the storefront's `next/image`
 * config allows `res.cloudinary.com` and nothing else.
 */

export interface DemoImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  alt: string;
  /** CC BY / BY-SA require attribution — kept so it is never lost. */
  credit: { title: string; author: string; license: string; source: string };
}

/** Keyed by category slug. */
export type DemoImageManifest = Record<string, DemoImage[]>;

export const DEMO_IMAGE_MANIFEST_PATH = join(__dirname, 'demo-images.manifest.json');

export function readDemoImageManifest(): DemoImageManifest {
  if (!existsSync(DEMO_IMAGE_MANIFEST_PATH)) return {};
  return JSON.parse(readFileSync(DEMO_IMAGE_MANIFEST_PATH, 'utf8')) as DemoImageManifest;
}

/**
 * Commons search terms per leaf category, most specific first.
 *
 * A term must appear in a file's title as a phrase to count (see
 * `titleMatches`), so each list ends in broader terms that still name the right
 * kind of object. Several category names are trade jargon ("Wrap Around",
 * "Aramco Scaff Tags") that match nothing on Commons and go straight to the
 * closest photographable thing. A category missing from this map searches by
 * its own name.
 */
export const DEMO_IMAGE_QUERIES: Record<string, string[]> = {
  'Fire Blankets': ['fire blanket', 'welding blanket', 'fire extinguisher'],
  'Welding Helmets & Masks': ['welding helmet', 'welding mask', 'welding goggles'],
  'Fibre Glass Tapes': ['fiberglass tape', 'glass fiber', 'fiberglass fabric', 'fiberglass roll'],
  'Purging Paper': ['pipe welding', 'orbital welding', 'weld pipe'],
  'Chipping Hammers': ['chipping hammer', 'welding hammer', 'ball-peen hammer', 'hammer tool'],
  'Welding Curtains': ['welding curtain', 'welding screen', 'welding booth', 'welding workshop'],
  'Electrode Ovens': ['welding electrodes', 'welding rods', 'welding electrode'],

  'TIG Torches & Kits': ['TIG torch', 'TIG welding', 'WIG welding', 'TIG welder', 'GTAW'],
  'Ceramic Nozzles': ['TIG nozzle', 'ceramic nozzle', 'tungsten inert gas welding'],
  'Tungsten Electrodes': [
    'tungsten electrode',
    'welding tungsten',
    'tungsten rod',
    'gas tungsten arc welding',
  ],

  'Contact Tips': ['MIG torch', 'MIG welding', 'GMAW', 'metal arc welding'],
  Jerrycans: ['jerrycan', 'jerry can', 'fuel can'],

  'Welding Holders': ['electrode holder', 'stick welding', 'arc welding'],
  'Grounding Clamps': ['ground clamp', 'earth clamp', 'welding clamp', 'C-clamp', 'G-clamp'],
  'Welding Rods': ['welding rods', 'welding rod', 'welding wire', 'arc welding'],
  'Cable Adapters': ['welding cable', 'cable lug', 'battery cable', 'power cable'],
  'Wrap Around': ['pipe fitting', 'pipe welding', 'pipe fittings'],
  'Cable Connectors': ['cable lug', 'crimp terminal', 'power connector', 'welding cable'],

  'Welding Regulators': ['oxygen regulator', 'gas regulator', 'pressure regulator'],
  'Welding Electrodes': ['shielded metal arc welding', 'stick electrode', 'welding electrodes'],
  'Welding Nozzles': ['cutting torch', 'oxy-fuel cutting', 'oxy-fuel welding', 'brazing torch'],
  'Heating Nozzles': ['oxy-acetylene torch', 'oxy-fuel welding', 'propane torch', 'blowtorch'],
  'Twin Hoses': ['welding hose', 'acetylene hose', 'gas welding', 'oxy-fuel welding'],
  'Torch Accessories': [
    'welding torch',
    'oxy-acetylene torch',
    'cutting torch',
    'gas torch',
    'blowtorch',
  ],
  'Cylinder Trolleys': [
    'cylinder trolley',
    'cylinder cart',
    'hand truck',
    'sack truck',
    'oxygen cylinder',
  ],

  'Finger Guards': ['cut resistant glove', 'cut-resistant gloves', 'kevlar glove', 'work gloves'],
  'Tool Lanyards': ['tool lanyard', 'safety lanyard', 'carabiner', 'carabiners'],
  'Safety Gloves': ['safety gloves', 'welding gloves', 'leather gloves', 'work gloves'],
  'Aprons & Sleeves': ['welding apron', 'leather apron', 'blacksmith apron', 'work apron'],
  'Face Shields & Headgear': ['face shield', 'hard hat', 'safety helmet'],
  'Safety Padlocks': ['lockout tagout', 'lockout', 'safety padlock', 'padlock'],
  'Face Masks': ['dust mask', 'N95 respirator', 'half mask respirator', 'gas mask'],
  'Suspension Trauma Straps': [
    'fall arrest',
    'safety harness',
    'fall protection',
    'climbing harness',
  ],
  'Safety Harnesses': ['safety harness', 'fall protection', 'climbing harness'],

  'Scaffolding Buckets': [
    'builders bucket',
    'construction bucket',
    'metal bucket',
    'rubber bucket',
  ],
  'Scaffolding Bags': ['tool bag', 'canvas bag', 'tool bags'],
  'Scaffolding Spanners': ['ratchet spanner', 'scaffold spanner', 'spanner', 'wrench'],
  'Scaffolding Belts': ['tool belt', 'safety belt', 'work belt', 'utility belt'],
  'Aramco Scaff Tags': ['scaffolding', 'scaffolding tube', 'scaffold construction'],
  'Aramco Tag Holders': ['scaffolding coupler', 'scaffolding clamp', 'scaffolding'],
  'Flame Resistant Face Hoods': [
    'fire hood',
    'firefighter hood',
    'nomex hood',
    'welding hood',
    'firefighter protective',
    'firefighter helmet',
    'fire helmet',
  ],

  'Cup Brushes': ['cup brush', 'wire cup brush', 'wire brush', 'grinder brush'],
  'Wheel Brushes': ['wire wheel brush', 'wheel brush', 'wire brush', 'bench grinder'],
  'End Brushes': ['end brush', 'drill brush', 'rotary brush', 'wire brushes', 'brass brush'],
  '4-Row Wire Brushes': ['wire brush', 'steel wire brush', 'brass brush', 'hand brush'],
  'Non-Sparking Shovels': ['shovel', 'spade', 'shovels'],
  'Hose Repair Kits': ['hose clamp', 'hose clamps', 'hose fitting', 'hose'],

  'Magnetic Cutters': ['magnetic drill', 'annular cutter', 'drilling machine'],
  'Pilot Pins': ['annular cutter', 'hole saw', 'drill bit', 'drill bits'],
  'Carbide Burrs': ['carbide burr', 'rotary burr', 'burr cutter', 'die grinder', 'rotary tool'],
  'Diamond Cutting Discs': ['diamond blade', 'diamond saw', 'cutting disc', 'saw blade'],
  'Diamond Grinding Discs': [
    'diamond grinding',
    'diamond cup wheel',
    'grinding disc',
    'bench grinder',
  ],
  'Stainless Steel Files': ['metal file', 'hand file', 'needle file', 'rasp'],
  'Cutting & Grinding Discs': [
    'cutting disc',
    'grinding disc',
    'angle grinder',
    'abrasive disc',
    'cut-off wheel',
  ],
  'Flap Wheels & Discs': ['flap disc', 'flap wheel', 'faecherschleifscheibe', 'sanding disc'],

  Chemicals: ['lubricant spray', 'aerosol can', 'WD-40', 'spray can', 'chemical drum'],
  'Measurement Tools': ['vernier caliper', 'caliper', 'measuring tape', 'micrometer'],
  'Non-Sparking Tools': [
    'brass hammer',
    'non-sparking tool',
    'copper hammer',
    'brass wrench',
    'spark-proof',
    'mallet',
    'sledgehammer',
    'claw hammer',
  ],
  Adhesives: ['epoxy', 'adhesive', 'glue'],
  Abrasives: ['sandpaper', 'abrasive', 'sanding paper', 'grinding stone'],
  Hardware: ['bolts nuts', 'nuts and bolts', 'hex bolt', 'screws', 'fasteners'],
  'Metal Markers': ['paint marker', 'marker pen', 'permanent marker', 'soapstone'],
  'Hand Tools': ['hand tools', 'wrench', 'pliers', 'screwdriver'],
};
