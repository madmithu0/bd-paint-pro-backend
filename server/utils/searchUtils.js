const escapeSearchRegex = (text = '') => {
  return String(text)
    .trim()
    .slice(0, 100)
    .replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

const buildSearchFilter = ({ keyword, status, minAmount, maxAmount, searchFields = ['name'] }) => {
  const query = {};

  if (keyword && keyword.trim()) {
    const regex = new RegExp(escapeSearchRegex(keyword), 'i');
    query.$or = searchFields.map((field) => ({ [field]: regex }));
  }

  if (status) {
    query.status = status;
  }

  if (minAmount !== undefined || maxAmount !== undefined) {
    query.price = {};
    if (minAmount !== undefined) query.price.$gte = Number(minAmount);
    if (maxAmount !== undefined) query.price.$lte = Number(maxAmount);
  }

  return query;
};

const buildSortOption = (sortBy = 'newest') => {
  switch (sortBy) {
    case 'oldest':
      return { createdAt: 1 };
    case 'price_high':
      return { price: -1 };
    case 'price_low':
      return { price: 1 };
    default:
      return { createdAt: -1 };
  }
};

module.exports = {
  escapeSearchRegex,
  buildSearchFilter,
  buildSortOption,
};
