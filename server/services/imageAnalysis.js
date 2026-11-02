const calculatePaintRequirement = (wallData) => {
  const { width, height, doors = 0, windows = 0 } = wallData;
  const totalArea = width * height;
  const deduction = (doors * 21) + (windows * 15);
  const paintableArea = Math.max(0, totalArea - deduction);
  const litersRequired = parseFloat((paintableArea / 130).toFixed(2));
  const estimatedCost = Math.round(litersRequired * 650);
  return { totalArea, paintableArea, litersRequired, estimatedCost, coats: 2 };
};
module.exports = { calculatePaintRequirement };