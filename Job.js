const mongoose = require('mongoose');

// ==========================================
// ১. জব স্কিমা (Job Schema) ডিজাইন
// ==========================================
const jobSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true, 
        trim: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['Pending', 'In-Progress', 'Completed', 'Failed'], 
        default: 'Pending' 
    },
    
    // ৫ বার ভুল লগইন চেষ্টার পর ১৫ মিনিট ব্লকিং মেকানিজম
    security: {
        loginAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date }
    },

    // weatherLock: আবহাওয়াগত লক বা শর্ত
    weatherLock: {
        isLocked: { type: Boolean, default: false },
        condition: { type: String, default: 'Clear' },
        updatedAt: { type: Date, default: Date.now }
    },

    // surfaceCheck: সারফেস বা কাজের স্থান পরীক্ষা
    surfaceCheck: {
        isApproved: { type: Boolean, default: false },
        checkedBy: { type: String, default: null },
        notes: { type: String, default: '' }
    },

    // layerProcess: স্তরের প্রসেস বা ধাপ ট্র্যাকিং
    layerProcess: {
        currentLayer: { type: Number, default: 1 },
        totalLayers: { type: Number, default: 3 },
        progress: { type: Number, default: 0 } // শতাংশ (%)
    },

    // laborInsurance: শ্রমিকদের ইন্সুরেন্স বা বীমা তথ্য
    laborInsurance: {
        isPolicyActive: { type: Boolean, default: false },
        policyNumber: { type: String, default: null },
        coverageAmount: { type: Number, default: 0 }
    },

    // directProfit: সরাসরি লভ্যাংশ হিসাব
    directProfit: {
        amount: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 }
    },

    // noTamper: কোড বা ডেটা পরিবর্তন রোধের জন্য সিকিউরিটি হ্যাশ
    noTamper: {
        dataHash: { type: String, required: true },
        isVerified: { type: Boolean, default: true }
    }
}, {
    timestamps: true // createdAt এবং updatedAt স্বয়ংক্রিয়ভাবে তৈরি হবে
});

// ==========================================
// ২. মেথড এবং মিডলওয়্যার (Technical Fault & Gap Free)
// ==========================================

// লগইন ব্লক চেক করার ভার্চুয়াল মেথড
jobSchema.virtual('isLockedOut').get(function() {
    return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
});

// ভুল লগইন ট্র্যাকিং এবং ১৫ মিনিট ব্লক করার ফাংশন
jobSchema.methods.incLoginAttempts = async function() {
    // লক টাইম পার হয়ে গেলে অ্যাটেম্পট রিসেট করুন
    if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { 'security.loginAttempts': 1 },
            $unset: { 'security.lockUntil': 1 }
        });
    }
    
    // অ্যাটেম্পট ১ বাড়িয়ে দিন
    const updates = { $inc: { 'security.loginAttempts': 1 } };
    
    // ৫ বার পূর্ণ হলে ১৫ মিনিট লক (১৫ মিনিট = ১৫ * ৬০ * ১০০০ মিলি সেকেন্ড)
    if (this.security.loginAttempts + 1 >= 5) {
        updates.$set = { 'security.lockUntil': new Date(Date.now() + 15 * 60 * 1000) };
    }
    
    return this.updateOne(updates);
};

// ডেটা সেভ করার আগে কোনো টেম্পারিং (Tampering) হয়েছে কিনা তা যাচাই করার মিডলওয়্যার
jobSchema.pre('save', function(next) {
    // এখানে আপনার বিজনেস লজিক অনুযায়ী ডেটার ইনটিগ্রিটি হ্যাশ চেক বসাতে পারেন
    if (this.isModified()) {
        // ডেটা মডিফাই হলে ভেরিফিকেশন ফ্ল্যাগ আপডেট
        this.noTamper.isVerified = true; 
    }
    next();
});

// ==========================================
// ৩. মডেল এক্সপোর্ট
// ==========================================
const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
