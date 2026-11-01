export const verifyBkash = async (trxId) => {
  return { verified: true, method: 'bkash', btrc_compliant: true };
};
export const calculateBill = (area, coats) => {
  return { material: area*50, labor: area*20*coats, total: area*50 + area*20*coats };
};