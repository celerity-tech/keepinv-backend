import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in environment.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: DATABASE_URL })),
});

// This catalog belongs to Rapido Motorsiklo Garage. Pass the org's id via RAPIDO_ORG_ID — the id
// returned when you provision the org in Postman. Seeds run under that tenant so RLS allows the
// writes and organization_id resolves via the column default.
if (!process.env.RAPIDO_ORG_ID) {
  console.error(
    'Missing RAPIDO_ORG_ID. Set it to the Rapido organization id, e.g.\n' +
      '  RAPIDO_ORG_ID=<org-uuid> bun prisma/seed-motorshop-products.ts',
  );
  process.exit(1);
}
const ORGANIZATION_ID: string = process.env.RAPIDO_ORG_ID;

const CATEGORY_SEEDS = {
  // --- Original cable categories ---
  clutch: {
    name: 'Clutch Cable',
    description: 'Motorcycle clutch control cables',
  },
  brake: {
    name: 'Brake Cable',
    description: 'Motorcycle brake control cables',
  },
  speedometer: {
    name: 'Speedometer Cable',
    description: 'Motorcycle speedometer drive cables',
  },
  // --- Motorshop part categories (from inventory notebook) ---
  throttleCable: {
    name: 'Throttle Cable',
    description: 'Motorcycle throttle control cables',
  },
  engineValve: {
    name: 'Engine Valve',
    description: 'Intake and exhaust engine valves',
  },
  oilFilter: {
    name: 'Oil Filter',
    description: 'Engine oil filters and strainers',
  },
  ignitionSwitch: {
    name: 'Ignition Switch',
    description: 'Key ignition switch assemblies',
  },
  tankCap: {
    name: 'Tank Cap',
    description: 'Fuel tank caps',
  },
  clutchLining: {
    name: 'Clutch Lining',
    description: 'Clutch friction plates and linings',
  },
  relay: {
    name: 'Relay',
    description: 'Starter, horn and flasher relays',
  },
  brakePad: {
    name: 'Brake Pad',
    description: 'Disc brake pads',
  },
  brakeShoe: {
    name: 'Brake Shoe',
    description: 'Drum brake shoes',
  },
  ignitionCoil: {
    name: 'Ignition Coil',
    description: 'Ignition and charge coils',
  },
  primaryCoil: {
    name: 'Primary Coil',
    description: 'Primary / magneto coils',
  },
  timingChain: {
    name: 'Timing Chain',
    description: 'Cam timing chains, guides and starter chains',
  },
  lever: {
    name: 'Lever',
    description: 'Brake and clutch levers and handle assemblies',
  },
  battery: {
    name: 'Battery',
    description: 'Motorcycle batteries',
  },
  regulator: {
    name: 'Regulator',
    description: 'Voltage regulator / rectifiers',
  },
  cdi: {
    name: 'CDI',
    description: 'Capacitor discharge ignition units',
  },
  stator: {
    name: 'Stator',
    description: 'Stator / magneto assemblies',
  },
  carburetorKit: {
    name: 'Carburetor Kit',
    description: 'Carburetor repair kits',
  },
  carburetor: {
    name: 'Carburetor',
    description: 'Complete carburetor assemblies',
  },
  connectingRod: {
    name: 'Connecting Rod',
    description: 'Connecting rods / crank kits',
  },
  camshaft: {
    name: 'Camshaft',
    description: 'Engine camshafts',
  },
  rockerArm: {
    name: 'Rocker Arm',
    description: 'Valve rocker arms',
  },
  camFollower: {
    name: 'Cam Follower',
    description: 'Cam followers',
  },
  cylinderBlock: {
    name: 'Cylinder Block',
    description: 'Cylinder blocks / big bore kits',
  },
  brakeRod: {
    name: 'Brake Rod',
    description: 'Rear drum brake rods',
  },
  wireHarness: {
    name: 'Wire Harness',
    description: 'Main wiring harnesses',
  },
  axle: {
    name: 'Axle',
    description: 'Front, rear and main stand axles / shafts',
  },
  piston: {
    name: 'Piston',
    description: 'Pistons and piston ring sets',
  },
  instrument: {
    name: 'Speedometer & Meter Assembly',
    description: 'Speedometer gauges, crown pieces and instrument cluster assemblies',
  },
  lighting: {
    name: 'Lighting',
    description: 'Headlight and tail light assemblies',
  },
  // --- Consumables (bulk, non-serialized) ---
  engineOil: {
    name: 'Engine Oil',
    description: 'Engine oils and 2T oils (consumable)',
  },
  coolant: {
    name: 'Coolant',
    description: 'Radiator coolant (consumable)',
  },
  sprayChemical: {
    name: 'Spray & Chemicals',
    description: 'Spray paints, cleaners and aerosol chemicals (consumable)',
  },
  tube: {
    name: 'Tube',
    description: 'Inner tubes (consumable)',
  },
  bearing: {
    name: 'Bearing',
    description: 'Standard ball bearings (consumable)',
  },
  knuckleBearing: {
    name: 'Knuckle Bearing',
    description: 'Steering / knuckle bearings (consumable)',
  },
} as const;

type CategoryKey = keyof typeof CATEGORY_SEEDS;

type ProductSeed = {
  name: string;
  sku: string;
  brand?: string;
  categoryKey: CategoryKey;
  // Defaults to false to preserve original cable-seed behavior.
  isSerialized?: boolean;
};

// Naming standard (so the catalog displays alphabetically by part type, number/spec AFTER the
// name, brand/qualifier last in parens):  "<Part Type> <Model/Spec> [<Sub-descriptor>] [(<Brand>)]"
//   e.g. "Battery 12N5L (OD)", "Carburetor 24mm", "Brake Pad Wave 125 (TTGR)".
// Lead every name with its category's part-type label; keep the model/spec and any qualifier after.

// Original cable products (standardized to part-type-first naming).
const PRODUCT_SEEDS: ProductSeed[] = [
  { name: 'Clutch Cable HD3 (KNC)', sku: 'CLT-HD3-KNC', brand: 'KNC', categoryKey: 'clutch' },
  { name: 'Clutch Cable GR125 (KNC)', sku: 'CLT-GR125-KNC', brand: 'KNC', categoryKey: 'clutch' },
  { name: 'Clutch Cable Rouser 135 L-TE (UH)', sku: 'CLT-RS135-UH', brand: 'UH', categoryKey: 'clutch' },
  { name: 'Clutch Cable Raider 150 (1101)', sku: 'CLT-RDR150-1101', brand: '1101', categoryKey: 'clutch' },
  { name: 'Clutch Cable Raider 150 Fi (Valiant)', sku: 'CLT-RDR150FI-VLT', brand: 'Valiant', categoryKey: 'clutch' },
  { name: 'Clutch Cable Sniper 150 (Kryon)', sku: 'CLT-SNP150-KRY', brand: 'Kryon', categoryKey: 'clutch' },
  { name: 'Brake Cable YMX 125 Alpha (KNC)', sku: 'BRK-YMX125-KNC', brand: 'KNC', categoryKey: 'brake' },
  { name: 'Brake Cable Barako 175 (KNC)', sku: 'BRK-BRK175-KNC', brand: 'KNC', categoryKey: 'brake' },
  { name: 'Brake Cable Barako 175 (Otaka)', sku: 'BRK-BRK175-OTK', brand: 'Otaka', categoryKey: 'brake' },
  { name: 'Brake Cable HD3 (KNC)', sku: 'BRK-HD3-KNC', brand: 'KNC', categoryKey: 'brake' },
  { name: 'Brake Cable Wygo', sku: 'BRK-WYGO', categoryKey: 'brake' },
  { name: 'Brake Cable Wave 100 (GRR)', sku: 'BRK-WAVE100-GRR', brand: 'GRR', categoryKey: 'brake' },
  { name: 'Brake Cable Beat Fi (Zecheng)', sku: 'BRK-BEATFI-ZCH', brand: 'Zecheng', categoryKey: 'brake' },
  { name: 'Brake Cable Click 125 (Otaka)', sku: 'BRK-CLICK125-OTK', brand: 'Otaka', categoryKey: 'brake' },
  { name: 'Brake Cable Mio 125 (Otaka)', sku: 'BRK-MIO125-OTK', brand: 'Otaka', categoryKey: 'brake' },
  { name: 'Brake Cable Mio (Otaka)', sku: 'BRK-MIO-OTK', brand: 'Otaka', categoryKey: 'brake' },
  { name: 'Brake Cable RM100 (YHK)', sku: 'BRK-RM100-YHK', brand: 'YHK', categoryKey: 'brake' },
  { name: 'Speedometer Cable RM100 (Eiko)', sku: 'SPD-RM100-EIKO', brand: 'Eiko', categoryKey: 'speedometer' },
  { name: 'Speedometer Cable Rouser 135 (Ortaine)', sku: 'SPD-RS135-ORT', brand: 'Ortaine', categoryKey: 'speedometer' },
  { name: 'Speedometer Cable Rmahn 110 (Makoto)', sku: 'SPD-RMAHN110-MKT', brand: 'Makoto', categoryKey: 'speedometer' },
  { name: 'Speedometer Cable Rmahn 115 (Makoto)', sku: 'SPD-RMAHN115-MKT', brand: 'Makoto', categoryKey: 'speedometer' },
  { name: 'Speedometer Cable Raider J 110 (Makoto)', sku: 'SPD-RDRJ110-MKT', brand: 'Makoto', categoryKey: 'speedometer' },
];

// Motorshop products transcribed from the inventory notebook.
// All hard parts default to serialized; consumables are flagged non-serialized.
// Quantities intentionally start at 0 (notebook counts are not seeded).
const MOTORSHOP_PRODUCT_SEEDS: ProductSeed[] = [
  // --- Engine Valve ---
  { name: 'Engine Valve TMX (Halo)', sku: 'EV-TMX-HALO', brand: 'Halo', categoryKey: 'engineValve', isSerialized: true },
  { name: 'Engine Valve BC175 (Halo)', sku: 'EV-BC175-HALO', brand: 'Halo', categoryKey: 'engineValve', isSerialized: true },
  { name: 'Engine Valve YTX 125 (Makoto)', sku: 'EV-YTX125-MKT', brand: 'Makoto', categoryKey: 'engineValve', isSerialized: true },
  { name: 'Engine Valve CT150 (Takarago)', sku: 'EV-CT150-TKR', brand: 'Takarago', categoryKey: 'engineValve', isSerialized: true },
  { name: 'Engine Valve XRM (Koza)', sku: 'EV-XRM-KOZA', brand: 'Koza', categoryKey: 'engineValve', isSerialized: true },

  // --- Oil Filter ---
  { name: 'Oil Filter Bajaj / Kawasaki', sku: 'OF-BAJAJ-KAW', categoryKey: 'oilFilter', isSerialized: true },
  { name: 'Oil Filter Suzuki', sku: 'OF-SUZUKI', categoryKey: 'oilFilter', isSerialized: true },
  { name: 'Oil Filter Kawasaki', sku: 'OF-KAWASAKI', categoryKey: 'oilFilter', isSerialized: true },
  { name: 'Oil Filter Yamaha', sku: 'OF-YAMAHA', categoryKey: 'oilFilter', isSerialized: true },

  // --- Ignition Switch ---
  { name: 'Ignition Switch LF110 (KNC)', sku: 'IGS-LF110-KNC', brand: 'KNC', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch Wave 125 (TUR)', sku: 'IGS-WAVE125-TUR', brand: 'TUR', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch Raider 150 (Kitaco)', sku: 'IGS-R150-KTC', brand: 'Kitaco', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch YMX (Kitaco)', sku: 'IGS-YMX-KTC', brand: 'Kitaco', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch TMX / Supremo (CHL)', sku: 'IGS-TMXSUP-CHL', brand: 'CHL', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch LF150 (Kujira)', sku: 'IGS-LF150-KJR', brand: 'Kujira', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch TMX 125 (Kitaco)', sku: 'IGS-TMX125-KTC', brand: 'Kitaco', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch TMX Alpha (Kujira)', sku: 'IGS-TMXALP-KJR', brand: 'Kujira', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch HD3 (Ant)', sku: 'IGS-HD3-ANT', brand: 'Ant', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch Wave 125 (TTGR)', sku: 'IGS-WAVE125-TTGR', brand: 'TTGR', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch XRM 110 (CHL)', sku: 'IGS-XRM110-CHL', brand: 'CHL', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch XRM 110 (No Brand)', sku: 'IGS-XRM110-NB', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch Barako (TTGR)', sku: 'IGS-BARAKO-TTGR', brand: 'TTGR', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch XRM 125 (Kujira)', sku: 'IGS-XRM125-KJR', brand: 'Kujira', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch Wave 110R (Wuntal)', sku: 'IGS-WAVE110R-WTL', brand: 'Wuntal', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch Mio Soul (TTGR)', sku: 'IGS-MIOSOUL-TTGR', brand: 'TTGR', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Ignition Switch Mio (TTGR)', sku: 'IGS-MIO-TTGR', brand: 'TTGR', categoryKey: 'ignitionSwitch', isSerialized: true },

  // --- Tank Cap ---
  { name: 'Tank Cap TMX (FMP)', sku: 'TNK-TMX-FMP', brand: 'FMP', categoryKey: 'tankCap', isSerialized: true },
  { name: 'Tank Cap TMX Het (FMP)', sku: 'TNK-TMXHET-FMP', brand: 'FMP', categoryKey: 'tankCap', isSerialized: true },
  { name: 'Tank Cap Barako (Kryon)', sku: 'TNK-BARAKO-KRY', brand: 'Kryon', categoryKey: 'tankCap', isSerialized: true },
  { name: 'Tank Cap YTX 125 (Kryon)', sku: 'TNK-YTX125-KRY', brand: 'Kryon', categoryKey: 'tankCap', isSerialized: true },
  { name: 'Tank Cap TMX Supremo (Kujira)', sku: 'TNK-TMXSUP-KJR', brand: 'Kujira', categoryKey: 'tankCap', isSerialized: true },

  // --- Clutch Lining ---
  { name: 'Clutch Lining Rmahn (Yakimoto)', sku: 'CL-RMAHN-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining XRM (Vnowar)', sku: 'CL-XRM-VNW', brand: 'Vnowar', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining HD3 (Makoto)', sku: 'CL-HD3-MKT', brand: 'Makoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining Honda', sku: 'CL-HONDA', brand: 'Honda', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining Kawasaki (Barato)', sku: 'CL-KAW-BARATO', brand: 'Kawasaki', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining Dream (Honda)', sku: 'CL-DREAM-HONDA', brand: 'Honda', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining C100 Bajaj (KNC)', sku: 'CL-C100BAJAJ-KNC', brand: 'KNC', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining Wave 125 (KNC)', sku: 'CL-WAVE125-KNC', brand: 'KNC', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining RR100 (Fukuyama)', sku: 'CL-RR100-FKY', brand: 'Fukuyama', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining Rouser 135 (Yakimoto)', sku: 'CL-RS135-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining C100 Dream (Yakimoto)', sku: 'CL-C100DREAM-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining W125 (Yakimoto)', sku: 'CL-W125-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining R150 (Yakimoto)', sku: 'CL-R150-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining Fury (Yakimoto)', sku: 'CL-FURY-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining BC175 (RLV)', sku: 'CL-BC175-RLV', brand: 'RLV', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Clutch Lining BC175 (Yakimoto)', sku: 'CL-BC175-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },

  // --- Relay ---
  { name: 'Relay R150 Starter (TTGR)', sku: 'RLY-R150STR-TTGR', brand: 'TTGR', categoryKey: 'relay', isSerialized: true },
  { name: 'Relay BC175 (TTGR)', sku: 'RLY-BC175-TTGR', brand: 'TTGR', categoryKey: 'relay', isSerialized: true },
  { name: 'Relay GYG (Yakimoto)', sku: 'RLY-GYG-YKM', brand: 'Yakimoto', categoryKey: 'relay', isSerialized: true },
  { name: 'Relay Run 150 (Yakimoto)', sku: 'RLY-RUN150-YKM', brand: 'Yakimoto', categoryKey: 'relay', isSerialized: true },
  { name: 'Relay GYG 125 (Vnowar)', sku: 'RLY-GYG125-VNW', brand: 'Vnowar', categoryKey: 'relay', isSerialized: true },
  { name: 'Relay Horn', sku: 'RLY-HORN', categoryKey: 'relay', isSerialized: true },
  { name: 'Relay Interruptor', sku: 'RLY-INTERRUPTOR', categoryKey: 'relay', isSerialized: true },
  { name: 'Relay Flasher (Round, KMN)', sku: 'RLY-FLASH-RND-KMN', brand: 'KMN', categoryKey: 'relay', isSerialized: true },
  { name: 'Relay Flasher (No Round)', sku: 'RLY-FLASH-NORND', categoryKey: 'relay', isSerialized: true },

  // --- Brake Pad ---
  { name: 'Brake Pad Click 125 / 150 (1101)', sku: 'BP-CLICK125150-1101', brand: '1101', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad ADV / PCX Rear (KNC)', sku: 'BP-PCXADV-REAR-KNC', brand: 'KNC', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad ADV / PCX Front (FMP)', sku: 'BP-ADVPCX-FRONT-FMP', brand: 'FMP', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad PCX 150 Front (KNC)', sku: 'BP-PCX150-FRONT-KNC', brand: 'KNC', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad Mio Soul / Sniper 135 (KNC)', sku: 'BP-MIOSNP135-KNC', brand: 'KNC', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad Beat / Click 125 / 150 (Kryon)', sku: 'BP-BEATCLICK-KRY', brand: 'Kryon', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad Fury (KNC)', sku: 'BP-FURY-KNC', brand: 'KNC', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad R150 Fi (KNC)', sku: 'BP-R150FI-KNC', brand: 'KNC', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad R150 Fi Front (KNC)', sku: 'BP-R150FI-FRONT-KNC', brand: 'KNC', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad Shogun / R150 Front (Kryon)', sku: 'BP-SHOGUNR150-FRONT-KRY', brand: 'Kryon', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad Wave 125 (TTGR)', sku: 'BP-WAVE125-TTGR', brand: 'TTGR', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad Mio i125 (TTGR)', sku: 'BP-MIOI125-TTGR', brand: 'TTGR', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad Rouser 220 (DHT)', sku: 'BP-RS220-DHT', brand: 'DHT', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad Beat 125 (Mihniba)', sku: 'BP-BEAT125-MHB', brand: 'Mihniba', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Brake Pad Wave 125 (Mihniba)', sku: 'BP-WAVE125-MHB', brand: 'Mihniba', categoryKey: 'brakePad', isSerialized: true },

  // --- Throttle Cable ---
  { name: 'Throttle Cable TMX 155 (1101)', sku: 'THR-TMX155-1101', brand: '1101', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable TMX 155 (Otaka)', sku: 'THR-TMX155-OTK', brand: 'Otaka', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable TMX 155 (KNC)', sku: 'THR-TMX155-KNC', brand: 'KNC', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable Supremo (Makoto)', sku: 'THR-SUP-MKT', brand: 'Makoto', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable Supremo (Mihniba)', sku: 'THR-SUP-MHB', brand: 'Mihniba', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable Barako (Makoto)', sku: 'THR-BARAKO-MKT', brand: 'Makoto', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable Barako (KNC)', sku: 'THR-BARAKO-KNC', brand: 'KNC', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable Wygo', sku: 'THR-WYGO', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable Wave 125 (LN)', sku: 'THR-WAVE125-LN', brand: 'LN', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable XRM 110 (Takarago)', sku: 'THR-XRM110-TKR', brand: 'Takarago', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable Wave 100 (Otaka)', sku: 'THR-WAVE100-OTK', brand: 'Otaka', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable YTX 125 (1101)', sku: 'THR-YTX125-1101', brand: '1101', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable YTX (Makoto)', sku: 'THR-YTX-MKT', brand: 'Makoto', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable YTX (Zecheng)', sku: 'THR-YTX-ZCH', brand: 'Zecheng', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable YTX 125 (Takarago)', sku: 'THR-YTX125-TKR', brand: 'Takarago', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable YTX 125 (Otaka)', sku: 'THR-YTX125-OTK', brand: 'Otaka', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable HD3 (Kryon)', sku: 'THR-HD3-KRY', brand: 'Kryon', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable R150 (Kryon)', sku: 'THR-R150-KRY', brand: 'Kryon', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable R150 (Eiko)', sku: 'THR-R150-EIKO', brand: 'Eiko', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable Sniper 150 (Kryon)', sku: 'THR-SNP150-KRY', brand: 'Kryon', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable GYG 150 (KNC)', sku: 'THR-GYG150-KNC', brand: 'KNC', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable GYG 125 (Molali)', sku: 'THR-GYG125-MLL', brand: 'Molali', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable NMAX (Kryon)', sku: 'THR-NMAX-KRY', brand: 'Kryon', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable Aerox 155 (Makoto)', sku: 'THR-AEROX155-MKT', brand: 'Makoto', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable Click 125 (1101)', sku: 'THR-CLICK125-1101', brand: '1101', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable Mio i125 (MBI)', sku: 'THR-MIOI125-MBI', brand: 'MBI', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable Mio (Zecheng)', sku: 'THR-MIO-ZCH', brand: 'Zecheng', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable TMX Supremo (Thai Worker)', sku: 'THR-TMXSUP-THAI', brand: 'Thai Worker', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable TMX Supremo (Makoto)', sku: 'THR-TMXSUP-MKT', brand: 'Makoto', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable TC150 (Otaka)', sku: 'THR-TC150-OTK', brand: 'Otaka', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable TC150 (Zecheng)', sku: 'THR-TC150-ZCH', brand: 'Zecheng', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable TC125 (1101)', sku: 'THR-TC125-1101', brand: '1101', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable TC125 (Otaka)', sku: 'THR-TC125-OTK', brand: 'Otaka', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Throttle Cable CG125 (Otaka)', sku: 'THR-CG125-OTK', brand: 'Otaka', categoryKey: 'throttleCable', isSerialized: true },

  // Clutch cable found on the cable page (routed to existing Clutch Cable category).
  { name: 'Clutch Cable TMX 155 (Otaka)', sku: 'CLT-TMX155-OTK', brand: 'Otaka', categoryKey: 'clutch', isSerialized: true },

  // --- Ignition Coil ---
  { name: 'Ignition Coil Barako (Takarago)', sku: 'IGC-BARAKO-TKR', brand: 'Takarago', categoryKey: 'ignitionCoil', isSerialized: true },
  { name: 'Ignition Coil TMX Charge (Yamato)', sku: 'IGC-TMX-YMT', brand: 'Yamato', categoryKey: 'ignitionCoil', isSerialized: true },
  { name: 'Ignition Coil GP125 (Takarago)', sku: 'IGC-GP125-TKR', brand: 'Takarago', categoryKey: 'ignitionCoil', isSerialized: true },
  { name: 'Ignition Coil X4 (Takarago)', sku: 'IGC-X4-TKR', brand: 'Takarago', categoryKey: 'ignitionCoil', isSerialized: true },
  { name: 'Ignition Coil HD3 (Takarago)', sku: 'IGC-HD3-TKR', brand: 'Takarago', categoryKey: 'ignitionCoil', isSerialized: true },

  // --- Primary Coil ---
  { name: 'Primary Coil C100 (Yakimoto)', sku: 'PRC-C100-YKM', brand: 'Yakimoto', categoryKey: 'primaryCoil', isSerialized: true },
  { name: 'Primary Coil C100 / Dream (Yakimoto)', sku: 'PRC-C100DREAM-YKM', brand: 'Yakimoto', categoryKey: 'primaryCoil', isSerialized: true },
  { name: 'Primary Coil CT100 (YHK)', sku: 'PRC-CT100-YHK', brand: 'YHK', categoryKey: 'primaryCoil', isSerialized: true },
  { name: 'Primary Coil TMX 155 (BY)', sku: 'PRC-TMX155-BY', brand: 'BY', categoryKey: 'primaryCoil', isSerialized: true },
  { name: 'Primary Coil TMX 155 (Vmax)', sku: 'PRC-TMX155-VMX', brand: 'Vmax', categoryKey: 'primaryCoil', isSerialized: true },
  { name: 'Primary Coil C100 (Vmax)', sku: 'PRC-C100-VMX', brand: 'Vmax', categoryKey: 'primaryCoil', isSerialized: true },

  // --- Brake Shoe ---
  { name: 'Brake Shoe TMX Front (Menol)', sku: 'BS-TMX-FRONT-MNL', brand: 'Menol', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Brake Shoe TMX Front (YK)', sku: 'BS-TMX-FRONT-YK', brand: 'YK', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Brake Shoe TMX Front / Rear (MVK)', sku: 'BS-TMX-FRONTREAR-MVK', brand: 'MVK', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Brake Shoe TMX 155 Front (KRA)', sku: 'BS-TMX155-FRONT-KRA', brand: 'KRA', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Brake Shoe Mio (Otaka)', sku: 'BS-MIO-OTK', brand: 'Otaka', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Brake Shoe TMX 155 Rear (Speed)', sku: 'BS-TMX155-REAR-SPD', brand: 'Speed', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Brake Shoe XRM 110 / GD110 (Otaka)', sku: 'BS-XRM110GD110-OTK', brand: 'Otaka', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Brake Shoe TMX Alpha Front (Menol)', sku: 'BS-TMXALP-FRONT-MNL', brand: 'Menol', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Brake Shoe Barako (Otaka)', sku: 'BS-BARAKO-OTK', brand: 'Otaka', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Brake Shoe HD3 (Otaka)', sku: 'BS-HD3-OTK', brand: 'Otaka', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Brake Shoe Honda Beat (Otaka)', sku: 'BS-BEAT-OTK', brand: 'Otaka', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Brake Shoe TMX Rear (Menol)', sku: 'BS-TMX-REAR-MNL', brand: 'Menol', categoryKey: 'brakeShoe', isSerialized: true },

  // --- Timing Chain ---
  { name: 'Timing Chain XRM / Wave Set (Chicken Worker Japan)', sku: 'TMC-XRMWAVE-CWJ', brand: 'Chicken Worker Japan', categoryKey: 'timingChain', isSerialized: true },
  { name: 'Timing Chain 25H 88L Set (Honda)', sku: 'TMC-25H88L-HONDA', brand: 'Honda', categoryKey: 'timingChain', isSerialized: true },
  { name: 'Timing Chain Wave 125 Guide Set (MRM)', sku: 'TMC-WAVE125-GUIDE-MRM', brand: 'MRM', categoryKey: 'timingChain', isSerialized: true },
  { name: 'Timing Chain Barako (TTGR)', sku: 'TMC-BARAKO-TTGR', brand: 'TTGR', categoryKey: 'timingChain', isSerialized: true },
  { name: 'Timing Chain XRM (Yakimoto)', sku: 'TMC-XRM-YKM', brand: 'Yakimoto', categoryKey: 'timingChain', isSerialized: true },
  { name: 'Timing Chain 25H 88L (DID)', sku: 'TMC-25H88L-DID', brand: 'DID', categoryKey: 'timingChain', isSerialized: true },
  { name: 'Timing Chain 25H 88L (KHC)', sku: 'TMC-25H88L-KHC', brand: 'KHC', categoryKey: 'timingChain', isSerialized: true },
  { name: 'Timing Chain XRM 110 (Makoto)', sku: 'TMC-XRM110-MKT', brand: 'Makoto', categoryKey: 'timingChain', isSerialized: true },
  { name: 'Timing Chain XRM 110 Starter (Makoto)', sku: 'TMC-XRM110-STARTER-MKT', brand: 'Makoto', categoryKey: 'timingChain', isSerialized: true },
  { name: 'Timing Chain 25H 94L (KNC)', sku: 'TMC-25H94L-KNC', brand: 'KNC', categoryKey: 'timingChain', isSerialized: true },

  // --- Lever ---
  { name: 'Lever Universal Handle (Yakimoto)', sku: 'LVR-UNIV-HANDLE-YKM', brand: 'Yakimoto', categoryKey: 'lever', isSerialized: true },
  { name: 'Lever HD3 Brake (Yakimoto)', sku: 'LVR-HD3-BRK-YKM', brand: 'Yakimoto', categoryKey: 'lever', isSerialized: true },
  { name: 'Lever XRM Brake (Yakimoto)', sku: 'LVR-XRM-BRK-YKM', brand: 'Yakimoto', categoryKey: 'lever', isSerialized: true },
  { name: 'Lever Supremo Brake (Yakimoto)', sku: 'LVR-SUP-BRK-YKM', brand: 'Yakimoto', categoryKey: 'lever', isSerialized: true },
  { name: 'Lever Barako Brake (Otaka)', sku: 'LVR-BARAKO-BRK-OTK', brand: 'Otaka', categoryKey: 'lever', isSerialized: true },
  { name: 'Lever Barako Clutch (Otaka)', sku: 'LVR-BARAKO-CLT-OTK', brand: 'Otaka', categoryKey: 'lever', isSerialized: true },
  { name: 'Lever Mio 125 Brake', sku: 'LVR-MIO125-BRK', categoryKey: 'lever', isSerialized: true },
  { name: 'Lever TMX 155 L/R (KNC)', sku: 'LVR-TMX155-LR-KNC', brand: 'KNC', categoryKey: 'lever', isSerialized: true },
  { name: 'Lever TMX 155 / Switch', sku: 'LVR-TMX155-SWITCH', categoryKey: 'lever', isSerialized: true },
  { name: 'Lever TC125 Handle', sku: 'LVR-TC125-HANDLE', categoryKey: 'lever', isSerialized: true },
  { name: 'Lever Wygo Handle', sku: 'LVR-WYGO-HANDLE', categoryKey: 'lever', isSerialized: true },

  // --- Battery ---
  { name: 'Battery 12N7L (Dayway)', sku: 'BAT-12N7L-DW', brand: 'Dayway', categoryKey: 'battery', isSerialized: true },
  { name: 'Battery YTX7A (Dayway)', sku: 'BAT-YTX7A-DW', brand: 'Dayway', categoryKey: 'battery', isSerialized: true },
  { name: 'Battery 12NC5 (Dayway)', sku: 'BAT-12NC5-DW', brand: 'Dayway', categoryKey: 'battery', isSerialized: true },
  { name: 'Battery YTX5A (Dayway)', sku: 'BAT-YTX5A-DW', brand: 'Dayway', categoryKey: 'battery', isSerialized: true },
  { name: 'Battery 12N6.5L (OD)', sku: 'BAT-12N65L-OD', brand: 'OD', categoryKey: 'battery', isSerialized: true },
  { name: 'Battery 12N5L (OD)', sku: 'BAT-12N5L-OD', brand: 'OD', categoryKey: 'battery', isSerialized: true },
  { name: 'Battery YTZ7 (OD)', sku: 'BAT-YTZ7-OD', brand: 'OD', categoryKey: 'battery', isSerialized: true },
  { name: 'Battery YTX5L (OD)', sku: 'BAT-YTX5L-OD', brand: 'OD', categoryKey: 'battery', isSerialized: true },
  { name: 'Battery YB3L (OD)', sku: 'BAT-YB3L-OD', brand: 'OD', categoryKey: 'battery', isSerialized: true },

  // --- Regulator ---
  { name: 'Regulator TMX 155 (NEP)', sku: 'REG-TMX155-NEP', brand: 'NEP', categoryKey: 'regulator', isSerialized: true },
  { name: 'Regulator Wind 125 (POG)', sku: 'REG-WIND125-POG', brand: 'POG', categoryKey: 'regulator', isSerialized: true },
  { name: 'Regulator Wygo', sku: 'REG-WYGO', categoryKey: 'regulator', isSerialized: true },
  { name: 'Regulator TMX Supremo (TTGR)', sku: 'REG-TMXSUP-TTGR', brand: 'TTGR', categoryKey: 'regulator', isSerialized: true },
  { name: 'Regulator TMX Alpha (TTGR)', sku: 'REG-TMXALP-TTGR', brand: 'TTGR', categoryKey: 'regulator', isSerialized: true },
  { name: 'Regulator TMX (Vnowar)', sku: 'REG-TMX-VNW', brand: 'Vnowar', categoryKey: 'regulator', isSerialized: true },
  { name: 'Regulator Barako (TTGR)', sku: 'REG-BARAKO-TTGR', brand: 'TTGR', categoryKey: 'regulator', isSerialized: true },
  { name: 'Regulator 5 Wire (TTGR)', sku: 'REG-5WIRE-TTGR', brand: 'TTGR', categoryKey: 'regulator', isSerialized: true },
  { name: 'Regulator Mio (KRX)', sku: 'REG-MIO-KRX', brand: 'KRX', categoryKey: 'regulator', isSerialized: true },
  { name: 'Regulator CT100 (Yakimoto)', sku: 'REG-CT100-YKM', brand: 'Yakimoto', categoryKey: 'regulator', isSerialized: true },
  { name: 'Regulator R150 (Vnowar)', sku: 'REG-R150-VNW', brand: 'Vnowar', categoryKey: 'regulator', isSerialized: true },

  // --- CDI ---
  { name: 'CDI CG125 (TTGR)', sku: 'CDI-CG125-TTGR', brand: 'TTGR', categoryKey: 'cdi', isSerialized: true },
  { name: 'CDI Rusi 125', sku: 'CDI-RUSI125', categoryKey: 'cdi', isSerialized: true },
  { name: 'CDI LF110 (KMN)', sku: 'CDI-LF110-KMN', brand: 'KMN', categoryKey: 'cdi', isSerialized: true },
  { name: 'CDI Barako (TTGR)', sku: 'CDI-BARAKO-TTGR', brand: 'TTGR', categoryKey: 'cdi', isSerialized: true },
  { name: 'CDI CG125 (KRA)', sku: 'CDI-CG125-KRA', brand: 'KRA', categoryKey: 'cdi', isSerialized: true },
  { name: 'CDI TMX 155 (KRA)', sku: 'CDI-TMX155-KRA', brand: 'KRA', categoryKey: 'cdi', isSerialized: true },
  { name: 'CDI TMX Supremo (Kryon)', sku: 'CDI-TMXSUP-KRY', brand: 'Kryon', categoryKey: 'cdi', isSerialized: true },
  { name: 'CDI CB125 (Quantum)', sku: 'CDI-CB125-QTM', brand: 'Quantum', categoryKey: 'cdi', isSerialized: true },
  { name: 'CDI XRM (Opao)', sku: 'CDI-XRM-OPAO', brand: 'Opao', categoryKey: 'cdi', isSerialized: true },
  { name: 'CDI CT150 (Yakimoto)', sku: 'CDI-CT150-YKM', brand: 'Yakimoto', categoryKey: 'cdi', isSerialized: true },
  { name: 'CDI Motorstar (Yakimoto)', sku: 'CDI-MOTORSTAR-YKM', brand: 'Yakimoto', categoryKey: 'cdi', isSerialized: true },

  // --- Stator ---
  { name: 'Stator Bajaj (RZL)', sku: 'STR-BAJAJ-RZL', brand: 'RZL', categoryKey: 'stator', isSerialized: true },
  { name: 'Stator TMX 155 (Vnowar)', sku: 'STR-TMX155-VNW', brand: 'Vnowar', categoryKey: 'stator', isSerialized: true },
  { name: 'Stator CG125 (Vnowar)', sku: 'STR-CG125-VNW', brand: 'Vnowar', categoryKey: 'stator', isSerialized: true },
  { name: 'Stator XRM 110 (Vnowar)', sku: 'STR-XRM110-VNW', brand: 'Vnowar', categoryKey: 'stator', isSerialized: true },
  { name: 'Stator Rusi 125 (KRA)', sku: 'STR-RUSI125-KRA', brand: 'KRA', categoryKey: 'stator', isSerialized: true },
  { name: 'Stator TMX 125 Alpha (No Brand)', sku: 'STR-TMX125ALP-NB', categoryKey: 'stator', isSerialized: true },
  { name: 'Stator TMX 125 (Rayana)', sku: 'STR-TMX125-RYN', brand: 'Rayana', categoryKey: 'stator', isSerialized: true },
  { name: 'Stator BC175 (NEP)', sku: 'STR-BC175-NEP', brand: 'NEP', categoryKey: 'stator', isSerialized: true },
  { name: 'Stator Supremo (NEP)', sku: 'STR-SUP-NEP', brand: 'NEP', categoryKey: 'stator', isSerialized: true },
  { name: 'Stator C100 (NEP)', sku: 'STR-C100-NEP', brand: 'NEP', categoryKey: 'stator', isSerialized: true },
  { name: 'Stator Wave 125 (RLV)', sku: 'STR-WAVE125-RLV', brand: 'RLV', categoryKey: 'stator', isSerialized: true },

  // --- Carburetor Kit ---
  { name: 'Carburetor Kit Wave 125 (iPart)', sku: 'CBK-WAVE125-IPART', brand: 'iPart', categoryKey: 'carburetorKit', isSerialized: true },
  { name: 'Carburetor Kit HD3 (KRR)', sku: 'CBK-HD3-KRR', brand: 'KRR', categoryKey: 'carburetorKit', isSerialized: true },
  { name: 'Carburetor Kit BC175 (EOK)', sku: 'CBK-BC175-EOK', brand: 'EOK', categoryKey: 'carburetorKit', isSerialized: true },
  { name: 'Carburetor Kit XRM (Chono)', sku: 'CBK-XRM-CHONO', brand: 'Chono', categoryKey: 'carburetorKit', isSerialized: true },
  { name: 'Carburetor Kit BC175 (Keyster)', sku: 'CBK-BC175-KEY', brand: 'Keyster', categoryKey: 'carburetorKit', isSerialized: true },
  { name: 'Carburetor Kit XRM 110 (Keyster)', sku: 'CBK-XRM110-KEY', brand: 'Keyster', categoryKey: 'carburetorKit', isSerialized: true },
  { name: 'Carburetor Kit Raider 150', sku: 'CBK-RDR150', categoryKey: 'carburetorKit', isSerialized: true },

  // --- Carburetor ---
  { name: 'Carburetor TMX Supremo (Keihin)', sku: 'CRB-TMXSUP-KEIHIN', brand: 'Keihin', categoryKey: 'carburetor', isSerialized: true },
  { name: 'Carburetor TMX 155', sku: 'CRB-TMX155', categoryKey: 'carburetor', isSerialized: true },
  { name: 'Carburetor Rmahn', sku: 'CRB-RMAHN', categoryKey: 'carburetor', isSerialized: true },
  { name: 'Carburetor XRM 110', sku: 'CRB-XRM110', categoryKey: 'carburetor', isSerialized: true },
  { name: 'Carburetor Mio', sku: 'CRB-MIO', categoryKey: 'carburetor', isSerialized: true },
  { name: 'Carburetor 24mm', sku: 'CRB-24MM', categoryKey: 'carburetor', isSerialized: true },
  { name: 'Carburetor Barako', sku: 'CRB-BARAKO', categoryKey: 'carburetor', isSerialized: true },
  { name: 'Carburetor 28mm (No Brand)', sku: 'CRB-28MM-NB', categoryKey: 'carburetor', isSerialized: true },

  // --- Connecting Rod ---
  { name: 'Connecting Rod Wave 110 Alpha (Makoto)', sku: 'CNR-WAVE110ALP-MKT', brand: 'Makoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'Connecting Rod Wave 110 / 125 / XRM (Makoto)', sku: 'CNR-WAVE110125XRM-MKT', brand: 'Makoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'Connecting Rod HD3', sku: 'CNR-HD3', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'Connecting Rod CG125 (Wygo)', sku: 'CNR-CG125-WYGO', brand: 'Wygo', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'Connecting Rod CG125 (ABR)', sku: 'CNR-CG125-ABR', brand: 'ABR', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'Connecting Rod BC175 Barako (Makoto)', sku: 'CNR-BC175BARAKO-MKT', brand: 'Makoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'Connecting Rod Mio (Yakimoto)', sku: 'CNR-MIO-YKM', brand: 'Yakimoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'Connecting Rod CT100 (Yakimoto)', sku: 'CNR-CT100-YKM', brand: 'Yakimoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'Connecting Rod XRM (Yakimoto)', sku: 'CNR-XRM-YKM', brand: 'Yakimoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'Connecting Rod TMX (Yakimoto)', sku: 'CNR-TMX-YKM', brand: 'Yakimoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'Connecting Rod BC175 (Yakimoto)', sku: 'CNR-BC175-YKM', brand: 'Yakimoto', categoryKey: 'connectingRod', isSerialized: true },

  // --- Camshaft ---
  { name: 'Camshaft Wave 100 (MKN)', sku: 'CAM-WAVE100-MKN', brand: 'MKN', categoryKey: 'camshaft', isSerialized: true },
  { name: 'Camshaft BC175 (TTGR)', sku: 'CAM-BC175-TTGR', brand: 'TTGR', categoryKey: 'camshaft', isSerialized: true },
  { name: 'Camshaft TMX 155 (PAG)', sku: 'CAM-TMX155-PAG', brand: 'PAG', categoryKey: 'camshaft', isSerialized: true },

  // --- Rocker Arm ---
  { name: 'Rocker Arm TMX', sku: 'RKA-TMX-YKM', brand: 'Yakimoto', categoryKey: 'rockerArm', isSerialized: true },
  { name: 'Rocker Arm XRM', sku: 'RKA-XRM-YKM', brand: 'Yakimoto', categoryKey: 'rockerArm', isSerialized: true },
  { name: 'Rocker Arm Darn', sku: 'RKA-DARN-YKM', brand: 'Yakimoto', categoryKey: 'rockerArm', isSerialized: true },
  { name: 'Rocker Arm Rmahn', sku: 'RKA-RMAHN-YKM', brand: 'Yakimoto', categoryKey: 'rockerArm', isSerialized: true },
  { name: 'Rocker Arm Wave 110', sku: 'RKA-WAVE110-YKM', brand: 'Yakimoto', categoryKey: 'rockerArm', isSerialized: true },

  // --- Cam Follower ---
  { name: 'Cam Follower TMX (PAG)', sku: 'CMF-TMX-PAG', brand: 'PAG', categoryKey: 'camFollower', isSerialized: true },
  { name: 'Cam Follower TMX (Open)', sku: 'CMF-TMX-OPEN', categoryKey: 'camFollower', isSerialized: true },

  // --- Cylinder Block ---
  { name: 'Cylinder Block TMX 155 (MTK)', sku: 'CYB-TMX155-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Cylinder Block Motorstar Pinoy 150 (MTK)', sku: 'CYB-MSPINOY150-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Cylinder Block Barako B1 (MTK)', sku: 'CYB-BARAKOB1-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Cylinder Block CG150 (MTK)', sku: 'CYB-CG150-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Cylinder Block LF125 (MTK)', sku: 'CYB-LF125-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Cylinder Block CG125 (MTK)', sku: 'CYB-CG125-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Cylinder Block CG125 (MP)', sku: 'CYB-CG125-MP', brand: 'MP', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Cylinder Block Rmahn 115 (MP)', sku: 'CYB-RMAHN115-MP', brand: 'MP', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Cylinder Block LF110 (MP)', sku: 'CYB-LF110-MP', brand: 'MP', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Cylinder Block Wave 100 (MTK)', sku: 'CYB-WAVE100-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },

  // --- Brake Rod ---
  { name: 'Brake Rod (No Brand)', sku: 'BRD-NB', categoryKey: 'brakeRod', isSerialized: true },
  { name: 'Brake Rod XRM 110', sku: 'BRD-XRM110', categoryKey: 'brakeRod', isSerialized: true },
  { name: 'Brake Rod X4', sku: 'BRD-X4', categoryKey: 'brakeRod', isSerialized: true },
  { name: 'Brake Rod Barako', sku: 'BRD-BARAKO', categoryKey: 'brakeRod', isSerialized: true },
  { name: 'Brake Rod TMX 155', sku: 'BRD-TMX155', categoryKey: 'brakeRod', isSerialized: true },

  // --- Wire Harness ---
  { name: 'Wire Harness CG125 (Wygo)', sku: 'WH-CG125-WYGO', brand: 'Wygo', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'Wire Harness HD3 (Yakimoto)', sku: 'WH-HD3-YKM', brand: 'Yakimoto', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'Wire Harness HD3 (No Brand)', sku: 'WH-HD3-NB', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'Wire Harness Barako (No Brand)', sku: 'WH-BARAKO-NB', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'Wire Harness TMX 155 (Honda)', sku: 'WH-TMX155-HONDA', brand: 'Honda', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'Wire Harness Mio (Epower)', sku: 'WH-MIO-EPOWER', brand: 'Epower', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'Wire Harness CT100 (Epower)', sku: 'WH-CT100-EPOWER', brand: 'Epower', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'Wire Harness GYG (KNC)', sku: 'WH-GYG-KNC', brand: 'KNC', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'Wire Harness (No Brand)', sku: 'WH-NB', categoryKey: 'wireHarness', isSerialized: true },

  // --- Axle ---
  { name: 'Axle TMX Alpha Front', sku: 'AXL-TMXALP-FRONT', categoryKey: 'axle', isSerialized: true },
  { name: 'Axle Mio', sku: 'AXL-MIO', categoryKey: 'axle', isSerialized: true },
  { name: 'Axle TC150 / 125', sku: 'AXL-TC150125', categoryKey: 'axle', isSerialized: true },
  { name: 'Axle XRM', sku: 'AXL-XRM', categoryKey: 'axle', isSerialized: true },
  { name: 'Axle GP125 / X4', sku: 'AXL-GP125X4', categoryKey: 'axle', isSerialized: true },
  { name: 'Axle TMX 155 Front', sku: 'AXL-TMX155-FRONT', categoryKey: 'axle', isSerialized: true },
  { name: 'Axle TMX 155 / RR100 Rear', sku: 'AXL-TMX155RR100-REAR', categoryKey: 'axle', isSerialized: true },
  { name: 'Axle Wave 100', sku: 'AXL-WAVE100', categoryKey: 'axle', isSerialized: true },
  { name: 'Axle TMX 125 / Rusi Main Stand Shaft', sku: 'AXL-TMX125RUSI-MAINSTAND', categoryKey: 'axle', isSerialized: true },
  { name: 'Axle TMX 155 Main Stand Shaft', sku: 'AXL-TMX155-MAINSTAND', categoryKey: 'axle', isSerialized: true },
  { name: 'Axle (No Brand)', sku: 'AXL-NB', categoryKey: 'axle', isSerialized: true },

  // --- Piston / Piston Ring ---
  { name: 'Piston LF125 (Miyaco)', sku: 'PST-LF125-MYK', brand: 'Miyaco', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston LF150 (Miyaco)', sku: 'PST-LF150-MYC', brand: 'Miyaco', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston GYG 150 (Halo)', sku: 'PST-GYG150-HALO', brand: 'Halo', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston GYG 125 (Miyaco)', sku: 'PST-GYG125-MYC', brand: 'Miyaco', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston XRM (Halo)', sku: 'PST-XRM-HALO', brand: 'Halo', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston XRM 110 (Yamato)', sku: 'PST-XRM110-YMT', brand: 'Yamato', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston BC175 (Halo)', sku: 'PST-BC175-HALO', brand: 'Halo', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston BC175 (RIK)', sku: 'PST-BC175-RIK', brand: 'RIK', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston CG125 (Wygo)', sku: 'PST-CG125-WYGO', brand: 'Wygo', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston Wave 100 (RLV)', sku: 'PST-WAVE100-RLV', brand: 'RLV', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston C100 (Billion)', sku: 'PST-C100-BIL', brand: 'Billion', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston C100 (Halo)', sku: 'PST-C100-HALO', brand: 'Halo', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston Mio (Mihniba)', sku: 'PST-MIO-MHB', brand: 'Mihniba', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston Mio (RLV)', sku: 'PST-MIO-RLV', brand: 'RLV', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston TMX 155 (Miyaco)', sku: 'PST-TMX155-MYC', brand: 'Miyaco', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston TMX 125 (Halo)', sku: 'PST-TMX125-HALO', brand: 'Halo', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston TMX New (RLV)', sku: 'PST-TMXNEW-RLV', brand: 'RLV', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston RXT 125 (RIK)', sku: 'PST-RXT125-RIK', brand: 'RIK', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston CG150 (Marathon)', sku: 'PST-CG150-MRTN', brand: 'Marathon', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston CG150 (Billion)', sku: 'PST-CG150-BIL', brand: 'Billion', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston Pinoy 125 (Makoto)', sku: 'PST-PINOY125-MKT', brand: 'Makoto', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston Pinoy 150 (Makoto)', sku: 'PST-PINOY150-MKT', brand: 'Makoto', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston HD3 (Kawasaki)', sku: 'PST-HD3-KAW', brand: 'Kawasaki', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston Mio Sporty (Miyaco)', sku: 'PST-MIOSPORTY-MYC', brand: 'Miyaco', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston LF110 (Billion)', sku: 'PST-LF110-BIL', brand: 'Billion', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston LF110 (MP)', sku: 'PST-LF110-MP', brand: 'MP', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston LF125 (Billion)', sku: 'PST-LF125-BIL', brand: 'Billion', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston W125 (Billion)', sku: 'PST-W125-BIL', brand: 'Billion', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston W125 (MTK)', sku: 'PST-W125-MTK', brand: 'MTK', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston XRM (Billion)', sku: 'PST-XRM-BIL', brand: 'Billion', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston CG150 (RLV)', sku: 'PST-CG150-RLV', brand: 'RLV', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston Wolf 125 (Yamato)', sku: 'PST-WOLF125-YMT', brand: 'Yamato', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston C100 (Bajaj)', sku: 'PST-C100-BAJAJ', brand: 'Bajaj', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston C100 (Makoto)', sku: 'PST-C100-MKT', brand: 'Makoto', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston C100 (VRK)', sku: 'PST-C100-VRK', brand: 'VRK', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston BC175 (RLV)', sku: 'PST-BC175-RLV', brand: 'RLV', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston BC175 (Makoto)', sku: 'PST-BC175-MKT', brand: 'Makoto', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston Shogun (MP)', sku: 'PST-SHOGUN-MP', brand: 'MP', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston TMX (RLV)', sku: 'PST-TMX-RLV', brand: 'RLV', categoryKey: 'piston', isSerialized: true },
  { name: 'Piston TMX (MP)', sku: 'PST-TMX-MP', brand: 'MP', categoryKey: 'piston', isSerialized: true },

  // --- Meter Assembly ---
  { name: 'Meter Assembly CG125 (Wygo)', sku: 'MTA-CG125-WYGO', brand: 'Wygo', categoryKey: 'instrument', isSerialized: true },
  { name: 'Meter Assembly CG125 TL', sku: 'MTA-CG125-TL', categoryKey: 'instrument', isSerialized: true },

  // --- Headlight ---
  { name: 'Headlight TMX 125 (Sharking)', sku: 'HL-TMX125-SHK', brand: 'Sharking', categoryKey: 'lighting', isSerialized: true },
  { name: 'Headlight TMX 155 (Sharking)', sku: 'HL-TMX155-SHK', brand: 'Sharking', categoryKey: 'lighting', isSerialized: true },
  { name: 'Headlight Barako (Otaka)', sku: 'HL-BARAKO-OTK', brand: 'Otaka', categoryKey: 'lighting', isSerialized: true },
  { name: 'Headlight Barako Assembly (Suntal)', sku: 'HL-BARAKO-SUNTAL', brand: 'Suntal', categoryKey: 'lighting', isSerialized: true },
  { name: 'Headlight TMX 155 (No Brand)', sku: 'HL-TMX155-NB', categoryKey: 'lighting', isSerialized: true },
  { name: 'Headlight Barako (GRR)', sku: 'HL-BARAKO-GRR', brand: 'GRR', categoryKey: 'lighting', isSerialized: true },

  // --- Tail Light ---
  { name: 'Tail Light Barako (No Brand)', sku: 'TL-BARAKO-NB', categoryKey: 'lighting', isSerialized: true },
  { name: 'Tail Light TMX 125 (No Brand)', sku: 'TL-TMX125-NB', categoryKey: 'lighting', isSerialized: true },
  { name: 'Tail Light TMX 155 (No Brand)', sku: 'TL-TMX155-NB', categoryKey: 'lighting', isSerialized: true },

  // --- Speedometer Gauge ---
  { name: 'Speedometer Gauge TMX 125 Crown Piece (KRX)', sku: 'SPG-TMX125-CROWN-KRX', brand: 'KRX', categoryKey: 'instrument', isSerialized: true },
  { name: 'Speedometer Gauge TMX 125 Crown Piece', sku: 'SPG-TMX125-CROWN', categoryKey: 'instrument', isSerialized: true },
  { name: 'Speedometer Gauge TMX 155 (KY By Moto)', sku: 'SPG-TMX155-KYBYMOTO', brand: 'KY By Moto', categoryKey: 'instrument', isSerialized: true },
  { name: 'Speedometer Gauge TMX 155 (Otaka)', sku: 'SPG-TMX155-OTK', brand: 'Otaka', categoryKey: 'instrument', isSerialized: true },
  { name: 'Speedometer Gauge TMX 155 (GRS)', sku: 'SPG-TMX155-GRS', brand: 'GRS', categoryKey: 'instrument', isSerialized: true },
  { name: 'Speedometer Gauge Universal (RZL)', sku: 'SPG-UNIV-RZL', brand: 'RZL', categoryKey: 'instrument', isSerialized: true },

  // --- Engine Oil (consumable) ---
  { name: 'Engine Oil 800 (Motul)', sku: 'OIL-MOTUL-800', brand: 'Motul', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil 1L (Kawasaki)', sku: 'OIL-KAW-1L', brand: 'Kawasaki', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil Block 1L (Havoline)', sku: 'OIL-HAVO-BLOCK-1L', brand: 'Havoline', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil Diesel (Petron)', sku: 'OIL-PETRON-DIESEL', brand: 'Petron', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil 1L (RV8)', sku: 'OIL-RV8-1L', brand: 'RV8', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil Advance 1L (Shell)', sku: 'OIL-SHELL-ADV-1L', brand: 'Shell', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil 1L (Petron)', sku: 'OIL-PETRON-1L', brand: 'Petron', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil 2T', sku: 'OIL-2T', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil 200 (Petron)', sku: 'OIL-PETRON-200', brand: 'Petron', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil 800 (Havoline)', sku: 'OIL-HAVO-800', brand: 'Havoline', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil Scooter 1L (ZIC)', sku: 'OIL-ZIC-1L-SCOOTER', brand: 'ZIC', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil 800 (ZIC)', sku: 'OIL-ZIC-800', brand: 'ZIC', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil 800 (Control)', sku: 'OIL-CONTROL-800', brand: 'Control', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil 1L (Control)', sku: 'OIL-CONTROL-1L', brand: 'Control', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil 1L (Competition)', sku: 'OIL-COMPETITION-1L', brand: 'Competition', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Engine Oil Scooter 1L (Motul)', sku: 'OIL-MOTUL-SCOOTER-1L', brand: 'Motul', categoryKey: 'engineOil', isSerialized: false },

  // --- Coolant (consumable) ---
  { name: 'Coolant (Top 1)', sku: 'COOL-TOP1', brand: 'Top 1', categoryKey: 'coolant', isSerialized: false },

  // --- Spray & Chemicals (consumable) ---
  { name: 'Cut Cleaner', sku: 'SPR-CUTCLEANER', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'WD-40', sku: 'SPR-WD40', brand: 'WD-40', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Spray Paint Blue (Bosny)', sku: 'SPR-BOSNY-BLUE', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Spray Paint Yellow (Bosny)', sku: 'SPR-BOSNY-YELLOW', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Spray Paint Primer Gray (Bosny)', sku: 'SPR-BOSNY-PRIMERGRAY', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Spray Paint Silver (Bosny)', sku: 'SPR-BOSNY-SILVER', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Spray Paint Dark Blue (Bosny)', sku: 'SPR-BOSNY-DARKBLUE', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Spray Paint Clear (Bosny)', sku: 'SPR-BOSNY-CLEAR', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Spray Paint High-Temp Gloss Black (Bosny)', sku: 'SPR-BOSNY-HTEMP-GLOSSBLACK', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Spray Paint Flat Black (Bosny)', sku: 'SPR-BOSNY-FLATBLACK', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Water Mark Stain Remover', sku: 'SPR-WATERMARK-REMOVER', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Tire Black (MTX)', sku: 'SPR-TIREBLACK-MTX', brand: 'MTX', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Tire Sealant', sku: 'SPR-TIRESEALANT', categoryKey: 'sprayChemical', isSerialized: false },

  // --- Tube (consumable) ---
  { name: 'Tube 300-17', sku: 'TUBE-300-17-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 275-17', sku: 'TUBE-275-17-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 250-17', sku: 'TUBE-250-17-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 225-17', sku: 'TUBE-225-17-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 200-17', sku: 'TUBE-200-17-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 185-17', sku: 'TUBE-185-17-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 350-17', sku: 'TUBE-350-17-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 200-18', sku: 'TUBE-200-18-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 275-18', sku: 'TUBE-275-18-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 250-18', sku: 'TUBE-250-18-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 300-14', sku: 'TUBE-300-14-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 275-14', sku: 'TUBE-275-14-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 250-14', sku: 'TUBE-250-14-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 225-14', sku: 'TUBE-225-14-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 200-14', sku: 'TUBE-200-14-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 185-14', sku: 'TUBE-185-14-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 300-16', sku: 'TUBE-300-16-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 275-16', sku: 'TUBE-275-16-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 250-16', sku: 'TUBE-250-16-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 225-16', sku: 'TUBE-225-16-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },
  { name: 'Tube 200-16', sku: 'TUBE-200-16-KRX', brand: 'KRX', categoryKey: 'tube', isSerialized: false },

  // --- Bearing (consumable) ---
  { name: 'Bearing 6001 (NRK)', sku: 'BRG-6001-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6002 (V-Japan)', sku: 'BRG-6002-VJ', brand: 'V-Japan', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6003 (V-Japan)', sku: 'BRG-6003-VJ', brand: 'V-Japan', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6004 (V-Japan)', sku: 'BRG-6004-VJ', brand: 'V-Japan', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6004 (RZ)', sku: 'BRG-6004-RZ', brand: 'RZ', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6005 (NRK)', sku: 'BRG-6005-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6200 (V-Japan)', sku: 'BRG-6200-VJ', brand: 'V-Japan', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6201 (NRK)', sku: 'BRG-6201-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6200 (IPI)', sku: 'BRG-6200-IPI', brand: 'IPI', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6202 (NRK)', sku: 'BRG-6202-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6203 (NRK)', sku: 'BRG-6203-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6204 (NRK)', sku: 'BRG-6204-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6205 (NRK)', sku: 'BRG-6205-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6300 (NRK)', sku: 'BRG-6300-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6301 (NRK)', sku: 'BRG-6301-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6302 (NRK)', sku: 'BRG-6302-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6303 (V-Japan)', sku: 'BRG-6303-VJ', brand: 'V-Japan', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6304 (NRK)', sku: 'BRG-6304-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6005 CM (NRK Orig)', sku: 'BRG-6005CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6206 CM (NRK Orig)', sku: 'BRG-6206CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6205 ZZ CM (NRK Orig)', sku: 'BRG-6205ZZCM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6305 CM (NRK Orig)', sku: 'BRG-6305CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6304 CM (NRK Orig)', sku: 'BRG-6304CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6004 CM (NRK Orig)', sku: 'BRG-6004CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6004 ZZ CM (NRK Orig)', sku: 'BRG-6004ZZCM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6003 DDU CM (NRK Orig)', sku: 'BRG-6003DDUCM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6300 CM BK (NRK Orig)', sku: 'BRG-6300CMBK-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6302 CM (NRK Orig)', sku: 'BRG-6302CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6203 CM (NRK Orig)', sku: 'BRG-6203CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6301 CM BK (NRK Orig)', sku: 'BRG-6301CMBK-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 638 ZZ1 MC3 (NRK Orig)', sku: 'BRG-638ZZ1MC3-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6204 ZZ CM (NRK Orig)', sku: 'BRG-6204ZZCM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6001 (ARB Orig)', sku: 'BRG-6001-ARB', brand: 'ARB', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6902 (ARB Orig)', sku: 'BRG-6902-ARB', brand: 'ARB', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6906 (ARB Orig)', sku: 'BRG-6906-ARB', brand: 'ARB', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6002 CM (NRK Orig)', sku: 'BRG-6002CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6904 C3 (NRK Orig)', sku: 'BRG-6904C3-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6905 C3 (NRK Orig)', sku: 'BRG-6905C3-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6202 WB (Onnko Orig)', sku: 'BRG-6202WB-ONNKO', brand: 'Onnko', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6200 ZZ CM (Koyo Orig)', sku: 'BRG-6200ZZCM-KOYO', brand: 'Koyo', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing C3/28 2RSC3 (UTEKT Orig)', sku: 'BRG-C3282RSC3-UTEKT', brand: 'UTEKT', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 28BCV15HRL2 (Nachi Orig)', sku: 'BRG-28BCV15HRL2-NACHI', brand: 'Nachi', categoryKey: 'bearing', isSerialized: false },
  { name: 'Bearing 6002 (Thai Worker)', sku: 'BRG-6002-THAI', brand: 'Thai Worker', categoryKey: 'bearing', isSerialized: false },

  // --- Knuckle Bearing (consumable) ---
  { name: 'Knuckle Bearing Wave 125 / Beat / Click / C100 / W100 (Otaka)', sku: 'KBR-WAVE125BEATCLICK-OTK', brand: 'Otaka', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing TMX Supremo (Otaka)', sku: 'KBR-TMXSUP-OTK', brand: 'Otaka', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing R150 (Otaka)', sku: 'KBR-R150-OTK', brand: 'Otaka', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing C100 / BC175 (Otaka)', sku: 'KBR-C100BC175-OTK', brand: 'Otaka', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing RV100 / Mio / YTX / Aerox / Sniper (Otaka)', sku: 'KBR-RV100MIOYTX-OTK', brand: 'Otaka', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing RR100 (RLV)', sku: 'KBR-RR100-RLV', brand: 'RLV', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing XRM (Yakimoto)', sku: 'KBR-XRM-YKM', brand: 'Yakimoto', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing Supremo (Yakimoto)', sku: 'KBR-SUP-YKM', brand: 'Yakimoto', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing C100 (Yakimoto)', sku: 'KBR-C100-YKM', brand: 'Yakimoto', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing Rmahn (Yakimoto)', sku: 'KBR-RMAHN-YKM', brand: 'Yakimoto', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing R150 (Yakimoto)', sku: 'KBR-R150-YKM', brand: 'Yakimoto', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing R150 (MTR)', sku: 'KBR-R150-MTR', brand: 'MTR', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing XRM (Fukuyama)', sku: 'KBR-XRM-FKY', brand: 'Fukuyama', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing XRM (Liman)', sku: 'KBR-XRM-LIMAN', brand: 'Liman', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing Wave / Darn / Click (Suntal)', sku: 'KBR-WAVEDARNCLICK-SUNTAL', brand: 'Suntal', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Knuckle Bearing RR100 (TTGR/EOK/Menol)', sku: 'KBR-RR100-TTGR', brand: 'TTGR', categoryKey: 'knuckleBearing', isSerialized: false },
];

const ALL_PRODUCT_SEEDS: ProductSeed[] = [...PRODUCT_SEEDS, ...MOTORSHOP_PRODUCT_SEEDS];

async function upsertCategory(
  tx: Prisma.TransactionClient,
  seed: (typeof CATEGORY_SEEDS)[CategoryKey],
) {
  const existing = await tx.category.findFirst({
    where: { name: { equals: seed.name, mode: 'insensitive' } },
  });

  if (existing) {
    return tx.category.update({
      where: { id: existing.id },
      data: {
        name: seed.name,
        description: seed.description,
        isArchived: false,
      },
    });
  }

  return tx.category.create({ data: seed });
}

async function main() {
  await prisma.$transaction(async (tx) => {
    // Scope every write in this transaction to the client's organization (for RLS + the
    // organization_id column default).
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_org_id', $1, true)`, ORGANIZATION_ID);

    const categoryIdByKey = new Map<CategoryKey, string>();
    const categoryEntries = Object.entries(CATEGORY_SEEDS) as [
      CategoryKey,
      (typeof CATEGORY_SEEDS)[CategoryKey],
    ][];

    for (const [key, seed] of categoryEntries) {
      const category = await upsertCategory(tx, seed);
      categoryIdByKey.set(key, category.id);
    }

    for (const seed of ALL_PRODUCT_SEEDS) {
      const categoryId = categoryIdByKey.get(seed.categoryKey);
      if (!categoryId) {
        throw new Error(`Missing seeded category for "${seed.categoryKey}".`);
      }

      await tx.product.upsert({
        where: { organizationId_sku: { organizationId: ORGANIZATION_ID, sku: seed.sku } },
        create: {
          name: seed.name,
          sku: seed.sku,
          brand: seed.brand ?? null,
          categoryId,
          isSerialized: seed.isSerialized ?? false,
        },
        update: {
          name: seed.name,
          brand: seed.brand ?? null,
          categoryId,
          isSerialized: seed.isSerialized ?? false,
          isArchived: false,
        },
      });
    }
  }, { maxWait: 15000, timeout: 120000 });

  console.log(
    `Seeded ${Object.keys(CATEGORY_SEEDS).length} categories and ${ALL_PRODUCT_SEEDS.length} products.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
