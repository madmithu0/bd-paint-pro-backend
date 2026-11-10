const sendSMS = async (phone, message) => {
  try {
    console.log(`SMS to ${phone}: ${message}`);
    // এখানে পরে BulkSMS / SSL Wireless API বসবে
    return true;
  } catch (err) {
    console.error('SMS Error:', err.message);
    return false;
  }
};

module.exports = sendSMS;