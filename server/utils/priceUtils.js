const SQFT_PER_DAY_LOCK = 450;
const LABOUR_RATE_PER_SQFT = 12; // BDT per Sqft
const MATERIAL_RATE_PER_SQFT = 18; // BDT per Sqft

const WALL_REPAIR_SURCHARGE = {
  None: 0,
  Nona: 5,  // Nona Chemical treatment per Sqft
  Damp: 6,  // Damp Sealer coat per Sqft
  Fatol: 4, // Fatol Putty & Crack filling per Sqft
};

const DAMAGE_MULTIPLIER = {
  Low: 1.0,
  Medium: 1.25,
  High: 1.5,
  Severe: 1.8,
};

const calculateJobPriceAndDays = ({
  sqft,
  isMistriOnly = false,
  wallProblem = ['None'],
  wallDamageLevel = 'Low',
  requestedMistriCount = null,
}) => {
  const numericSqft = Math.max(1, Number(sqft));

  // 1. Base Days & Auto Mistri Count (450 Sqft = 1 Mistri for 1 Day)
  const baseDays = Number((numericSqft / SQFT_PER_DAY_LOCK).toFixed(2));
  const recommendedMistri = Math.max(1, Math.ceil(numericSqft / 900));
  const mistriCount = requestedMistriCount ? Math.max(1, Number(requestedMistriCount)) : recommendedMistri;
  const totalDays = Number((baseDays / mistriCount).toFixed(2));

  // 2. Labour & Wall Repair Cost Calculation
  const problems = Array.isArray(wallProblem) ? wallProblem : [wallProblem];
  const repairRatePerSqft = problems.reduce((sum, prob) => sum + (WALL_REPAIR_SURCHARGE[prob] || 0), 0);
  const damageFactor = DAMAGE_MULTIPLIER[wallDamageLevel] || 1.0;

  const repairCost = Math.round(numericSqft * repairRatePerSqft * damageFactor);
  const labourCost = Math.round(numericSqft * LABOUR_RATE_PER_SQFT + repairCost);

  // 3. Material Cost (Zero if Customer provides own paint / Mistri-Only mode)
  const materialCost = isMistriOnly ? 0 : Math.round(numericSqft * MATERIAL_RATE_PER_SQFT);
  const totalPrice = labourCost + materialCost;

  return {
    sqft: numericSqft,
    perDayLock: SQFT_PER_DAY_LOCK,
    baseDays,
    mistriCount,
    totalDays,
    labourCost,
    materialCost,
    repairCost,
    totalPrice,
    isMistriOnly,
    shareVersionLock: 'v3.0.0-80-5-15',
  };
};

module.exports = {
  SQFT_PER_DAY_LOCK,
  calculateJobPriceAndDays,
};
