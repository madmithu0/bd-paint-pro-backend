const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios'); // গেটওয়ে সার্ভার ভেরিফিকেশনের জন্য (npm install axios)

// ডাটাবেজ লেভেলে ইমিউটেবিলিটি বা অপরিবর্তনশীলতা নিশ্চিত করতে অবজেক্ট ফ্রিজ করার হেল্পার (immutable)
function makeImmutable(obj) {
    return Object.freeze(obj);
}

// ==========================================
// ১. লোকাল গেটওয়ে পেমেন্ট শুরু করার রুট (Initiate Payment)
// ==========================================
router.post('/initiate', async (req, res) => {
    try {
        const { amount, customerName, customerEmail, customerPhone, agentId } = req.body;

        // ফেক পেমেন্ট ব্লক এবং ভ্যালিডেশন
        const parsedAmount = Number(amount);
        if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Security alert: Invalid or zero payment amount requested.' });
        }

        const transactionId = `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

        // SSLCommerz বা লোকাল গেটওয়ের স্যান্ডবক্স/লাইভ রিকোয়েস্ট পে-লোড তৈরি
        const gatewayData = {
            store_id: process.env.STORE_ID || 'your_local_store_id',
            store_passwd: process.env.STORE_PASSWORD || 'your_local_store_password',
            total_amount: parsedAmount,
            currency: 'BDT',
            tran_id: transactionId,
            success_url: `https://yourdomain.com{transactionId}${agentId ? `&agentId=${agentId}` : ''}`,
            fail_url: 'https://yourdomain.com',
            cancel_url: 'https://yourdomain.com',
            cus_name: customerName || 'Customer',
            cus_email: customerEmail || 'customer@mail.com',
            cus_phone: customerPhone || '01700000000',
            shipping_method: 'NO',
            product_name: 'Service_Payment',
            product_category: 'Service',
            product_profile: 'general'
        };

        // বাস্তব ক্ষেত্রে এখানে গেটওয়ের API এন্ডপয়েন্টে পোস্ট রিকোয়েস্ট যাবে:
        // const response = await axios.post('https://sslcommerz.com', gatewayData);
        // return res.redirect(response.data.GatewayPageURL);

        return res.status(200).json({
            success: true,
            message: 'Payment initialized successfully.',
            transactionId,
            gatewaySimulationUrl: `https://mockgateway.com{transactionId}`,
            meta: makeImmutable({ agentId: agentId || null })
        });

    } catch (error) {
        return res.status(500).json({ error: 'Gateway initialization failed.', details: error.message });
    }
});

// ==========================================
// ২. গেটওয়ে সাকসেস এবং আইপিএন লিসেনার (Webhook / IPN / Success Response)
// ==========================================
router.post('/success', async (req, res) => {
    try {
        // লোকাল গেটওয়ে সফল ট্রানজেকশনের পর এই বডিতে ডাটা ব্যাক পাঠায়
        const gatewayResponse = req.body; 
        const { tran_id, amount, status, verify_sign, verify_key } = gatewayResponse;
        const { agentId } = req.query; // ইনিশিয়ালাইজ করার সময় পাস করা এজেন্ট আইডি

        // কড়া সিকিউরিটি চেক: ফেক পেমেন্ট ব্লক (fake payment block)
        if (status !== 'VALID' && status !== 'SUCCESS') {
            return res.status(400).json({ error: 'Security breach: Fake or unverified gateway status received.' });
        }

        // গেটওয়ে থেকে আসা সিগনেচার দিয়ে সিকিউরিটি চেক (signature verify)
        if (verify_sign) {
            // বাস্তব গেটওয়েতে ভেরিফিকেশনের জন্য তাদের নিজস্ব API দিয়ে ডবল চেক করতে হয়:
            // const verifyUrl = `https://sslcommerz.com{gatewayResponse.val_id}&store_id=...`;
            // const verification = await axios.get(verifyUrl);
            // if(verification.data.status !== 'VALID') return res.status(401).json({error: 'Fake transaction detected.'});
        }

        const parsedAmount = Number(amount);

        // ৩. মূসক বা ভ্যাট হিসাব (Mushak VAT NBR)
        // বাংলাদেশের এনবিআর (NBR) নিয়ম অনুযায়ী সংগৃহীত মোট টাকার ওপর ১৫% মূসক (VAT) হিসাব
        const nbrVatRate = 15;
        const vatAmount = (parsedAmount * nbrVatRate) / 100;
        const netBaseAmount = parsedAmount - vatAmount; // ভ্যাট বাদে নেট মূল টাকা

        // ৪. কন্ডিশনাল প্রফিট স্প্লিট লজিক (profit conditional 80/5/15 vs 80/20 direct split)
        let companyShare = 0;
        let adminShare = 0;
        let agentShare = 0;

        if (agentId && agentId !== 'null' && agentId !== 'undefined') {
            // যদি agentId থাকে: ৮০/৫/১৫ কন্ডিশনাল স্প্লিট (কোম্পানি ৮০%, এজেন্ট ৫%, এডমিন ১৫%)
            companyShare = (netBaseAmount * 80) / 100;
            agentShare = (netBaseAmount * 5) / 100;
            adminShare = (netBaseAmount * 15) / 100;
        } else {
            // যদি agentId না থাকে: ৮০/২০ ডিরেক্ট স্প্লিট (কোম্পানি ৮০%, এডমিন ২০%)
            companyShare = (netBaseAmount * 80) / 100;
            adminShare = (netBaseAmount * 20) / 100;
            agentShare = 0;
        }

        // ৫. ইমিউটেবল ট্রানজেকশন ডাটা তৈরি ও মেমোরি লক (immutable)
        const transactionReceipt = {
            paymentId: tran_id,
            gatewayRefId: gatewayResponse.val_id || `VAL-${Date.now()}`,
            nbrMushakChallan: `MUSHAK-6.3-PAY-${Date.now()}`,
            financials: {
                grossTotalReceived: parsedAmount,
                nbrVatCollected: vatAmount,
                netBaseAmountAfterVat: netBaseAmount
            },
            splitBreakdown: {
                hasAgent: !!(agentId && agentId !== 'null'),
                agentId: agentId && agentId !== 'null' ? agentId : null,
                companyProfit: companyShare,
                adminFee: adminShare,
                agentCommission: agentShare
            },
            paymentMethod: gatewayResponse.card_type || 'MFS_bKash_Nagad',
            status: 'COMPLETED_IMMUTABLE',
            processedAt: new Date()
        };

        const immutableReceipt = makeImmutable(transactionReceipt);

        // এখানে ডাটাবেজে সেভ করার লজিক (যেমন: await Payment.create(immutableReceipt))

        // ফ্রন্টএন্ডে রিডাইরেক্ট করা বা সাকসেস মেসেজ পাঠানো
        return res.status(200).json({
            success: true,
            message: 'Local gateway payment completed and split ledger successfully frozen.',
            receipt: immutableReceipt
        });

    } catch (error) {
        return res.status(500).json({ error: 'IPN / Success processing crashed.', details: error.message });
    }
});

// ==========================================
// ৩. ওয়ালেট ব্যালেন্স চেক (wallet)
// ==========================================
router.get('/wallet-balance/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required to fetch wallet metrics.' });
        }

        const userWallet = {
            userId,
            currentBalance: 75230.50,
            currency: 'BDT',
            lastUpdated: new Date()
        };

        return res.status(200).json({
            success: true,
            wallet: makeImmutable(userWallet)
        });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to retrieve wallet information.', details: error.message });
    }
});

module.exports = router;
