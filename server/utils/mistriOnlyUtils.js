const SQFT_PER_DAY = 450;
const LABOUR_ONLY_RATE_PER_SQFT = 12; // BDT per Sqft

const validateAndCalculateMistriOnly = ({ sqft, customerOwnPaint = true, mistriCount = 1 }) => {
  const numericSqft = Number(sqft);
  if (!numericSqft || numericSqft <= 0) {
    throw new Error('Square feet (Sqft) must be a positive number.');
  }

  const baseDays = Number((numericSqft / SQFT_PER_DAY).toFixed(2));
  const workers = Math.max(1, Number(mistriCount));
  const estimatedDays = Number((baseDays / workers).toFixed(2));
  const labourOnlyPrice = Math.round(numericSqft * LABOUR_ONLY_RATE_PER_SQFT);

  return {
    isMistriOnly: Boolean(customerOwnPaint),
    materialCost: 0, // Strictly 0 when customer provides own paint
    labourCost: labourOnlyPrice,
    totalPrice: labourOnlyPrice,
    sqftPerDayValidated: SQFT_PER_DAY,
    baseDays,
    mistriCount: workers,
    estimatedDays,
  };
};

module.exports = { validateAndCalculateMistriOnly };
