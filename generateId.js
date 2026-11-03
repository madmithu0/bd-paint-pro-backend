/**
 * generateId.js
 * ফিচারসমূহ: Auto ID Generation (MISTRI, AGENT, CUST, SUPER), 
 * QR Code Generator, এবং Cryptographic Randomness (noPredictableID)।
 */

const crypto = require('crypto');
const QRCode = require('qrcode');

// রোল বা টাইপ অনুযায়ী প্রিফিক্স ম্যাপিং
const ROLE_PREFIXES = {
  MISTRI: 'MISTRI',
  AGENT: 'AGENT',
  CUST: 'CUST',
  SUPER: 'SUPER'
};

/**
 * ১. সিকিউর এবং আনপ্রেডিক্টেবল আইডি জেনারেটর (autoId + noPredictableID)
 * হ্যাকাররা যেন পরবর্তী আইডি অনুমান করতে না পারে (noPredictableID), 
 * সেজন্য সিকিউর ক্রিপ্টোগ্রাফিক র্যান্ডম স্ট্রিং যুক্ত করা হয়েছে।
 * 
 * @param {string} role - ইউজার রোল (MISTRI, AGENT, CUST, SUPER)
 * @param {number} currentSequence - ডাটাবেজ থেকে পাওয়া পরবর্তী সিরিয়াল নাম্বার (যেমন: 1, 2, 3)
 */
function generateSecureId(role, currentSequence) {
  const prefix = ROLE_PREFIXES[role.toUpperCase()];
  if (!prefix) {
    throw new Error('Invalid role specified for ID generation');
  }

  // সিরিয়াল নাম্বারকে ৪ ডিজিটের ফরম্যাটে রূপান্তর (যেমন: 1 -> 0001, 12 -> 0012)
  const paddedSequence = String(currentSequence).padStart(4, '0');

  // আইডিকে শতভাগ আনপ্রেডিক্টেবল করতে ৪ ক্যারেক্টারের ক্রিপ্টোগ্রাফিক র্যান্ডম হেক্স যুক্ত করা
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();

  // ফাইনাল আইডি ফরম্যাট: PREFIX-0001-XXXX (যেমন: CUST-0001-A3BF)
  return `${prefix}-${paddedSequence}-${randomSuffix}`;
}

/**
 * ২. ব্যাকএন্ড কিউআর কোড জেনারেটর (QR)
 * জেনারেট হওয়া আইডিটি দিয়ে সার্ভার লেভেলেই একটি QR Code ইমেজ (Base64 বা ডাটাস্ট্রিং) তৈরি করবে।
 * 
 * @param {string} uniqueId - পূর্বে জেনারেট করা ইউনিক আইডি
 */
async function generateIdQRCode(uniqueId) {
  try {
    // QR কোডের কনফিগারেশন (উচ্চ মানের নিরাপত্তা ও স্বচ্ছতা)
    const qrOptions = {
      errorCorrectionLevel: 'H', // হাই এরর কারেকশন (কোড আংশিক ক্ষতিগ্রস্ত হলেও স্ক্যান হবে)
      type: 'image/png',
      quality: 0.92,
      margin: 1
    };

    // QR Code টিকে Base64 Data URL ফরম্যাটে জেনারেট করা হচ্ছে, যা সরাসরি ফ্রন্টএন্ডে বা ইমেজে ব্যবহার করা যাবে
    const qrDataBase64 = await QRCode.toDataURL(uniqueId, qrOptions);
    return qrDataBase64;
  } catch (error) {
    throw new Error(`Failed to generate QR Code: ${error.message}`);
  }
}

module.exports = {
  // প্রধান ফাংশন যা আইডি এবং কিউআর কোড একসাথে তৈরি করে রিটার্ন করবে
  createNewIdentity: async (role, currentSequence) => {
    try {
      const customId = generateSecureId(role, currentSequence);
      const qrCode = await generateIdQRCode(customId);

      return {
        success: true,
        id: customId,
        qrCode: qrCode // এটি সরাসরি ফ্রন্টএন্ডে <img src="..."/> এ বসিয়ে দেওয়া যাবে
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};
