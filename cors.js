const ALLOWED_DOMAINS = process.env.ALLOWED_DOMAINS ? process.env.ALLOWED_DOMAINS.split(',') : [];
const ALLOWED_IPS = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [];

const corsMiddleware = (req, res, next) => {
    const origin = req.headers.origin;
    const userAgent = req.headers['user-agent'] || '';

    // ১. পোস্টম্যান এবং স্ক্রিপ্ট টুলস ব্লক করা (Block Postman & Automated Tools)
    if (userAgent.includes('PostmanRuntime') || userAgent.includes('curl') || userAgent.includes('axios')) {
        return res.status(403).json({ error: "Access Denied: Automated tools and Postman are blocked." });
    }

    // ২. কোনো অরিজিন ছাড়া ডাইরেক্ট রিকোয়েস্ট ব্লক করা (No Any Origin / No Direct Access)
    if (!origin) {
        return res.status(403).json({ error: "Access Denied: Direct or public access without valid origin is not allowed." });
    }

    try {
        const originUrl = new URL(origin);
        const hostname = originUrl.hostname;

        // ৩. বাংলাদেশ ডোমেইন ভ্যালিডেশন (BD Domain Only Lock)
        const isBdDomain = hostname.endsWith('.bd') || hostname === 'localhost' || hostname === '127.0.0.1';
        const isWhitelistedDomain = ALLOWED_DOMAINS.includes(origin);

        if (!isBdDomain && !isWhitelistedDomain) {
            return res.status(403).json({ error: "Access Denied: Requests restricted to BD domains only." });
        }

        // ৪. আইপি হোয়াইটলিস্ট চেক (IP Whitelist)
        let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        if (clientIp.includes(',')) {
            clientIp = clientIp.split(',')[0].trim();
        }
        if (clientIp.startsWith('::ffff:')) {
            clientIp = clientIp.replace('::ffff:', '');
        }

        if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(clientIp) && clientIp !== '127.0.0.1' && clientIp !== '::1') {
            return res.status(403).json({ error: "Access Denied: Client IP is not whitelisted." });
        }

        // ৫. সঠিক CORS হেডার্স সেট করা
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }

        next();
    } catch (error) {
        return res.status(403).json({ error: "Access Denied: Invalid request metadata." });
    }
};

module.exports = corsMiddleware;
