const mongoose = require('mongoose');

// ==========================================
// ১. রিভিউ স্কিমা (Review Schema) ডিজাইন
// ==========================================
const reviewSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    mistriId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mistri',
        required: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    
    // rating: রেটিং ম্যানেজমেন্ট (১ থেকে ৫ এর মধ্যে)
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },

    // DSA filter: ডিজিটাল নিরাপত্তা বা গাইডলাইন অনুযায়ী মন্তব্য ফিল্টারিং
    comment: {
        type: String,
        required: true,
        trim: true
    },
    isApprovedByDSA: {
        type: Boolean,
        default: true
    },

    // 5year: ৫ বছর পর ডেটা স্বয়ংক্রিয়ভাবে মুছে যাওয়ার জন্য TTL (Time To Live) ইনডেক্স
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: '5y' } // ৫ বছর (5 years) পূর্ণ হলে মঙ্গোডিবি থেকে অটো ডিলিট হবে
    }
}, {
    timestamps: { createdAt: false, updatedAt: true } // শুধুমাত্র updatedAt ট্র্যাক করবে, createdAt ম্যানুয়ালি হ্যান্ডেলড
});

// ==========================================
// ২. মেথড এবং মিডলওয়্যার (Technical Fault & Gap Free)
// ==========================================

// DSA Filter মিডলওয়্যার: রিভিউ সেভ হওয়ার আগে নিষিদ্ধ বা অবমাননাকর শব্দ চেক করা
reviewSchema.pre('save', function (next) {
    // উদাহরণস্বরূপ কিছু নিষিদ্ধ বা ফ্ল্যাগড শব্দ (গালিগালাজ বা স্প্যাম ফিল্টার)
    const bannedWords = ['scam', 'fraud', 'গালি', 'খারাপ_শব্দ', 'fake']; 
    
    const commentLower = this.comment.toLowerCase();
    
    // কোনো নিষিদ্ধ শব্দ পাওয়া গেলে রিভিউটি ফ্ল্যাগ বা ব্লক করা
    const containsBannedWord = bannedWords.some(word => commentLower.includes(word));
    
    if (containsBannedWord) {
        this.isApprovedByDSA = false;
        // আপনি চাইলে সরাসরি এরর থ্রো করে সেভ হওয়া আটকাতে পারেন:
        // return next(new Error('Review contains inappropriate language violating DSA guidelines.'));
    }
    
    next();
});

// ==========================================
// ৩. মডেল এক্সপোর্ট
// ==========================================
const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
