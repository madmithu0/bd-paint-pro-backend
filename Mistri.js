const mongoose = require('mongoose');

// ==========================================
// ১. মিস্ত্রি স্কিমা (Mistri Schema) ডিজাইন
// ==========================================
const mistriSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    
    // phoneVerify: ফোন ভেরিফিকেশন স্ট্যাটাস
    phone: {
        number: { type: String, required: true, unique: true },
        isVerified: { type: Boolean, default: false },
        verifiedAt: { type: Date }
    },

    // location: মিস্ত্রির লাইভ বা কাজের লোকেশন (GeoJSON Format)
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [Longitude, Latitude]
            required: true
        },
        address: { type: String, trim: true }
    },

    // attendance: হাজিরা বা কাজের ট্র্যাকিং রেকর্ড
    attendance: [{
        date: { type: Date, default: Date.now },
        status: { type: String, enum: ['Present', 'Absent', 'On-Leave'], default: 'Present' },
        checkIn: { type: Date },
        checkOut: { type: Date }
    }],

    // insurance must: বাধ্যতামূলক ইন্সুরেন্স/বীমা তথ্য
    insurance: {
        policyNumber: { type: String, required: true },
        provider: { type: String, required: true },
        expiryDate: { type: Date, required: true },
        isActive: { type: Boolean, default: true }
    },

    // bank encrypted: এনক্রিপ্টেড ব্যাংক অ্যাকাউন্ট ইনফরমেশন
    bankDetails: {
        encryptedData: { type: String, required: true }, // এনক্রিপ্ট করা স্ট্রিং বা হ্যাশ
        iv: { type: String, required: true } // ডিক্রিপশনের জন্য ইনিশিয়েলাইজেশন ভেক্টর
    },

    // wallet: মিস্ত্রির ব্যালেন্স ও ওয়ালেট ম্যানেজমেন্ট
    wallet: {
        balance: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'BDT' },
        lastUpdated: { type: Date, default: Date.now }
    }
}, {
    timestamps: true
});

// ম্যাপে কাছাকাছি মিস্ত্রি খোঁজার সুবিধার জন্য জিও-স্পেশাল ইনডেক্সিং
mistriSchema.index({ location: '2dsphere' });

// ==========================================
// ২. মেথড এবং মিডলওয়্যার (Technical Fault & Gap Free)
// ==========================================

// ওয়ালেটে টাকা যোগ করার মেথড
mistriSchema.methods.addMoney = async function(amount) {
    if (amount <= 0) throw new Error('Amount must be greater than zero');
    this.wallet.balance += amount;
    this.wallet.lastUpdated = Date.now();
    return this.save();
};

// ওয়ালেট থেকে টাকা কাটার মেথড (যেমন: উইথড্র বা পেনাল্টি)
mistriSchema.methods.deductMoney = async function(amount) {
    if (amount <= 0) throw new Error('Amount must be greater than zero');
    if (this.wallet.balance < amount) throw new Error('Insufficient wallet balance');
    this.wallet.balance -= amount;
    this.wallet.lastUpdated = Date.now();
    return this.save();
};

// ইন্সুরেন্সের মেয়াদ আছে কিনা তা যাচাই করার ভার্চুয়াল প্রোপার্টি
mistriSchema.virtual('isInsuranceValid').get(function() {
    return this.insurance.isActive && this.insurance.expiryDate > Date.now();
});

// ==========================================
// ৩. মডেল এক্সপোর্ট
// ==========================================
const Mistri = mongoose.model('Mistri', mistriSchema);

module.exports = Mistri;
