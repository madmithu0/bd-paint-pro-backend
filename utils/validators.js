const isValidPhone = (phone) => {
  const regex = /^01[3-9]\d{8}$/;
  return regex.test(phone);
};

const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const isValidPassword = (password) => {
  return password && password.length >= 6;
};

module.exports = { isValidPhone, isValidEmail, isValidPassword };