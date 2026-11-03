/**
 * User.js
 * 
 * এই ফাইলটি ইউজার স্কিমা, রোলস ম্যানেজমেন্ট, বিটিআরসি ফোন ভেরিফিকেশন,
 * AES-256 বায়োমেট্রিক এনক্রিপশন এবং ৫ বার ভুল লগইনে ১৫ মিনিট ব্লকিং লজিক পরিচালনা করে।
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// AES-256 এনক্রিপশন কনফিগারেশন (বায়োমেট্রিক সিকিউরিটির জন্য)
const ENCRYPTION_KEY = crypto.randomBytes(32); // বাস্তব প্রোজেক্টে এটি process.env.AES_KEY থেকে আসবে
const IV_LENGTH = 16;

/**
 * বায়োমেট্রিক ডাটা এনক্রিপ্ট করার হেল্পার ফাংশন
 */
function encryptBio(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    // বিটিআরসি নিয়ম অনুযায়ী বাংলাদেশি সঠিক ফোন নাম্বার ফরম্যাট ভ্যালিডেশন
    phone: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: function(v) {
                // BTRC স্ট্যান্ডার্ড: +৮৮০১৭XXXXXXXX অথবা ০১৭XXXXXXXX ফরম্যাট চেক
                return /^(?:\+88|88)?(01[3-9]\d{8})$/.test(v);
            },
            message: props => `${props.value} এটি একটি বৈধ বিটিআরসি (BTRC) অনুমোদিত ফোন নাম্বার নয়!`
        }
    },
    // সর্বনিম্ন ১২ ডিজিটের পাসওয়ার্ড পলিসি (12digit password)
    password: {
        type: String,
        required: true,
        minlength: [12, 'পাসওয়ার্ড অবশ্যই সর্বনিম্ন ১২ ডিজিটের হতে হবে!']
    },
    // মাল্টিপল ইউজার রোলস (SuperAdmin, Agent, Mistri, Customer)
    role: {
        type: String,
        required: true,
        enum: ['SuperAdmin', 'Agent', 'Mistri', 'Customer'],
        default: 'Customer'
    },
    // ভেরিফিকেশন স্ট্যাটাস
    phoneVerifiedBTRC: {
        type: Boolean,
        default: false
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    // AES256 এনক্রিপ্টেড বায়োমেট্রিক ডাটা (faceData voiceData AES256)
    faceData: {
        type: String, // এনক্রিপ্টেড স্ট্রিং হিসেবে জমা থাকবে
        set: encryptBio
    },
    voiceData: {
        type: String, // এনক্রিপ্টেড স্ট্রিং হিসেবে জমা থাকবে
        set: encryptBio
    },
    // ৫ বার ভুল লগইনে ১৫ মিনিট ব্লক করার ট্র্যাকিং ফিল্ডস (loginAttempt 5 block 15min)
    loginAttempts: {
        type: Number,
        required: true,
        default: 0
    },
    lockUntil: {
        type: Date
    }
}, {
    timestamps: true
});

/**
 * পাসওয়ার্ড ডাটাবেজে সেভ করার আগে স্বয়ংক্রিয়ভাবে হ্যাশ (Bcrypt) করার মিডলওয়্যার
 */
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

/**
 * ভার্চুয়াল ফিল্ড: ইউজার বর্তমানে ব্লকড অবস্থায় আছে কিনা তা যাচাই করার জন্য
 */
UserSchema.virtual('isBlocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

/**
 * ভুল লগইন ট্র্যাকিং এবং ১৫ মিনিটের জন্য লকআউট মেথড (loginAttempt 5 block 15min)
 */
UserSchema.methods.incLoginAttempts = async function() {
    // যদি আগের লকআউটের সময় পার হয়ে গিয়ে থাকে, তবে কাউন্টার রিসেট হবে
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }

    // অন্যথায় কাউন্টার ১ বাড়বে
    const updates = { $inc: { loginAttempts: 1 } };
    
    // যদি ভুল চেষ্টার সংখ্যা ৫ বা তার বেশি হয়, তবে অ্যাকাউন্ট ১৫ মিনিটের জন্য লক হবে
    if (this.loginAttempts + 1 >= 5) {
        updates.$set = { lockUntil: new Date(Date.now() + 15 * 60 * 1000) }; // ১৫ মিনিট
    }
    
    return this.updateOne(updates);
};

/**
 * সফল লগইনের পর লগইন অ্যাটেম্পট কাউন্টার রিসেট করার মেথড
 */
UserSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 }
    });
};

module.exports = mongoose.model('User', UserSchema);
