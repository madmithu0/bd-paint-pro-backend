const mongoose = require('mongoose');

// ==========================================
// ১. এজেন্ট স্কিমা (Agent Schema) ডিজাইন
// ==========================================
const agentSchema = new mongoose.Schema({
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
    status: {
        type: String,
        enum: ['Active', 'Suspended', 'Pending'],
        default: 'Pending'
    },

    // phoneVerify: এজেন্ট ফোন ভেরিফিকেশন স্ট্যাটাস
    phone: {
        number: { type: String, required: true, unique: true },
        isVerified: { type: Boolean, default: false },
        verifiedAt: { type: Date }
    },

    // commission 5%: এজেন্টের স্থায়ী কমিশন রেট
    commission: {
        ratePercentage: { type: Number, default: 5 }, // ৫% কমিশন ফিক্সড
        totalEarned: { type: Number, default: 0 }
    },

    // bank encrypted: এনক্রিপ্টেড ব্যাংক অ্যাকাউন্ট ইনফরমেশন
    bankDetails: {
        encryptedData: { type: String, required: true }, // এনক্রিপ্ট করা ব্যাংক তথ্য
        iv: { type: String, required: true } // ডিক্রিপশনের জন্য ইনিশিয়েলাইজেশন ভেক্টর
    },

    // wallet: এজেন্টের ব্যালেন্স ও ওয়ালেট ট্র্যাকিং
    wallet: {
        balance: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'BDT' },
        lastUpdated: { type: Date, default: Date.now }
    }
}, {
    timestamps: true
});

// ==========================================
// ২. মেথড এবং মিডলওয়্যার (Technical Fault & Gap Free)
// ==========================================

// যেকোনো সফল ট্রানজেকশন থেকে ৫% কমিশন হিসাব করে ওয়ালেটে যোগ করার মেথড
agentSchema.methods.calculateAndAddCommission = async function(transactionAmount) {
    if (transactionAmount <= 0) throw new Error('Transaction amount must be greater than zero');
    
    // ৫% কমিশন হিসাব (amount * 0.05)
    const commissionEarned = (transactionAmount * this.commission.ratePercentage) / 100;
    
    // ওয়ালেট ব্যালেন্স এবং মোট উপার্জনে যোগ করা
    this.wallet.balance += commissionEarned;
    this.commission.totalEarned += commissionEarned;
    this.wallet.lastUpdated = Date.now();
    
    return this.save();
};

// ওয়ালেট থেকে টাকা উত্তোলন (Withdraw) করার মেথড
agentSchema.methods.withdrawFunds = async function(amount) {
    if (amount <= 0) throw new Error('Amount must be greater than zero');
    if (this.wallet.balance < amount) throw new Error('Insufficient wallet balance');
    
    this.wallet.balance -= amount;
    this.wallet.lastUpdated = Date.now();
    return this.save();
};

// ==========================================
// ৩.モデル এক্সপোর্ট
// ==========================================
const Agent = mongoose.model('Agent', agentSchema);

module.exports = Agent;
