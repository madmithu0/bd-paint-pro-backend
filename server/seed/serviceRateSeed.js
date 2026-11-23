const ServiceCategory = require('../models/ServiceCategory');

const DEFAULT_SERVICES = [
  {
    code: 'DISTEMPER',
    name: 'Distemper Paint',
    applicationArea: 'Low budget rental houses',
    slotSqftPerDay: 800,
    labourRatePerSqft: 4,
    withMaterialRatePerSqft: 9,
    displayOrder: 1,
  },
  {
    code: 'PLASTIC_EMULSION',
    name: 'Plastic Emulsion / Regular Paint',
    applicationArea: 'Interior walls',
    slotSqftPerDay: 700,
    labourRatePerSqft: 7,
    withMaterialRatePerSqft: 18,
    displayOrder: 2,
  },
  {
    code: 'WEATHERCOAT',
    name: 'Weathercoat Exterior Paint',
    applicationArea: 'Exterior walls',
    slotSqftPerDay: 600,
    labourRatePerSqft: 9,
    withMaterialRatePerSqft: 25,
    displayOrder: 3,
  },
  {
    code: 'PUTTY_AND_PAINT',
    name: 'Wall Putty + Paint',
    applicationArea: 'New plaster walls',
    slotSqftPerDay: 450,
    labourRatePerSqft: 12,
    withMaterialRatePerSqft: 32,
    displayOrder: 4,
  },
  {
    code: 'LUXURY_SILK',
    name: 'Luxury Silk / Velvet Finish',
    applicationArea: 'Drawing room and living area',
    slotSqftPerDay: 450,
    labourRatePerSqft: 18,
    withMaterialRatePerSqft: 50,
    displayOrder: 5,
  },
  {
    code: 'TEXTURE_PAINT',
    name: 'Designer Texture Paint',
    applicationArea: 'Single accent feature wall',
    slotSqftPerDay: 350,
    labourRatePerSqft: 22,
    withMaterialRatePerSqft: 60,
    displayOrder: 6,
  },
  {
    code: 'MARBLE_STONE',
    name: 'Marble / Stone Effect Paint',
    applicationArea: 'Luxury architectural finishing',
    slotSqftPerDay: 400,
    labourRatePerSqft: 28,
    withMaterialRatePerSqft: 85,
    displayOrder: 7,
  },
  {
    code: 'ENAMEL_LACQUER',
    name: 'Enamel / Lacquer Polish',
    applicationArea: 'Doors, windows, and metal grills',
    slotSqftPerDay: 300,
    labourRatePerSqft: 15,
    withMaterialRatePerSqft: 38,
    displayOrder: 8,
  },
  {
    code: 'WATERPROOFING',
    name: 'Waterproofing Roof & Bath Coating',
    applicationArea: 'Rooftops and bathrooms',
    slotSqftPerDay: 500,
    labourRatePerSqft: 12,
    withMaterialRatePerSqft: 38,
    displayOrder: 9,
  },
  {
    code: 'DAMP_PROOF',
    name: 'Damp-Proof Treatment & Coating',
    applicationArea: 'Damp and moisture-affected walls',
    slotSqftPerDay: 400,
    labourRatePerSqft: 14,
    withMaterialRatePerSqft: 42,
    displayOrder: 10,
  },
  {
    code: 'SELF_CLEANING',
    name: 'Self-Cleaning Dust-Repellent Paint',
    applicationArea: 'Self-cleaning exterior and interior surfaces',
    slotSqftPerDay: 600,
    labourRatePerSqft: 25,
    withMaterialRatePerSqft: 75,
    displayOrder: 11,
  },
  {
    code: 'AIR_PURIFYING',
    name: 'Air-Purifying Anti-Odor Paint',
    applicationArea: 'Smoke and odor absorbing indoor spaces',
    slotSqftPerDay: 550,
    labourRatePerSqft: 22,
    withMaterialRatePerSqft: 68,
    displayOrder: 12,
  },
  {
    code: 'HEAT_REFLECTIVE',
    name: 'Heat-Reflective Cool Roof & Wall Paint',
    applicationArea: 'Heat reduction for rooms and rooftops',
    slotSqftPerDay: 600,
    labourRatePerSqft: 20,
    withMaterialRatePerSqft: 65,
    displayOrder: 13,
  },
];

const seedDefaultServiceRates = async () => {
  try {
    const existingCount = await ServiceCategory.countDocuments();
    if (existingCount === 0) {
      await ServiceCategory.insertMany(DEFAULT_SERVICES);
    }
  } catch (error) {
    throw new Error(`Failed to seed default service rates: ${error.message}`);
  }
};

module.exports = {
  DEFAULT_SERVICES,
  seedDefaultServiceRates,
};
