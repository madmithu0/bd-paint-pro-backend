/**
 * paymentGatewayService.js
 * 
 * এই ফাইলটি SSLCOMMERZ, bKash, Nagad, Rocket এবং COD পেমেন্ট মেকানিজম,
 * ১৫% ভ্যাট, মূসক ৬.৩, BIN এবং প্রফিট স্প্লিটিংসহ পেমেন্ট সিকিউরিটি পরিচালনা করে।
 */

class PaymentGatewayService {
    constructor() {
        this.BIN = "001234567-0101"; // কোম্পানির বিজনেস আইডেন্টিফিকেশন নাম্বার (BIN)
        this.VAT_RATE = 0.15; // ১৫% ভ্যাট (VAT 15%)
        
        // অনুমোদিত পেমেন্ট গেটওয়ে আইপি তালিকা (IP whitelist callback)
        this.whitelistedIPs = [
            '127.0.0.1', 
            '103.221.252.1', // মক SSLCommerz IP
            '202.51.182.1'   // মক বিকাশ/নগদ IP
        ];
    }

    /**
     * ১. ভ্যাট এবং মূসক ৬.৩ ক্যালকুলেশন মেথড
     */
    calculateVatAndTotal(baseAmount) {
        const vatAmount = baseAmount * this.VAT_RATE;
        const totalAmount = baseAmount + vatAmount;
        
        return {
            baseAmount: Number(baseAmount.toFixed(2)),
            vatAmount: Number(vatAmount.toFixed(2)),
            totalAmount: Number(totalAmount.toFixed(2)),
            mushakFormat: `Mushak 6.3 - BIN: ${this.BIN} | Price: ${baseAmount} | VAT (15%): ${vatAmount} | Total: ${totalAmount}`
        };
    }

    /**
     * ২. কন্ডিশনাল প্রফিট স্প্লিট মেথড (profitSplit conditional 80/5/15 if agent else 80/20)
     */
    calculateProfitSplit(amount, hasAgent = false) {
        if (hasAgent) {
            // যদি এজেন্ট থাকে তবে স্প্লিট: ৮০% কোম্পানি, ৫% এজেন্ট, ১৫% পার্টনার/অন্যান্য
            return {
                companyShare: Number((amount * 0.80).toFixed(2)),
                agentShare: Number((amount * 0.05).toFixed(2)),
                partnerShare: Number((amount * 0.15).toFixed(2))
            };
        } else {
            // এজেন্ট না থাকলে ডাইরেক্ট স্প্লিট (directSplit): ৮০% কোম্পানি, ২০% পার্টনার
            return {
                companyShare: Number((amount * 0.80).toFixed(2)),
                partnerShare: Number((amount * 0.20).toFixed(2)),
                agentShare: 0
            };
        }
    }

    /**
     * ৩. পেমেন্ট গেটওয়ে সিকিউরিটি এবং ভেরিফিকেশন (signature verify + fake callback + amount tamper block)
     */
    verifyCallbackSecurity(reqPayload, clientIP, originalAmount) {
        // ক) আইপি হোয়াইটলিস্ট চেক (IP whitelist callback)
        if (!this.whitelistedIPs.includes(clientIP)) {
            console.error(`[Security Alert] Unauthorized Callback IP: ${clientIP}`);
            return { isValid: false, reason: "IP_NOT_WHITELISTED" };
        }

        // খ) গেটওয়ে সিগনেচার ভেরিফিকেশন (signature verify must)
        const { signature, transactionId } = reqPayload;
        if (!signature || !this.isValidSignature(reqPayload, signature)) {
            console.error(`[Security Alert] Invalid Callback Signature for Trans: ${transactionId}`);
            return { isValid: false, reason: "INVALID_SIGNATURE" };
        }

        // গ) অ্যামাউন্ট ট্যাম্পারিং প্রতিরোধ (amount tamper block + fake callback block)
        if (Number(reqPayload.amount) !== Number(originalAmount)) {
            console.error(`[Critical Alert] Amount Tampering Detected! Expected: ${originalAmount}, Received: ${reqPayload.amount}`);
            return { isValid: false, reason: "AMOUNT_TAMPERING_DETECTED" };
        }

        return { isValid: true, reason: "SUCCESS" };
    }

    /**
     * ৪. সিগনেচার চেক করার ইন্টারনাল মেথড
     */
    isValidSignature(payload, clientSignature) {
        // বাস্তব প্রজেক্টে গেটওয়ের সিক্রেট কি (Secret Key) দিয়ে SHA256 হ্যাস তৈরি করে ম্যাচ করা হয়
        // এখানে মক ট্রু রিটার্ন করা হলো
        return true; 
    }

    /**
     * ৫. কোর পемেন্ট ইনিশিয়ালাইজেশন মেথড (SSLCOMMERZ, bKash, Nagad, Rocket, COD)
     */
    async processPayment(method, baseAmount, hasAgent = false, additionalInfo = {}) {
        const allowedMethods = ['SSLCOMMERZ', 'BKASH', 'NAGAD', 'ROCKET', 'COD'];
        const selectedMethod = method.toUpperCase();

        if (!allowedMethods.includes(selectedMethod)) {
            throw new Error(`Unsupported payment method: ${method}`);
        }

        // ভ্যাট এবং মূসক ৬.৩ হিসাব
        const pricing = this.calculateVatAndTotal(baseAmount);
        
        // প্রফিট স্প্লিট হিসাব
        const splits = this.calculateProfitSplit(pricing.totalAmount, hasAgent);

        console.log(`[Payment] Initializing ${selectedMethod} for Amount: ${pricing.totalAmount} BDT`);

        switch (selectedMethod) {
            case 'SSLCOMMERZ':
                // SSLCOMMERZ API ইন্টিগ্রেশন লজিক
                return { success: true, gateway: 'SSLCOMMERZ', pricing, splits };
                
            case 'BKASH':
                // bKash Create Payment API লজিক
                return { success: true, gateway: 'BKASH', pricing, splits };
                
            case 'NAGAD':
                // Nagad Payment Gateway API লজিক
                return { success: true, gateway: 'NAGAD', pricing, splits };
                
            case 'ROCKET':
                // Rocket Gateway API লজিক
                return { success: true, gateway: 'ROCKET', pricing, splits };
                
            case 'COD':
                // ক্যাশ অন ডেলিভারি (Cash on Delivery) প্রসেস লজিক
                return { success: true, gateway: 'COD', pricing, splits, message: "Order placed on Cash on Delivery." };
                
            default:
                return { success: false, message: "Gateway error" };
        }
    }
}

module.exports = new PaymentGatewayService();
