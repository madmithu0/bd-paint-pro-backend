/**
 * ১১. roleCheck.js
 * বর্ণনা: রোল ভিত্তিক অ্যাক্সেস কন্ট্রোল, বায়োমেট্রিক ভ্যালিডেশন এবং রোল এসকেলেশন প্রতিরোধ মিডলওয়্যার
 */

const ALLOWED_ROLES = ['superAdmin', 'agent', 'mistri', 'customer'];

const roleCheck = (requiredRole) => {
    return async (req, res, next) => {
        try {
            const user = req.user;

            // ১. ইউজার বা ইউজারের রোল না থাকলে অ্যাক্সেস ব্লক করা
            if (!user || !user.role) {
                return res.status(401).json({ error: "Unauthorized: Access metadata missing." });
            }

            // ২. রোল এসকেলেশন প্রতিরোধ (noRoleEscalation)
            // রিকোয়েস্ট বডিতে সিস্টেমের রোল পরিবর্তন করার চেষ্টা থাকলে তা ব্লক করা
            if (req.body && req.body.role) {
                if (req.body.role !== user.role) {
                    return res.status(403).json({ error: "Security Alert: Privilege escalation attempt blocked." });
                }
            }

            // ৩. নির্দিষ্ট রোলের সাথে বর্তমান ইউজারের রোল ম্যাচিং চেক
            if (user.role !== requiredRole || !ALLOWED_ROLES.includes(user.role)) {
                return res.status(403).json({ error: "Forbidden: You do not have permission to access this resource." });
            }

            // ৪. সুপারঅ্যাডমিন স্পেশাল সিকিউরিটি প্রোটোকল (superAdmin faceVoice check + 12digit must)
            if (user.role === 'superAdmin') {
                const faceVerified = req.headers['x-face-verified'] === 'true';
                const voiceVerified = req.headers['x-voice-verified'] === 'true';

                if (!faceVerified || !voiceVerified) {
                    return res.status(403).json({ error: "Security Alert: SuperAdmin Biometric (Face & Voice) authentication required." });
                }

                // সুপারঅ্যাডমিনের ইন্টারনাল সিকিউরিটি কী বা টোকেন লেন্থ ন্যূনতম ১২ ডিজিট ভ্যালিডেশন
                const securePin = req.headers['x-secure-pin'] || '';
                if (!securePin || securePin.length < 12) {
                    return res.status(403).json({ error: "Security Alert: Minimum 12-digit secure PIN is required for SuperAdmin actions." });
                }
            }

            next();
        } catch (error) {
            return res.status(500).json({ error: "Technical Fault: Access validation error." });
        }
    };
};

module.exports = roleCheck;
