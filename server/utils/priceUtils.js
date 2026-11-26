const SQFT_PER_DAY_LOCK = 450;
const LABOUR_RATE_PER_SQFT = 12;
const MATERIAL_RATE_PER_SQFT = 18;

const WALL_REPAIR_SURCHARGE = {
  None: 0,
  Nona: 5,
  Damp: 6,
  Fatol: 4,
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

  const baseDays = Number((numericSqft / SQFT_PER_DAY_LOCK).toFixed(2));
  const recommendedMistri = Math.max(1, Math.ceil(numericSqft / 900));
  const mistriCount = requestedMistriCount
    ? Math.max(1, Number(requestedMistriCount))
    : recommendedMistri;
  const totalDays = Number((baseDays / mistriCount).toFixed(2));

  const problems = Array.isArray(wallProblem) ? wallProblem : [wallProblem];
  const repairRatePerSqft = problems.reduce(
    (sum, prob) => sum + (WALL_REPAIR_SURCHARGE[prob] || 0),
    0
  );
  const damageFactor = DAMAGE_MULTIPLIER[wallDamageLevel] || 1.0;

  const repairCost = Math.round(numericSqft * repairRatePerSqft * damageFactor);
  const labourCost = Math.round(numericSqft * LABOUR_RATE_PER_SQFT + repairCost);

  const materialCost = isMistriOnly
    ? 0
    : Math.round(numericSqft * MATERIAL_RATE_PER_SQFT);
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
    shareVersionLock: 'v3.8.0-80-5-15',
  };
};

const calculateDynamicServiceSelection = ({
  items = [],
  wallProblem = ['None'],
  wallDamageLevel = 'Low',
  requestedMistriCount = null,
}) => {
  let totalSqft = 0;
  let totalSlots = 0;
  let totalLabourCost = 0;
  let totalMaterialCost = 0;

  items.forEach((item) => {
    const sqft = Math.max(0, Number(item.sqft) || 0);
    const slotCapacity = Math.max(50, Number(item.slotSqftPerDay) || SQFT_PER_DAY_LOCK);
    const defaultCoats = Math.max(1, Number(item.defaultCoats) || 2);
    const coatCount = Math.max(1, Number(item.coatCount) || defaultCoats);
    const coatMultiplier = Number(item.perCoatRateMultiplier) || Number((coatCount / defaultCoats).toFixed(2));

    const labourRate = Math.max(0, Number(item.labourRatePerSqft) || 0) * coatMultiplier;
    const withMaterialRate = Math.max(labourRate, (Number(item.withMaterialRatePerSqft) || 0) * coatMultiplier);
    const isMistriOnly = Boolean(item.isMistriOnly);

    const itemSlots = (sqft * coatMultiplier) / slotCapacity;
    const itemLabour = sqft * labourRate;
    const itemMaterial = isMistriOnly ? 0 : sqft * (withMaterialRate - labourRate);

    totalSqft += sqft;
    totalSlots += itemSlots;
    totalLabourCost += itemLabour;
    totalMaterialCost += itemMaterial;
  });
  const problems = Array.isArray(wallProblem) ? wallProblem : [wallProblem];
  const repairRatePerSqft = problems.reduce(
    (sum, prob) => sum + (WALL_REPAIR_SURCHARGE[prob] || 0),
    0
  );
  const damageFactor = DAMAGE_MULTIPLIER[wallDamageLevel] || 1.0;
  const repairCost = Math.round(totalSqft * repairRatePerSqft * damageFactor);
  const finalLabourCost = Math.round(totalLabourCost + repairCost);
  const finalMaterialCost = Math.round(totalMaterialCost);
  const totalPrice = finalLabourCost + finalMaterialCost;

  const roundedSlots = Number(totalSlots.toFixed(2));
  const mistriCount = requestedMistriCount
    ? Math.max(1, Number(requestedMistriCount))
    : Math.max(1, Math.ceil(roundedSlots / 5));
  const totalDays = Number((roundedSlots / mistriCount).toFixed(2));

  return {
    totalSqft,
    totalSlots: roundedSlots,
    mistriCount,
    totalDays,
    repairCost,
    labourCost: finalLabourCost,
    materialCost: finalMaterialCost,
    totalPrice,
    advance30Percent: Math.round(totalPrice * 0.3),
    shareVersionLock: 'v3.8.0-80-5-15',
  };
};

const calculateNetProfitSplit = ({
  totalPrice,
  materialCost = 0,
  vatAmount = 0,
  hasAgent = false,
  merchantCommissionRate = 4,
  dealerMarginRate = 0,
}) => {
  const netProfit = Math.max(0, Number(totalPrice) - Number(materialCost) - Number(vatAmount));
  const mistriShare = Number((netProfit * 0.8).toFixed(2));
  const agentShare = hasAgent ? Number((netProfit * 0.05).toFixed(2)) : 0;
  const platformShare = hasAgent
    ? Number((netProfit * 0.15).toFixed(2))
    : Number((netProfit * 0.2).toFixed(2));
  const merchantCommission = Number(
    (Number(materialCost) * (Number(merchantCommissionRate) / 100)).toFixed(2)
  );
  const dealerMargin = Number(
    (Number(materialCost) * (Number(dealerMarginRate) / 100)).toFixed(2)
  );

  return {
    netProfit,
    mistriShare,
    agentShare,
    platformShare,
    merchantCommission,
    dealerMargin,
  };
};

module.exports = {
  SQFT_PER_DAY_LOCK,
  calculateJobPriceAndDays,
  calculateDynamicServiceSelection,
  calculateNetProfitSplit,
};
