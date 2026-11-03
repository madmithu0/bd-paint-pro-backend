const express = require('express');
const router = express.Router();

// ১. নতুন সার্ভিস তৈরি বা সার্ভিস ডাটা হ্যান্ডেল করা (service)
router.post('/create', async (req, res) => {
    try {
        const { customerId, serviceType, details } = req.body;

        if (!customerId || !serviceType) {
            return res.status(400).json({ error: 'Missing required fields: customerId or serviceType' });
        }

        // সার্ভিস ডাটাবেজে সেভ করার লজিক (যেমন: MongoDB বা PostgreSQL)
        // const newService = await Service.create({ customerId, serviceType, details, status: 'pending' });

        return res.status(201).json({ 
            success: true, 
            message: 'Service registered successfully.',
            data: { customerId, serviceType, status: 'pending' }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// ২. খরচের আনুমানিক হিসাব তৈরি করা (estimate)
router.post('/estimate', async (req, res) => {
    try {
        const { serviceId, basePrice, laborCost, materialCost } = req.body;

        if (!serviceId || basePrice === undefined) {
            return res.status(400).json({ error: 'Service ID and Base Price are required.' });
        }

        // মোট আনুমানিক খরচ হিসাব (বাগ ও গ্যাপ মুক্ত রাখার জন্য প্রোপার টাইপ কাস্টিং)
        const totalEstimate = Number(basePrice) + Number(laborCost || 0) + Number(materialCost || 0);

        return res.status(200).json({
            success: true,
            serviceId,
            estimatedCost: totalEstimate,
            message: 'Estimation calculated successfully.'
        });
    } catch (error) {
        return res.status(500).json({ error: 'Estimation calculation failed.', details: error.message });
    }
});

// ৩. কোয়ালিটি বা গুণগত মান যাচাই করা (qualityCheck)
router.post('/quality-check', async (req, res) => {
    try {
        const { serviceId, inspectorId, status, checklist } = req.body;

        if (!serviceId || !inspectorId || !status) {
            return res.status(400).json({ error: 'Missing serviceId, inspectorId, or status.' });
        }

        // স্ট্যাটাস পাস বা ফেইল চেক করা
        const isPassed = status.toLowerCase() === 'passed';

        return res.status(200).json({
            success: true,
            serviceId,
            qualityStatus: isPassed ? 'PASSED' : 'FAILED',
            checkedBy: inspectorId,
            timestamp: new Date()
        });
    } catch (error) {
        return res.status(500).json({ error: 'Quality check processing failed.', details: error.message });
    }
});

// ৪. মূসক (Mushak) ভ্যাট চালানসহ ইনভয়েস জেনারেট করা (invoice Mushak)
router.post('/invoice-mushak', async (req, res) => {
    try {
        const { serviceId, amount, vatPercentage } = req.body;

        if (!serviceId || !amount) {
            return res.status(400).json({ error: 'Service ID and Amount are required.' });
        }

        // বাংলাদেশের প্রচলিত এনবিআর (NBR) নিয়ম অনুযায়ী মূসক বা ভ্যাট হিসাব (ডিফল্ট ১৫% যদি উল্লেখ না থাকে)
        const currentVatRate = vatPercentage !== undefined ? Number(vatPercentage) : 15; 
        const vatAmount = (Number(amount) * currentVatRate) / 100;
        const totalPayable = Number(amount) + vatAmount;

        // সরকারি নিয়মে মূসক চালান নাম্বার জেনারেট করার ডামি ফরম্যাট (Mushak 6.3)
        const mushakChallanNo = `MUSHAK-6.3-${Date.now()}`;

        return res.status(200).json({
            success: true,
            invoice: {
                serviceId,
                mushakChallanNo,
                subTotal: Number(amount),
                vatRate: `${currentVatRate}%`,
                vatAmount: vatAmount,
                totalPayable: totalPayable,
                issuedAt: new Date()
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to generate Mushak invoice.', details: error.message });
    }
});

module.exports = router;
