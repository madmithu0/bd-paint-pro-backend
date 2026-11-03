/**
 * featureFlagService.js
 * 
 * এই ফাইলটি ফিচার ফ্ল্যাগ, পেমেন্ট গেটওয়ে টগল, কিল সুইচ এবং নিরাপত্তা সংক্রান্ত
 * অটো-কিল ও অটো-অফ মেকানিজম পরিচালনা করে।
 */

class FeatureFlagService {
    constructor() {
        // প্রাথমিক স্টেট বা কনফিগারেশন সেটআপ
        this.flags = {
            featureFlag: true,               // সাধারণ ফিচার ফ্ল্যাগ স্টেট
            paymentGatewayToggle: true,      // পেমেন্ট গেটওয়ে চালু/বন্ধ করার টগল
            killSwitch: false,               // পুরো সিস্টেম বা নির্দিষ্ট ফিচারের কিল সুইচ (true হলে সিস্টেম ব্লক হবে)
            hackAutoKill: false,             // হ্যাকিং বা নিরাপত্তা ঝুঁকি সনাক্ত হলে অটো-কিল স্টেট
            paymentAutoOff: false            // কোনো ত্রুটি বা ঝুঁকিতে পেমেন্ট অটোমেটিক বন্ধের স্টেট
        };
    }

    /**
     * যেকোনো ফ্ল্যাগের বর্তমান অবস্থা (True/False) চেক করার মেথড
     * @param {string} flagName 
     * @returns {boolean}
     */
    isFeatureEnabled(flagName) {
        if (this.flags[flagName] === undefined) {
            console.warn(`Warning: Feature flag "${flagName}" পাওয়া যায়নি।`);
            return false;
        }
        return this.flags[flagName];
    }

    /**
     * ফ্ল্যাগের মান পরিবর্তন (Toggle/Update) করার মেথড
     * @param {string} flagName 
     * @param {boolean} value 
     */
    setFeatureFlag(flagName, value) {
        if (this.flags[flagName] !== undefined) {
            this.flags[flagName] = value;
            console.log(`[FeatureFlagService] ${flagName} আপডেট করা হয়েছে: ${value}`);
        } else {
            console.error(`Error: "${flagName}" নামে কোনো ফ্ল্যাগ নেই।`);
        }
    }

    /**
     * পেমেন্ট গেটওয়ে ব্যবহারের উপযোগী কি না তা যাচাই করার মেথড
     * পেমেন্ট অটো-অফ বা কিল সুইচ অন থাকলে এটি ফলস (false) রিটার্ন করবে।
     * @returns {boolean}
     */
    isPaymentGatewayActive() {
        // যদি কিল সুইচ চালু থাকে, অথবা পেমেন্ট অটো-অফ সক্রিয় থাকে, তবে পেমেন্ট গেটওয়ে বন্ধ থাকবে
        if (this.flags.killSwitch || this.flags.paymentAutoOff || this.flags.hackAutoKill) {
            return false;
        }
        return this.flags.paymentGatewayToggle;
    }

    /**
     * হ্যাক বা কোনো সিকিউরিটি থ্রেট সনাক্ত হলে দ্রুত সিস্টেম বা ফিচার কিল করার মেথড
     */
    triggerHackAutoKill() {
        this.setFeatureFlag('hackAutoKill', true);
        this.setFeatureFlag('killSwitch', true);
        this.setFeatureFlag('paymentAutoOff', true);
        console.error('CRITICAL: Hack detected! Auto-Kill switch activated and payments turned off.');
    }

    /**
     * পেমেন্ট সিস্টেমে কোনো সমস্যা দেখা দিলে পেমেন্ট অটো-অফ করার মেথড
     */
    triggerPaymentAutoOff() {
        this.setFeatureFlag('paymentAutoOff', true);
        console.warn('ALERT: Payment issues detected! Payment Gateway has been turned off automatically.');
    }

    /**
     * জরুরি অবস্থা কেটে গেলে সিস্টেম পুনরায় স্বাভাবিক করার মেথড
     */
    resetSystemSafety() {
        this.setFeatureFlag('killSwitch', false);
        this.setFeatureFlag('hackAutoKill', false);
        this.setFeatureFlag('paymentAutoOff', false);
        console.log('SYSTEM RESTORED: Safety triggers have been reset to normal.');
    }
}

// সিঙ্গলটন (Singleton) প্যাটার্ন ব্যবহার করে এক্সপোর্ট করা হলো যেন পুরো অ্যাপ্লিকেশনে একটি মাত্র স্টেট বজায় থাকে
module.exports = new FeatureFlagService();
