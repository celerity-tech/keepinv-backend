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

// This catalog belongs to the existing client (Rapido Motorsiklo Garage). Seeds run under
// its tenant so RLS allows the writes and organization_id resolves via the column default.
const ORGANIZATION_ID = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853';

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
    name: 'Piston / Piston Ring',
    description: 'Pistons and piston ring sets',
  },
  meterAssembly: {
    name: 'Meter Assembly',
    description: 'Speedometer / instrument cluster assemblies',
  },
  headlight: {
    name: 'Headlight',
    description: 'Headlight assemblies',
  },
  tailLight: {
    name: 'Tail Light',
    description: 'Tail light assemblies',
  },
  speedometerGauge: {
    name: 'Speedometer Gauge',
    description: 'Speedometer gauges and crown pieces',
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

// Original cable products (kept as-is).
const PRODUCT_SEEDS: ProductSeed[] = [
  { name: 'HD3 Clutch Cable', sku: 'CLT-HD3-KNC', brand: 'KNC', categoryKey: 'clutch' },
  { name: 'GR125 Clutch Cable', sku: 'CLT-GR125-KNC', brand: 'KNC', categoryKey: 'clutch' },
  { name: 'Rouser 135 L-TE Clutch Cable', sku: 'CLT-RS135-UH', brand: 'UH', categoryKey: 'clutch' },
  { name: 'Raider 150 Clutch Cable', sku: 'CLT-RDR150-1101', brand: '1101', categoryKey: 'clutch' },
  { name: 'Raider 150 Fi Clutch Cable', sku: 'CLT-RDR150FI-VLT', brand: 'Valiant', categoryKey: 'clutch' },
  { name: 'Sniper 150 Clutch Cable', sku: 'CLT-SNP150-KRY', brand: 'Kryon', categoryKey: 'clutch' },
  { name: 'YMX 125 Alpha Brake Cable', sku: 'BRK-YMX125-KNC', brand: 'KNC', categoryKey: 'brake' },
  { name: 'Barako 175 Brake Cable', sku: 'BRK-BRK175-KNC', brand: 'KNC', categoryKey: 'brake' },
  { name: 'Barako 175 Brake Cable (Otaka)', sku: 'BRK-BRK175-OTK', brand: 'Otaka', categoryKey: 'brake' },
  { name: 'HD3 Brake Cable', sku: 'BRK-HD3-KNC', brand: 'KNC', categoryKey: 'brake' },
  { name: 'Wygo Brake Cable', sku: 'BRK-WYGO', categoryKey: 'brake' },
  { name: 'Wave 100 Brake Cable', sku: 'BRK-WAVE100-GRR', brand: 'GRR', categoryKey: 'brake' },
  { name: 'Beat Fi Brake Cable', sku: 'BRK-BEATFI-ZCH', brand: 'Zecheng', categoryKey: 'brake' },
  { name: 'Click 125 Brake Cable', sku: 'BRK-CLICK125-OTK', brand: 'Otaka', categoryKey: 'brake' },
  { name: 'Mio 125 Brake Cable', sku: 'BRK-MIO125-OTK', brand: 'Otaka', categoryKey: 'brake' },
  { name: 'Mio Brake Cable', sku: 'BRK-MIO-OTK', brand: 'Otaka', categoryKey: 'brake' },
  { name: 'RM100 Brake Cable', sku: 'BRK-RM100-YHK', brand: 'YHK', categoryKey: 'brake' },
  { name: 'RM100 Speedometer Cable', sku: 'SPD-RM100-EIKO', brand: 'Eiko', categoryKey: 'speedometer' },
  { name: 'Rouser 135 Speedometer Cable', sku: 'SPD-RS135-ORT', brand: 'Ortaine', categoryKey: 'speedometer' },
  { name: 'Rmahn 110 Speedometer Cable', sku: 'SPD-RMAHN110-MKT', brand: 'Makoto', categoryKey: 'speedometer' },
  { name: 'Rmahn 115 Speedometer Cable', sku: 'SPD-RMAHN115-MKT', brand: 'Makoto', categoryKey: 'speedometer' },
  { name: 'Raider J 110 Speedometer Cable', sku: 'SPD-RDRJ110-MKT', brand: 'Makoto', categoryKey: 'speedometer' },
];

// Motorshop products transcribed from the inventory notebook.
// All hard parts default to serialized; consumables are flagged non-serialized.
// Quantities intentionally start at 0 (notebook counts are not seeded).
const MOTORSHOP_PRODUCT_SEEDS: ProductSeed[] = [
  // --- Engine Valve ---
  { name: 'TMX Engine Valve', sku: 'EV-TMX-HALO', brand: 'Halo', categoryKey: 'engineValve', isSerialized: true },
  { name: 'BC175 Engine Valve', sku: 'EV-BC175-HALO', brand: 'Halo', categoryKey: 'engineValve', isSerialized: true },
  { name: 'YTX 125 Engine Valve', sku: 'EV-YTX125-MKT', brand: 'Makoto', categoryKey: 'engineValve', isSerialized: true },
  { name: 'CT150 Engine Valve', sku: 'EV-CT150-TKR', brand: 'Takarago', categoryKey: 'engineValve', isSerialized: true },
  { name: 'XRM Engine Valve', sku: 'EV-XRM-KOZA', brand: 'Koza', categoryKey: 'engineValve', isSerialized: true },

  // --- Oil Filter ---
  { name: 'Bajaj / Kawasaki Oil Filter', sku: 'OF-BAJAJ-KAW', categoryKey: 'oilFilter', isSerialized: true },
  { name: 'Suzuki Oil Filter', sku: 'OF-SUZUKI', categoryKey: 'oilFilter', isSerialized: true },
  { name: 'Kawasaki Oil Filter', sku: 'OF-KAWASAKI', categoryKey: 'oilFilter', isSerialized: true },
  { name: 'Yamaha Oil Filter', sku: 'OF-YAMAHA', categoryKey: 'oilFilter', isSerialized: true },

  // --- Ignition Switch ---
  { name: 'LF110 Ignition Switch', sku: 'IGS-LF110-KNC', brand: 'KNC', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Wave 125 Ignition Switch', sku: 'IGS-WAVE125-TUR', brand: 'TUR', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Raider 150 Ignition Switch', sku: 'IGS-R150-KTC', brand: 'Kitaco', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'YMX Ignition Switch', sku: 'IGS-YMX-KTC', brand: 'Kitaco', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'TMX / Supremo Ignition Switch', sku: 'IGS-TMXSUP-CHL', brand: 'CHL', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'LF150 Ignition Switch', sku: 'IGS-LF150-KJR', brand: 'Kujira', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'TMX 125 Ignition Switch', sku: 'IGS-TMX125-KTC', brand: 'Kitaco', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'TMX Alpha Ignition Switch', sku: 'IGS-TMXALP-KJR', brand: 'Kujira', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'HD3 Ignition Switch', sku: 'IGS-HD3-ANT', brand: 'Ant', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Wave 125 Ignition Switch (TTGR)', sku: 'IGS-WAVE125-TTGR', brand: 'TTGR', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'XRM 110 Ignition Switch', sku: 'IGS-XRM110-CHL', brand: 'CHL', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'XRM 110 Ignition Switch (No Brand)', sku: 'IGS-XRM110-NB', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Barako Ignition Switch', sku: 'IGS-BARAKO-TTGR', brand: 'TTGR', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'XRM 125 Ignition Switch', sku: 'IGS-XRM125-KJR', brand: 'Kujira', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Wave 110R Ignition Switch', sku: 'IGS-WAVE110R-WTL', brand: 'Wuntal', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Mio Soul Ignition Switch', sku: 'IGS-MIOSOUL-TTGR', brand: 'TTGR', categoryKey: 'ignitionSwitch', isSerialized: true },
  { name: 'Mio Ignition Switch', sku: 'IGS-MIO-TTGR', brand: 'TTGR', categoryKey: 'ignitionSwitch', isSerialized: true },

  // --- Tank Cap ---
  { name: 'TMX Tank Cap', sku: 'TNK-TMX-FMP', brand: 'FMP', categoryKey: 'tankCap', isSerialized: true },
  { name: 'TMX Het Tank Cap', sku: 'TNK-TMXHET-FMP', brand: 'FMP', categoryKey: 'tankCap', isSerialized: true },
  { name: 'Barako Tank Cap', sku: 'TNK-BARAKO-KRY', brand: 'Kryon', categoryKey: 'tankCap', isSerialized: true },
  { name: 'YTX 125 Tank Cap', sku: 'TNK-YTX125-KRY', brand: 'Kryon', categoryKey: 'tankCap', isSerialized: true },
  { name: 'TMX Supremo Tank Cap', sku: 'TNK-TMXSUP-KJR', brand: 'Kujira', categoryKey: 'tankCap', isSerialized: true },

  // --- Clutch Lining ---
  { name: 'Rmahn Clutch Lining', sku: 'CL-RMAHN-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'XRM Clutch Lining', sku: 'CL-XRM-VNW', brand: 'Vnowar', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'HD3 Clutch Lining', sku: 'CL-HD3-MKT', brand: 'Makoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Honda Clutch Lining', sku: 'CL-HONDA', brand: 'Honda', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Kawasaki Clutch Lining (Barato)', sku: 'CL-KAW-BARATO', brand: 'Kawasaki', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Dream Clutch Lining', sku: 'CL-DREAM-HONDA', brand: 'Honda', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'C100 Bajaj Clutch Lining', sku: 'CL-C100BAJAJ-KNC', brand: 'KNC', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Wave 125 Clutch Lining', sku: 'CL-WAVE125-KNC', brand: 'KNC', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'RR100 Clutch Lining', sku: 'CL-RR100-FKY', brand: 'Fukuyama', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Rouser 135 Clutch Lining', sku: 'CL-RS135-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'C100 Dream Clutch Lining', sku: 'CL-C100DREAM-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'W125 Clutch Lining', sku: 'CL-W125-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'R150 Clutch Lining', sku: 'CL-R150-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'Fury Clutch Lining', sku: 'CL-FURY-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'BC175 Clutch Lining (RLV)', sku: 'CL-BC175-RLV', brand: 'RLV', categoryKey: 'clutchLining', isSerialized: true },
  { name: 'BC175 Clutch Lining (Yakimoto)', sku: 'CL-BC175-YKM', brand: 'Yakimoto', categoryKey: 'clutchLining', isSerialized: true },

  // --- Relay ---
  { name: 'R150 Starter Relay', sku: 'RLY-R150STR-TTGR', brand: 'TTGR', categoryKey: 'relay', isSerialized: true },
  { name: 'BC175 Relay', sku: 'RLY-BC175-TTGR', brand: 'TTGR', categoryKey: 'relay', isSerialized: true },
  { name: 'GYG Relay', sku: 'RLY-GYG-YKM', brand: 'Yakimoto', categoryKey: 'relay', isSerialized: true },
  { name: 'Run 150 Relay', sku: 'RLY-RUN150-YKM', brand: 'Yakimoto', categoryKey: 'relay', isSerialized: true },
  { name: 'GYG 125 Relay', sku: 'RLY-GYG125-VNW', brand: 'Vnowar', categoryKey: 'relay', isSerialized: true },
  { name: 'Horn Relay', sku: 'RLY-HORN', categoryKey: 'relay', isSerialized: true },
  { name: 'Interruptor Relay', sku: 'RLY-INTERRUPTOR', categoryKey: 'relay', isSerialized: true },
  { name: 'Flasher Relay (Round, KMN)', sku: 'RLY-FLASH-RND-KMN', brand: 'KMN', categoryKey: 'relay', isSerialized: true },
  { name: 'Flasher Relay (No Round)', sku: 'RLY-FLASH-NORND', categoryKey: 'relay', isSerialized: true },

  // --- Brake Pad ---
  { name: 'Click 125/150 Brake Pad', sku: 'BP-CLICK125150-1101', brand: '1101', categoryKey: 'brakePad', isSerialized: true },
  { name: 'PCX / ADV Rear Brake Pad', sku: 'BP-PCXADV-REAR-KNC', brand: 'KNC', categoryKey: 'brakePad', isSerialized: true },
  { name: 'ADV / PCX Front Brake Pad', sku: 'BP-ADVPCX-FRONT-FMP', brand: 'FMP', categoryKey: 'brakePad', isSerialized: true },
  { name: 'PCX 150 Front Brake Pad', sku: 'BP-PCX150-FRONT-KNC', brand: 'KNC', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Mio Soul / Sniper 135 Brake Pad', sku: 'BP-MIOSNP135-KNC', brand: 'KNC', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Beat / Click 125/150 Brake Pad', sku: 'BP-BEATCLICK-KRY', brand: 'Kryon', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Fury Brake Pad', sku: 'BP-FURY-KNC', brand: 'KNC', categoryKey: 'brakePad', isSerialized: true },
  { name: 'R150 Fi Brake Pad', sku: 'BP-R150FI-KNC', brand: 'KNC', categoryKey: 'brakePad', isSerialized: true },
  { name: 'R150 Fi Front Brake Pad', sku: 'BP-R150FI-FRONT-KNC', brand: 'KNC', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Shogun / R150 Front Brake Pad', sku: 'BP-SHOGUNR150-FRONT-KRY', brand: 'Kryon', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Wave 125 Brake Pad', sku: 'BP-WAVE125-TTGR', brand: 'TTGR', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Mio i125 Brake Pad', sku: 'BP-MIOI125-TTGR', brand: 'TTGR', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Rouser 220 Brake Pad', sku: 'BP-RS220-DHT', brand: 'DHT', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Beat 125 Brake Pad', sku: 'BP-BEAT125-MHB', brand: 'Mihniba', categoryKey: 'brakePad', isSerialized: true },
  { name: 'Wave 125 Brake Pad (Mihniba)', sku: 'BP-WAVE125-MHB', brand: 'Mihniba', categoryKey: 'brakePad', isSerialized: true },

  // --- Throttle Cable ---
  { name: 'TMX 155 Throttle Cable (1101)', sku: 'THR-TMX155-1101', brand: '1101', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'TMX 155 Throttle Cable (Otaka)', sku: 'THR-TMX155-OTK', brand: 'Otaka', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'TMX 155 Throttle Cable (KNC)', sku: 'THR-TMX155-KNC', brand: 'KNC', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Supremo Throttle Cable (Makoto)', sku: 'THR-SUP-MKT', brand: 'Makoto', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Supremo Throttle Cable (Mihniba)', sku: 'THR-SUP-MHB', brand: 'Mihniba', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Barako Throttle Cable (Makoto)', sku: 'THR-BARAKO-MKT', brand: 'Makoto', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Barako Throttle Cable (KNC)', sku: 'THR-BARAKO-KNC', brand: 'KNC', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Wygo Throttle Cable', sku: 'THR-WYGO', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Wave 125 Throttle Cable', sku: 'THR-WAVE125-LN', brand: 'LN', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'XRM 110 Throttle Cable', sku: 'THR-XRM110-TKR', brand: 'Takarago', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Wave 100 Throttle Cable', sku: 'THR-WAVE100-OTK', brand: 'Otaka', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'YTX 125 Throttle Cable (1101)', sku: 'THR-YTX125-1101', brand: '1101', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'YTX Throttle Cable (Makoto)', sku: 'THR-YTX-MKT', brand: 'Makoto', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'YTX Throttle Cable (Zecheng)', sku: 'THR-YTX-ZCH', brand: 'Zecheng', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'YTX 125 Throttle Cable (Takarago)', sku: 'THR-YTX125-TKR', brand: 'Takarago', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'YTX 125 Throttle Cable (Otaka)', sku: 'THR-YTX125-OTK', brand: 'Otaka', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'HD3 Throttle Cable', sku: 'THR-HD3-KRY', brand: 'Kryon', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'R150 Throttle Cable (Kryon)', sku: 'THR-R150-KRY', brand: 'Kryon', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'R150 Throttle Cable (Eiko)', sku: 'THR-R150-EIKO', brand: 'Eiko', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Sniper 150 Throttle Cable', sku: 'THR-SNP150-KRY', brand: 'Kryon', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'GYG 150 Throttle Cable', sku: 'THR-GYG150-KNC', brand: 'KNC', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'GYG 125 Throttle Cable', sku: 'THR-GYG125-MLL', brand: 'Molali', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'NMAX Throttle Cable', sku: 'THR-NMAX-KRY', brand: 'Kryon', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Aerox 155 Throttle Cable', sku: 'THR-AEROX155-MKT', brand: 'Makoto', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Click 125 Throttle Cable', sku: 'THR-CLICK125-1101', brand: '1101', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Mio i125 Throttle Cable', sku: 'THR-MIOI125-MBI', brand: 'MBI', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'Mio Throttle Cable', sku: 'THR-MIO-ZCH', brand: 'Zecheng', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'TMX Supremo Throttle Cable (Thai Worker)', sku: 'THR-TMXSUP-THAI', brand: 'Thai Worker', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'TMX Supremo Throttle Cable (Makoto)', sku: 'THR-TMXSUP-MKT', brand: 'Makoto', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'TC150 Throttle Cable (Otaka)', sku: 'THR-TC150-OTK', brand: 'Otaka', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'TC150 Throttle Cable (Zecheng)', sku: 'THR-TC150-ZCH', brand: 'Zecheng', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'TC125 Throttle Cable (1101)', sku: 'THR-TC125-1101', brand: '1101', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'TC125 Throttle Cable (Otaka)', sku: 'THR-TC125-OTK', brand: 'Otaka', categoryKey: 'throttleCable', isSerialized: true },
  { name: 'CG125 Throttle Cable', sku: 'THR-CG125-OTK', brand: 'Otaka', categoryKey: 'throttleCable', isSerialized: true },

  // Clutch cable found on the cable page (routed to existing Clutch Cable category).
  { name: 'TMX 155 Clutch Cable (Otaka)', sku: 'CLT-TMX155-OTK', brand: 'Otaka', categoryKey: 'clutch', isSerialized: true },

  // --- Ignition Coil ---
  { name: 'Barako Ignition Coil', sku: 'IGC-BARAKO-TKR', brand: 'Takarago', categoryKey: 'ignitionCoil', isSerialized: true },
  { name: 'TMX Charge Coil', sku: 'IGC-TMX-YMT', brand: 'Yamato', categoryKey: 'ignitionCoil', isSerialized: true },
  { name: 'GP125 Ignition Coil', sku: 'IGC-GP125-TKR', brand: 'Takarago', categoryKey: 'ignitionCoil', isSerialized: true },
  { name: 'X4 Ignition Coil', sku: 'IGC-X4-TKR', brand: 'Takarago', categoryKey: 'ignitionCoil', isSerialized: true },
  { name: 'HD3 Ignition Coil', sku: 'IGC-HD3-TKR', brand: 'Takarago', categoryKey: 'ignitionCoil', isSerialized: true },

  // --- Primary Coil ---
  { name: 'C100 Primary Coil', sku: 'PRC-C100-YKM', brand: 'Yakimoto', categoryKey: 'primaryCoil', isSerialized: true },
  { name: 'C100 / Dream Primary Coil', sku: 'PRC-C100DREAM-YKM', brand: 'Yakimoto', categoryKey: 'primaryCoil', isSerialized: true },
  { name: 'CT100 Primary Coil', sku: 'PRC-CT100-YHK', brand: 'YHK', categoryKey: 'primaryCoil', isSerialized: true },
  { name: 'TMX 155 Primary Coil', sku: 'PRC-TMX155-BY', brand: 'BY', categoryKey: 'primaryCoil', isSerialized: true },
  { name: 'TMX 155 Ignition Coil (Vmax)', sku: 'PRC-TMX155-VMX', brand: 'Vmax', categoryKey: 'primaryCoil', isSerialized: true },
  { name: 'C100 Ignition Coil (Vmax)', sku: 'PRC-C100-VMX', brand: 'Vmax', categoryKey: 'primaryCoil', isSerialized: true },

  // --- Brake Shoe ---
  { name: 'TMX Front Brake Shoe (Menol)', sku: 'BS-TMX-FRONT-MNL', brand: 'Menol', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'TMX Front Brake Shoe (YK)', sku: 'BS-TMX-FRONT-YK', brand: 'YK', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'TMX Front/Rear Brake Shoe (MVK)', sku: 'BS-TMX-FRONTREAR-MVK', brand: 'MVK', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'TMX 155 Front Brake Shoe', sku: 'BS-TMX155-FRONT-KRA', brand: 'KRA', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Mio Brake Shoe', sku: 'BS-MIO-OTK', brand: 'Otaka', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'TMX 155 Rear Brake Shoe (Speed)', sku: 'BS-TMX155-REAR-SPD', brand: 'Speed', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'XRM 110 / GD110 Brake Shoe', sku: 'BS-XRM110GD110-OTK', brand: 'Otaka', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'TMX Alpha Front Brake Shoe', sku: 'BS-TMXALP-FRONT-MNL', brand: 'Menol', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Barako Brake Shoe', sku: 'BS-BARAKO-OTK', brand: 'Otaka', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'HD3 Brake Shoe', sku: 'BS-HD3-OTK', brand: 'Otaka', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'Honda Beat Brake Shoe', sku: 'BS-BEAT-OTK', brand: 'Otaka', categoryKey: 'brakeShoe', isSerialized: true },
  { name: 'TMX Rear Brake Shoe (Menol)', sku: 'BS-TMX-REAR-MNL', brand: 'Menol', categoryKey: 'brakeShoe', isSerialized: true },

  // --- Timing Chain ---
  { name: 'XRM / Wave Timing Chain Set', sku: 'TMC-XRMWAVE-CWJ', brand: 'Chicken Worker Japan', categoryKey: 'timingChain', isSerialized: true },
  { name: '25H 88L Honda Timing Chain Set', sku: 'TMC-25H88L-HONDA', brand: 'Honda', categoryKey: 'timingChain', isSerialized: true },
  { name: 'Wave 125 Chain Guide Set', sku: 'TMC-WAVE125-GUIDE-MRM', brand: 'MRM', categoryKey: 'timingChain', isSerialized: true },
  { name: 'Barako Timing Chain', sku: 'TMC-BARAKO-TTGR', brand: 'TTGR', categoryKey: 'timingChain', isSerialized: true },
  { name: 'XRM Timing Chain', sku: 'TMC-XRM-YKM', brand: 'Yakimoto', categoryKey: 'timingChain', isSerialized: true },
  { name: '25H 88L Timing Chain (DID)', sku: 'TMC-25H88L-DID', brand: 'DID', categoryKey: 'timingChain', isSerialized: true },
  { name: '25H 88L Timing Chain (KHC)', sku: 'TMC-25H88L-KHC', brand: 'KHC', categoryKey: 'timingChain', isSerialized: true },
  { name: 'XRM 110 Timing Chain', sku: 'TMC-XRM110-MKT', brand: 'Makoto', categoryKey: 'timingChain', isSerialized: true },
  { name: 'XRM 110 Starter Chain', sku: 'TMC-XRM110-STARTER-MKT', brand: 'Makoto', categoryKey: 'timingChain', isSerialized: true },
  { name: '25H 94L Timing Chain', sku: 'TMC-25H94L-KNC', brand: 'KNC', categoryKey: 'timingChain', isSerialized: true },

  // --- Lever ---
  { name: 'Universal Handle with Lever', sku: 'LVR-UNIV-HANDLE-YKM', brand: 'Yakimoto', categoryKey: 'lever', isSerialized: true },
  { name: 'HD3 Brake Lever', sku: 'LVR-HD3-BRK-YKM', brand: 'Yakimoto', categoryKey: 'lever', isSerialized: true },
  { name: 'XRM Brake Lever', sku: 'LVR-XRM-BRK-YKM', brand: 'Yakimoto', categoryKey: 'lever', isSerialized: true },
  { name: 'Supremo Brake Lever', sku: 'LVR-SUP-BRK-YKM', brand: 'Yakimoto', categoryKey: 'lever', isSerialized: true },
  { name: 'Barako Brake Lever', sku: 'LVR-BARAKO-BRK-OTK', brand: 'Otaka', categoryKey: 'lever', isSerialized: true },
  { name: 'Barako Clutch Lever', sku: 'LVR-BARAKO-CLT-OTK', brand: 'Otaka', categoryKey: 'lever', isSerialized: true },
  { name: 'Mio 125 Brake Lever', sku: 'LVR-MIO125-BRK', categoryKey: 'lever', isSerialized: true },
  { name: 'TMX 155 L/R Lever', sku: 'LVR-TMX155-LR-KNC', brand: 'KNC', categoryKey: 'lever', isSerialized: true },
  { name: 'TMX 155 Lever / Switch', sku: 'LVR-TMX155-SWITCH', categoryKey: 'lever', isSerialized: true },
  { name: 'TC125 Handle / Lever', sku: 'LVR-TC125-HANDLE', categoryKey: 'lever', isSerialized: true },
  { name: 'Wygo Handle / Lever', sku: 'LVR-WYGO-HANDLE', categoryKey: 'lever', isSerialized: true },

  // --- Battery ---
  { name: '12N7L Battery (Dayway)', sku: 'BAT-12N7L-DW', brand: 'Dayway', categoryKey: 'battery', isSerialized: true },
  { name: 'YTX7A Battery (Dayway)', sku: 'BAT-YTX7A-DW', brand: 'Dayway', categoryKey: 'battery', isSerialized: true },
  { name: '12NC5 Battery (Dayway)', sku: 'BAT-12NC5-DW', brand: 'Dayway', categoryKey: 'battery', isSerialized: true },
  { name: 'YTX5A Battery (Dayway)', sku: 'BAT-YTX5A-DW', brand: 'Dayway', categoryKey: 'battery', isSerialized: true },
  { name: '12N6.5L Battery (OD)', sku: 'BAT-12N65L-OD', brand: 'OD', categoryKey: 'battery', isSerialized: true },
  { name: '12N5L Battery (OD)', sku: 'BAT-12N5L-OD', brand: 'OD', categoryKey: 'battery', isSerialized: true },
  { name: 'YTZ7 Battery (OD)', sku: 'BAT-YTZ7-OD', brand: 'OD', categoryKey: 'battery', isSerialized: true },
  { name: 'YTX5L Battery (OD)', sku: 'BAT-YTX5L-OD', brand: 'OD', categoryKey: 'battery', isSerialized: true },
  { name: 'YB3L Battery (OD)', sku: 'BAT-YB3L-OD', brand: 'OD', categoryKey: 'battery', isSerialized: true },

  // --- Regulator ---
  { name: 'TMX 155 Regulator', sku: 'REG-TMX155-NEP', brand: 'NEP', categoryKey: 'regulator', isSerialized: true },
  { name: 'Wind 125 Regulator', sku: 'REG-WIND125-POG', brand: 'POG', categoryKey: 'regulator', isSerialized: true },
  { name: 'Wygo Regulator', sku: 'REG-WYGO', categoryKey: 'regulator', isSerialized: true },
  { name: 'TMX Supremo Regulator', sku: 'REG-TMXSUP-TTGR', brand: 'TTGR', categoryKey: 'regulator', isSerialized: true },
  { name: 'TMX Alpha Regulator', sku: 'REG-TMXALP-TTGR', brand: 'TTGR', categoryKey: 'regulator', isSerialized: true },
  { name: 'TMX Regulator (Vnowar)', sku: 'REG-TMX-VNW', brand: 'Vnowar', categoryKey: 'regulator', isSerialized: true },
  { name: 'Barako Regulator', sku: 'REG-BARAKO-TTGR', brand: 'TTGR', categoryKey: 'regulator', isSerialized: true },
  { name: '5 Wire Regulator', sku: 'REG-5WIRE-TTGR', brand: 'TTGR', categoryKey: 'regulator', isSerialized: true },
  { name: 'Mio Regulator', sku: 'REG-MIO-KRX', brand: 'KRX', categoryKey: 'regulator', isSerialized: true },
  { name: 'CT100 Regulator', sku: 'REG-CT100-YKM', brand: 'Yakimoto', categoryKey: 'regulator', isSerialized: true },
  { name: 'R150 Regulator', sku: 'REG-R150-VNW', brand: 'Vnowar', categoryKey: 'regulator', isSerialized: true },

  // --- CDI ---
  { name: 'CG125 CDI', sku: 'CDI-CG125-TTGR', brand: 'TTGR', categoryKey: 'cdi', isSerialized: true },
  { name: 'Rusi 125 CDI', sku: 'CDI-RUSI125', categoryKey: 'cdi', isSerialized: true },
  { name: 'LF110 CDI', sku: 'CDI-LF110-KMN', brand: 'KMN', categoryKey: 'cdi', isSerialized: true },
  { name: 'Barako CDI', sku: 'CDI-BARAKO-TTGR', brand: 'TTGR', categoryKey: 'cdi', isSerialized: true },
  { name: 'CG125 CDI (KRA)', sku: 'CDI-CG125-KRA', brand: 'KRA', categoryKey: 'cdi', isSerialized: true },
  { name: 'TMX 155 CDI', sku: 'CDI-TMX155-KRA', brand: 'KRA', categoryKey: 'cdi', isSerialized: true },
  { name: 'TMX Supremo CDI', sku: 'CDI-TMXSUP-KRY', brand: 'Kryon', categoryKey: 'cdi', isSerialized: true },
  { name: 'CB125 CDI', sku: 'CDI-CB125-QTM', brand: 'Quantum', categoryKey: 'cdi', isSerialized: true },
  { name: 'XRM CDI', sku: 'CDI-XRM-OPAO', brand: 'Opao', categoryKey: 'cdi', isSerialized: true },
  { name: 'CT150 CDI', sku: 'CDI-CT150-YKM', brand: 'Yakimoto', categoryKey: 'cdi', isSerialized: true },
  { name: 'Motorstar CDI', sku: 'CDI-MOTORSTAR-YKM', brand: 'Yakimoto', categoryKey: 'cdi', isSerialized: true },

  // --- Stator ---
  { name: 'Bajaj RZL Stator', sku: 'STR-BAJAJ-RZL', brand: 'RZL', categoryKey: 'stator', isSerialized: true },
  { name: 'TMX 155 Stator', sku: 'STR-TMX155-VNW', brand: 'Vnowar', categoryKey: 'stator', isSerialized: true },
  { name: 'CG125 Stator', sku: 'STR-CG125-VNW', brand: 'Vnowar', categoryKey: 'stator', isSerialized: true },
  { name: 'XRM 110 Stator', sku: 'STR-XRM110-VNW', brand: 'Vnowar', categoryKey: 'stator', isSerialized: true },
  { name: 'Rusi 125 Stator', sku: 'STR-RUSI125-KRA', brand: 'KRA', categoryKey: 'stator', isSerialized: true },
  { name: 'TMX 125 Alpha Stator (No Brand)', sku: 'STR-TMX125ALP-NB', categoryKey: 'stator', isSerialized: true },
  { name: 'TMX 125 Stator (Rayana)', sku: 'STR-TMX125-RYN', brand: 'Rayana', categoryKey: 'stator', isSerialized: true },
  { name: 'BC175 Stator', sku: 'STR-BC175-NEP', brand: 'NEP', categoryKey: 'stator', isSerialized: true },
  { name: 'Supremo Stator', sku: 'STR-SUP-NEP', brand: 'NEP', categoryKey: 'stator', isSerialized: true },
  { name: 'C100 Stator', sku: 'STR-C100-NEP', brand: 'NEP', categoryKey: 'stator', isSerialized: true },
  { name: 'Wave 125 Stator', sku: 'STR-WAVE125-RLV', brand: 'RLV', categoryKey: 'stator', isSerialized: true },

  // --- Carburetor Kit ---
  { name: 'Wave 125 Carburetor Kit', sku: 'CBK-WAVE125-IPART', brand: 'iPart', categoryKey: 'carburetorKit', isSerialized: true },
  { name: 'HD3 Carburetor Kit', sku: 'CBK-HD3-KRR', brand: 'KRR', categoryKey: 'carburetorKit', isSerialized: true },
  { name: 'BC175 Carburetor Kit (EOK)', sku: 'CBK-BC175-EOK', brand: 'EOK', categoryKey: 'carburetorKit', isSerialized: true },
  { name: 'XRM Carburetor Kit', sku: 'CBK-XRM-CHONO', brand: 'Chono', categoryKey: 'carburetorKit', isSerialized: true },
  { name: 'BC175 Carburetor Kit (Keyster)', sku: 'CBK-BC175-KEY', brand: 'Keyster', categoryKey: 'carburetorKit', isSerialized: true },
  { name: 'XRM 110 Carburetor Kit (Keyster)', sku: 'CBK-XRM110-KEY', brand: 'Keyster', categoryKey: 'carburetorKit', isSerialized: true },
  { name: 'Raider 150 Carburetor Kit', sku: 'CBK-RDR150', categoryKey: 'carburetorKit', isSerialized: true },

  // --- Carburetor ---
  { name: 'TMX Supremo Carburetor', sku: 'CRB-TMXSUP-KEIHIN', brand: 'Keihin', categoryKey: 'carburetor', isSerialized: true },
  { name: 'TMX 155 Carburetor', sku: 'CRB-TMX155', categoryKey: 'carburetor', isSerialized: true },
  { name: 'Rmahn Carburetor', sku: 'CRB-RMAHN', categoryKey: 'carburetor', isSerialized: true },
  { name: 'XRM 110 Carburetor', sku: 'CRB-XRM110', categoryKey: 'carburetor', isSerialized: true },
  { name: 'Mio Carburetor', sku: 'CRB-MIO', categoryKey: 'carburetor', isSerialized: true },
  { name: '24mm Carburetor', sku: 'CRB-24MM', categoryKey: 'carburetor', isSerialized: true },
  { name: 'Barako Carburetor', sku: 'CRB-BARAKO', categoryKey: 'carburetor', isSerialized: true },
  { name: '28mm No Brand Carburetor', sku: 'CRB-28MM-NB', categoryKey: 'carburetor', isSerialized: true },

  // --- Connecting Rod ---
  { name: 'Wave 110 Alpha Connecting Rod', sku: 'CNR-WAVE110ALP-MKT', brand: 'Makoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'Wave 110/125/XRM Connecting Rod', sku: 'CNR-WAVE110125XRM-MKT', brand: 'Makoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'HD3 Connecting Rod', sku: 'CNR-HD3', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'CG125 Connecting Rod (Wygo)', sku: 'CNR-CG125-WYGO', brand: 'Wygo', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'CG125 Connecting Rod (ABR)', sku: 'CNR-CG125-ABR', brand: 'ABR', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'BC175 Barako Connecting Rod', sku: 'CNR-BC175BARAKO-MKT', brand: 'Makoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'Mio Connecting Rod', sku: 'CNR-MIO-YKM', brand: 'Yakimoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'CT100 Connecting Rod', sku: 'CNR-CT100-YKM', brand: 'Yakimoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'XRM Connecting Rod', sku: 'CNR-XRM-YKM', brand: 'Yakimoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'TMX Connecting Rod', sku: 'CNR-TMX-YKM', brand: 'Yakimoto', categoryKey: 'connectingRod', isSerialized: true },
  { name: 'BC175 Connecting Rod', sku: 'CNR-BC175-YKM', brand: 'Yakimoto', categoryKey: 'connectingRod', isSerialized: true },

  // --- Camshaft ---
  { name: 'Wave 100 Camshaft', sku: 'CAM-WAVE100-MKN', brand: 'MKN', categoryKey: 'camshaft', isSerialized: true },
  { name: 'BC175 Camshaft', sku: 'CAM-BC175-TTGR', brand: 'TTGR', categoryKey: 'camshaft', isSerialized: true },
  { name: 'TMX 155 Camshaft', sku: 'CAM-TMX155-PAG', brand: 'PAG', categoryKey: 'camshaft', isSerialized: true },

  // --- Rocker Arm ---
  { name: 'TMX Rocker Arm', sku: 'RKA-TMX-YKM', brand: 'Yakimoto', categoryKey: 'rockerArm', isSerialized: true },
  { name: 'XRM Rocker Arm', sku: 'RKA-XRM-YKM', brand: 'Yakimoto', categoryKey: 'rockerArm', isSerialized: true },
  { name: 'Darn Rocker Arm', sku: 'RKA-DARN-YKM', brand: 'Yakimoto', categoryKey: 'rockerArm', isSerialized: true },
  { name: 'Rmahn Rocker Arm', sku: 'RKA-RMAHN-YKM', brand: 'Yakimoto', categoryKey: 'rockerArm', isSerialized: true },
  { name: 'Wave 110 Rocker Arm', sku: 'RKA-WAVE110-YKM', brand: 'Yakimoto', categoryKey: 'rockerArm', isSerialized: true },

  // --- Cam Follower ---
  { name: 'TMX Cam Follower (PAG)', sku: 'CMF-TMX-PAG', brand: 'PAG', categoryKey: 'camFollower', isSerialized: true },
  { name: 'TMX Cam Follower (Open)', sku: 'CMF-TMX-OPEN', categoryKey: 'camFollower', isSerialized: true },

  // --- Cylinder Block ---
  { name: 'TMX 155 Cylinder Block', sku: 'CYB-TMX155-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Motostar Pinoy 150 Cylinder Block', sku: 'CYB-MSPINOY150-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Barako B1 Cylinder Block', sku: 'CYB-BARAKOB1-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'CG150 Cylinder Block', sku: 'CYB-CG150-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'LF125 Cylinder Block', sku: 'CYB-LF125-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'CG125 Cylinder Block (MTK)', sku: 'CYB-CG125-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'CG125 Cylinder Block (MP)', sku: 'CYB-CG125-MP', brand: 'MP', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Rmahn 115 Cylinder Block', sku: 'CYB-RMAHN115-MP', brand: 'MP', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'LF110 Cylinder Block', sku: 'CYB-LF110-MP', brand: 'MP', categoryKey: 'cylinderBlock', isSerialized: true },
  { name: 'Wave 100 Cylinder Block', sku: 'CYB-WAVE100-MTK', brand: 'MTK', categoryKey: 'cylinderBlock', isSerialized: true },

  // --- Brake Rod ---
  { name: 'No Brand Brake Rod', sku: 'BRD-NB', categoryKey: 'brakeRod', isSerialized: true },
  { name: 'XRM 110 Brake Rod', sku: 'BRD-XRM110', categoryKey: 'brakeRod', isSerialized: true },
  { name: 'X4 Brake Rod', sku: 'BRD-X4', categoryKey: 'brakeRod', isSerialized: true },
  { name: 'Barako Brake Rod', sku: 'BRD-BARAKO', categoryKey: 'brakeRod', isSerialized: true },
  { name: 'TMX 155 Brake Rod', sku: 'BRD-TMX155', categoryKey: 'brakeRod', isSerialized: true },

  // --- Wire Harness ---
  { name: 'CG125 Wire Harness', sku: 'WH-CG125-WYGO', brand: 'Wygo', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'HD3 Wire Harness (Yakimoto)', sku: 'WH-HD3-YKM', brand: 'Yakimoto', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'HD3 Wire Harness (No Brand)', sku: 'WH-HD3-NB', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'Barako Wire Harness (No Brand)', sku: 'WH-BARAKO-NB', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'TMX 155 Wire Harness', sku: 'WH-TMX155-HONDA', brand: 'Honda', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'Mio Wire Harness', sku: 'WH-MIO-EPOWER', brand: 'Epower', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'CT100 Wire Harness', sku: 'WH-CT100-EPOWER', brand: 'Epower', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'GYG Wire Harness', sku: 'WH-GYG-KNC', brand: 'KNC', categoryKey: 'wireHarness', isSerialized: true },
  { name: 'No Brand Wire Harness', sku: 'WH-NB', categoryKey: 'wireHarness', isSerialized: true },

  // --- Axle ---
  { name: 'TMX Alpha Front Axle', sku: 'AXL-TMXALP-FRONT', categoryKey: 'axle', isSerialized: true },
  { name: 'Mio Axle', sku: 'AXL-MIO', categoryKey: 'axle', isSerialized: true },
  { name: 'TC150 / 125 Axle', sku: 'AXL-TC150125', categoryKey: 'axle', isSerialized: true },
  { name: 'XRM Axle', sku: 'AXL-XRM', categoryKey: 'axle', isSerialized: true },
  { name: 'GP125 / X4 Axle', sku: 'AXL-GP125X4', categoryKey: 'axle', isSerialized: true },
  { name: 'TMX 155 Front Axle', sku: 'AXL-TMX155-FRONT', categoryKey: 'axle', isSerialized: true },
  { name: 'TMX 155 / RR100 Rear Axle', sku: 'AXL-TMX155RR100-REAR', categoryKey: 'axle', isSerialized: true },
  { name: 'Wave 100 Axle', sku: 'AXL-WAVE100', categoryKey: 'axle', isSerialized: true },
  { name: 'TMX125 / Rusi Main Stand Shaft', sku: 'AXL-TMX125RUSI-MAINSTAND', categoryKey: 'axle', isSerialized: true },
  { name: 'TMX 155 Main Stand Shaft', sku: 'AXL-TMX155-MAINSTAND', categoryKey: 'axle', isSerialized: true },
  { name: 'No Brand Axle', sku: 'AXL-NB', categoryKey: 'axle', isSerialized: true },

  // --- Piston / Piston Ring ---
  { name: 'LF125 Piston', sku: 'PST-LF125-MYK', brand: 'Miyako', categoryKey: 'piston', isSerialized: true },
  { name: 'LF150 Piston', sku: 'PST-LF150-MYC', brand: 'Miyaco', categoryKey: 'piston', isSerialized: true },
  { name: 'GYG 150 Piston', sku: 'PST-GYG150-HALO', brand: 'Halo', categoryKey: 'piston', isSerialized: true },
  { name: 'GYG 125 Piston', sku: 'PST-GYG125-MYC', brand: 'Miyaco', categoryKey: 'piston', isSerialized: true },
  { name: 'XRM Piston', sku: 'PST-XRM-HALO', brand: 'Halo', categoryKey: 'piston', isSerialized: true },
  { name: 'XRM 110 Piston', sku: 'PST-XRM110-YMT', brand: 'Yamato', categoryKey: 'piston', isSerialized: true },
  { name: 'BC175 Piston (Halo)', sku: 'PST-BC175-HALO', brand: 'Halo', categoryKey: 'piston', isSerialized: true },
  { name: 'BC175 Piston (RIK)', sku: 'PST-BC175-RIK', brand: 'RIK', categoryKey: 'piston', isSerialized: true },
  { name: 'CG125 Piston', sku: 'PST-CG125-WYGO', brand: 'Wygo', categoryKey: 'piston', isSerialized: true },
  { name: 'Wave 100 Piston', sku: 'PST-WAVE100-RLV', brand: 'RLV', categoryKey: 'piston', isSerialized: true },
  { name: 'C100 Piston (Billion)', sku: 'PST-C100-BIL', brand: 'Billion', categoryKey: 'piston', isSerialized: true },
  { name: 'C100 Piston (Halo)', sku: 'PST-C100-HALO', brand: 'Halo', categoryKey: 'piston', isSerialized: true },
  { name: 'Mio Piston (Mihniba)', sku: 'PST-MIO-MHB', brand: 'Mihniba', categoryKey: 'piston', isSerialized: true },
  { name: 'Mio Piston (RLV)', sku: 'PST-MIO-RLV', brand: 'RLV', categoryKey: 'piston', isSerialized: true },
  { name: 'TMX 155 Piston', sku: 'PST-TMX155-MYC', brand: 'Miyaco', categoryKey: 'piston', isSerialized: true },
  { name: 'TMX 125 Piston', sku: 'PST-TMX125-HALO', brand: 'Halo', categoryKey: 'piston', isSerialized: true },
  { name: 'TMX New Piston', sku: 'PST-TMXNEW-RLV', brand: 'RLV', categoryKey: 'piston', isSerialized: true },
  { name: 'RXT 125 Piston', sku: 'PST-RXT125-RIK', brand: 'RIK', categoryKey: 'piston', isSerialized: true },
  { name: 'CG150 Piston (Marathon)', sku: 'PST-CG150-MRTN', brand: 'Marathon', categoryKey: 'piston', isSerialized: true },
  { name: 'CG150 Piston (Billion)', sku: 'PST-CG150-BIL', brand: 'Billion', categoryKey: 'piston', isSerialized: true },
  { name: 'Pinoy 125 Piston', sku: 'PST-PINOY125-MKT', brand: 'Makoto', categoryKey: 'piston', isSerialized: true },
  { name: 'Pinoy 150 Piston', sku: 'PST-PINOY150-MKT', brand: 'Makoto', categoryKey: 'piston', isSerialized: true },
  { name: 'HD3 Piston', sku: 'PST-HD3-KAW', brand: 'Kawasaki', categoryKey: 'piston', isSerialized: true },
  { name: 'Mio Sporty Piston', sku: 'PST-MIOSPORTY-MYC', brand: 'Miyaco', categoryKey: 'piston', isSerialized: true },
  { name: 'LF110 Piston (Billion)', sku: 'PST-LF110-BIL', brand: 'Billion', categoryKey: 'piston', isSerialized: true },
  { name: 'LF110 Piston (MP)', sku: 'PST-LF110-MP', brand: 'MP', categoryKey: 'piston', isSerialized: true },
  { name: 'LF125 Piston (Billion)', sku: 'PST-LF125-BIL', brand: 'Billion', categoryKey: 'piston', isSerialized: true },
  { name: 'W125 Piston (Billion)', sku: 'PST-W125-BIL', brand: 'Billion', categoryKey: 'piston', isSerialized: true },
  { name: 'W125 Piston (MTK)', sku: 'PST-W125-MTK', brand: 'MTK', categoryKey: 'piston', isSerialized: true },
  { name: 'XRM Piston (Billion)', sku: 'PST-XRM-BIL', brand: 'Billion', categoryKey: 'piston', isSerialized: true },
  { name: 'CG150 Piston (RLV)', sku: 'PST-CG150-RLV', brand: 'RLV', categoryKey: 'piston', isSerialized: true },
  { name: 'Wolf 125 Piston', sku: 'PST-WOLF125-YMT', brand: 'Yamato', categoryKey: 'piston', isSerialized: true },
  { name: 'C100 Piston (Bajaj)', sku: 'PST-C100-BAJAJ', brand: 'Bajaj', categoryKey: 'piston', isSerialized: true },
  { name: 'C100 Piston (Makoto)', sku: 'PST-C100-MKT', brand: 'Makoto', categoryKey: 'piston', isSerialized: true },
  { name: 'C100 Piston (VRK)', sku: 'PST-C100-VRK', brand: 'VRK', categoryKey: 'piston', isSerialized: true },
  { name: 'BC175 Piston (RLV)', sku: 'PST-BC175-RLV', brand: 'RLV', categoryKey: 'piston', isSerialized: true },
  { name: 'BC175 Piston (Makoto)', sku: 'PST-BC175-MKT', brand: 'Makoto', categoryKey: 'piston', isSerialized: true },
  { name: 'Shogun Piston', sku: 'PST-SHOGUN-MP', brand: 'MP', categoryKey: 'piston', isSerialized: true },
  { name: 'TMX Piston (RLV)', sku: 'PST-TMX-RLV', brand: 'RLV', categoryKey: 'piston', isSerialized: true },
  { name: 'TMX Piston (MP)', sku: 'PST-TMX-MP', brand: 'MP', categoryKey: 'piston', isSerialized: true },

  // --- Meter Assembly ---
  { name: 'CG125 Meter Assembly', sku: 'MTA-CG125-WYGO', brand: 'Wygo', categoryKey: 'meterAssembly', isSerialized: true },
  { name: 'CG125 TL Meter Assembly', sku: 'MTA-CG125-TL', categoryKey: 'meterAssembly', isSerialized: true },

  // --- Headlight ---
  { name: 'TMX 125 Headlight', sku: 'HL-TMX125-SHK', brand: 'Sharking', categoryKey: 'headlight', isSerialized: true },
  { name: 'TMX 155 Headlight (Sharking)', sku: 'HL-TMX155-SHK', brand: 'Sharking', categoryKey: 'headlight', isSerialized: true },
  { name: 'Barako Headlight (Otaka)', sku: 'HL-BARAKO-OTK', brand: 'Otaka', categoryKey: 'headlight', isSerialized: true },
  { name: 'Barako Headlight Assembly (Suntal)', sku: 'HL-BARAKO-SUNTAL', brand: 'Suntal', categoryKey: 'headlight', isSerialized: true },
  { name: 'TMX 155 Headlight (No Brand)', sku: 'HL-TMX155-NB', categoryKey: 'headlight', isSerialized: true },
  { name: 'Barako Headlight (GRR)', sku: 'HL-BARAKO-GRR', brand: 'GRR', categoryKey: 'headlight', isSerialized: true },

  // --- Tail Light ---
  { name: 'Barako Tail Light (No Brand)', sku: 'TL-BARAKO-NB', categoryKey: 'tailLight', isSerialized: true },
  { name: 'TMX 125 Tail Light (No Brand)', sku: 'TL-TMX125-NB', categoryKey: 'tailLight', isSerialized: true },
  { name: 'TMX 155 Tail Light (No Brand)', sku: 'TL-TMX155-NB', categoryKey: 'tailLight', isSerialized: true },

  // --- Speedometer Gauge ---
  { name: 'TMX 125 Speedometer Crown Piece (KRX)', sku: 'SPG-TMX125-CROWN-KRX', brand: 'KRX', categoryKey: 'speedometerGauge', isSerialized: true },
  { name: 'TMX 125 Speedometer Crown Piece', sku: 'SPG-TMX125-CROWN', categoryKey: 'speedometerGauge', isSerialized: true },
  { name: 'TMX 155 Speedometer Gauge (KY By Moto)', sku: 'SPG-TMX155-KYBYMOTO', brand: 'KY By Moto', categoryKey: 'speedometerGauge', isSerialized: true },
  { name: 'TMX 155 Speedometer Gauge (Otaka)', sku: 'SPG-TMX155-OTK', brand: 'Otaka', categoryKey: 'speedometerGauge', isSerialized: true },
  { name: 'TMX 155 Speedometer Gauge (GRS)', sku: 'SPG-TMX155-GRS', brand: 'GRS', categoryKey: 'speedometerGauge', isSerialized: true },
  { name: 'Universal Speedometer Gauge (RZL)', sku: 'SPG-UNIV-RZL', brand: 'RZL', categoryKey: 'speedometerGauge', isSerialized: true },

  // --- Engine Oil (consumable) ---
  { name: 'Motul 800 Engine Oil', sku: 'OIL-MOTUL-800', brand: 'Motul', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Kawasaki 1L Engine Oil', sku: 'OIL-KAW-1L', brand: 'Kawasaki', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Havoline Block 1L Engine Oil', sku: 'OIL-HAVO-BLOCK-1L', brand: 'Havoline', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Petron Diesel Engine Oil', sku: 'OIL-PETRON-DIESEL', brand: 'Petron', categoryKey: 'engineOil', isSerialized: false },
  { name: 'RV8 1L Engine Oil', sku: 'OIL-RV8-1L', brand: 'RV8', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Shell Advance 1L Engine Oil', sku: 'OIL-SHELL-ADV-1L', brand: 'Shell', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Petron 1L Engine Oil', sku: 'OIL-PETRON-1L', brand: 'Petron', categoryKey: 'engineOil', isSerialized: false },
  { name: '2T Oil', sku: 'OIL-2T', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Petron 200 Oil', sku: 'OIL-PETRON-200', brand: 'Petron', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Havoline 800 Engine Oil', sku: 'OIL-HAVO-800', brand: 'Havoline', categoryKey: 'engineOil', isSerialized: false },
  { name: 'ZIC 1L Scooter Engine Oil', sku: 'OIL-ZIC-1L-SCOOTER', brand: 'ZIC', categoryKey: 'engineOil', isSerialized: false },
  { name: 'ZIC 800 Engine Oil', sku: 'OIL-ZIC-800', brand: 'ZIC', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Control 800 Engine Oil', sku: 'OIL-CONTROL-800', brand: 'Control', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Control 1L Engine Oil', sku: 'OIL-CONTROL-1L', brand: 'Control', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Competition 1L Engine Oil', sku: 'OIL-COMPETITION-1L', brand: 'Competition', categoryKey: 'engineOil', isSerialized: false },
  { name: 'Motul Scooter 1L Engine Oil', sku: 'OIL-MOTUL-SCOOTER-1L', brand: 'Motul', categoryKey: 'engineOil', isSerialized: false },

  // --- Coolant (consumable) ---
  { name: 'Top 1 Coolant', sku: 'COOL-TOP1', brand: 'Top 1', categoryKey: 'coolant', isSerialized: false },

  // --- Spray & Chemicals (consumable) ---
  { name: 'Cut Cleaner', sku: 'SPR-CUTCLEANER', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'WD-40', sku: 'SPR-WD40', brand: 'WD-40', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Bosny Blue Spray Paint', sku: 'SPR-BOSNY-BLUE', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Bosny Yellow Spray Paint', sku: 'SPR-BOSNY-YELLOW', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Bosny Primer Gray Spray Paint', sku: 'SPR-BOSNY-PRIMERGRAY', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Bosny Silver Spray Paint', sku: 'SPR-BOSNY-SILVER', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Bosny Dark Blue Spray Paint', sku: 'SPR-BOSNY-DARKBLUE', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Bosny Clear Spray Paint', sku: 'SPR-BOSNY-CLEAR', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Bosny High-Temp Gloss Black Spray Paint', sku: 'SPR-BOSNY-HTEMP-GLOSSBLACK', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Bosny Flat Black Spray Paint', sku: 'SPR-BOSNY-FLATBLACK', brand: 'Bosny', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Water Mark Stain Remover', sku: 'SPR-WATERMARK-REMOVER', categoryKey: 'sprayChemical', isSerialized: false },
  { name: 'Tire Black', sku: 'SPR-TIREBLACK-MTX', brand: 'MTX', categoryKey: 'sprayChemical', isSerialized: false },
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
  { name: '6001 Bearing', sku: 'BRG-6001-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6002 Bearing (V-Japan)', sku: 'BRG-6002-VJ', brand: 'V-Japan', categoryKey: 'bearing', isSerialized: false },
  { name: '6003 Bearing (V-Japan)', sku: 'BRG-6003-VJ', brand: 'V-Japan', categoryKey: 'bearing', isSerialized: false },
  { name: '6004 Bearing (V-Japan)', sku: 'BRG-6004-VJ', brand: 'V-Japan', categoryKey: 'bearing', isSerialized: false },
  { name: '6004 Bearing (RZ)', sku: 'BRG-6004-RZ', brand: 'RZ', categoryKey: 'bearing', isSerialized: false },
  { name: '6005 Bearing (NRK)', sku: 'BRG-6005-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6200 Bearing (V-Japan)', sku: 'BRG-6200-VJ', brand: 'V-Japan', categoryKey: 'bearing', isSerialized: false },
  { name: '6201 Bearing (NRK)', sku: 'BRG-6201-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6200 Bearing (IPI)', sku: 'BRG-6200-IPI', brand: 'IPI', categoryKey: 'bearing', isSerialized: false },
  { name: '6202 Bearing (NRK)', sku: 'BRG-6202-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6203 Bearing (NRK)', sku: 'BRG-6203-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6204 Bearing (NRK)', sku: 'BRG-6204-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6205 Bearing (NRK)', sku: 'BRG-6205-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6300 Bearing (NRK)', sku: 'BRG-6300-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6301 Bearing (NRK)', sku: 'BRG-6301-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6302 Bearing (NRK)', sku: 'BRG-6302-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6303 Bearing (V-Japan)', sku: 'BRG-6303-VJ', brand: 'V-Japan', categoryKey: 'bearing', isSerialized: false },
  { name: '6304 Bearing (NRK)', sku: 'BRG-6304-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6005 CM Bearing (NRK Orig)', sku: 'BRG-6005CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6206 CM Bearing (NRK Orig)', sku: 'BRG-6206CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6205 ZZ CM Bearing (NRK Orig)', sku: 'BRG-6205ZZCM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6305 CM Bearing (NRK Orig)', sku: 'BRG-6305CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6304 CM Bearing (NRK Orig)', sku: 'BRG-6304CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6004 CM Bearing (NRK Orig)', sku: 'BRG-6004CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6004 ZZ CM Bearing (NRK Orig)', sku: 'BRG-6004ZZCM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6003 DDU CM Bearing (NRK Orig)', sku: 'BRG-6003DDUCM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6300 CM BK Bearing (NRK Orig)', sku: 'BRG-6300CMBK-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6302 CM Bearing (NRK Orig)', sku: 'BRG-6302CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6203 CM Bearing (NRK Orig)', sku: 'BRG-6203CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6301 CM BK Bearing (NRK Orig)', sku: 'BRG-6301CMBK-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '638 ZZ1 MC3 Bearing (NRK Orig)', sku: 'BRG-638ZZ1MC3-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6204 ZZ CM Bearing (NRK Orig)', sku: 'BRG-6204ZZCM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6001 Bearing (ARB Orig)', sku: 'BRG-6001-ARB', brand: 'ARB', categoryKey: 'bearing', isSerialized: false },
  { name: '6902 Bearing (ARB Orig)', sku: 'BRG-6902-ARB', brand: 'ARB', categoryKey: 'bearing', isSerialized: false },
  { name: '6906 Bearing (ARB Orig)', sku: 'BRG-6906-ARB', brand: 'ARB', categoryKey: 'bearing', isSerialized: false },
  { name: '6002 CM Bearing (NRK Orig)', sku: 'BRG-6002CM-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6904 C3 Bearing (NRK Orig)', sku: 'BRG-6904C3-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6905 C3 Bearing (NRK Orig)', sku: 'BRG-6905C3-NRK', brand: 'NRK', categoryKey: 'bearing', isSerialized: false },
  { name: '6202 WB Bearing (Onnko Orig)', sku: 'BRG-6202WB-ONNKO', brand: 'Onnko', categoryKey: 'bearing', isSerialized: false },
  { name: '6200 ZZ CM Bearing (Koyo Orig)', sku: 'BRG-6200ZZCM-KOYO', brand: 'Koyo', categoryKey: 'bearing', isSerialized: false },
  { name: 'C3/28 2RSC3 Bearing (UTEKT Orig)', sku: 'BRG-C3282RSC3-UTEKT', brand: 'UTEKT', categoryKey: 'bearing', isSerialized: false },
  { name: '28BCV15HRL2 Bearing (Nachi Orig)', sku: 'BRG-28BCV15HRL2-NACHI', brand: 'Nachi', categoryKey: 'bearing', isSerialized: false },
  { name: '6002 Bearing (Thai Worker)', sku: 'BRG-6002-THAI', brand: 'Thai Worker', categoryKey: 'bearing', isSerialized: false },

  // --- Knuckle Bearing (consumable) ---
  { name: 'Wave 125 / Beat / Click / C100 / W100 Knuckle Bearing', sku: 'KBR-WAVE125BEATCLICK-OTK', brand: 'Otaka', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'TMX Supremo Knuckle Bearing', sku: 'KBR-TMXSUP-OTK', brand: 'Otaka', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'R150 Knuckle Bearing (Otaka)', sku: 'KBR-R150-OTK', brand: 'Otaka', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'C100 / BC175 Knuckle Bearing', sku: 'KBR-C100BC175-OTK', brand: 'Otaka', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'RV100 / Mio / YTX / Aerox / Sniper Knuckle Bearing', sku: 'KBR-RV100MIOYTX-OTK', brand: 'Otaka', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'RR100 Knuckle Bearing (RLV)', sku: 'KBR-RR100-RLV', brand: 'RLV', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'XRM Knuckle Bearing (Yakimoto)', sku: 'KBR-XRM-YKM', brand: 'Yakimoto', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Supremo Knuckle Bearing (Yakimoto)', sku: 'KBR-SUP-YKM', brand: 'Yakimoto', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'C100 Knuckle Bearing (Yakimoto)', sku: 'KBR-C100-YKM', brand: 'Yakimoto', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Rmahn Knuckle Bearing (Yakimoto)', sku: 'KBR-RMAHN-YKM', brand: 'Yakimoto', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'R150 Knuckle Bearing (Yakimoto)', sku: 'KBR-R150-YKM', brand: 'Yakimoto', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'R150 Knuckle Bearing (MTR)', sku: 'KBR-R150-MTR', brand: 'MTR', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'XRM Knuckle Bearing (Fukuyama)', sku: 'KBR-XRM-FKY', brand: 'Fukuyama', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'XRM Knuckle Bearing (Liman)', sku: 'KBR-XRM-LIMAN', brand: 'Liman', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'Wave / Darn / Click Knuckle Bearing (Suntal)', sku: 'KBR-WAVEDARNCLICK-SUNTAL', brand: 'Suntal', categoryKey: 'knuckleBearing', isSerialized: false },
  { name: 'RR100 Knuckle Bearing (TTGR/EOK/Menol)', sku: 'KBR-RR100-TTGR', brand: 'TTGR', categoryKey: 'knuckleBearing', isSerialized: false },
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
  });

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
