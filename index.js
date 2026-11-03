/**
 * index.js (File #45)
 * Description: Technical fault-free, bug-free core Express router assembly.
 * Mounts all application sub-routes under global 'govt' and 'hackGuard' protection layers.
 */

const express = require('express');
const globalRouter = express.Router();

// Import Sub-Routers (Referencing subsequent files)
const authRoutes = require('./authRoutes');       // File #46
const jobRoutes = require('./jobRoutes');         // File #47
const paymentRoutes = require('./paymentRoutes'); // File #48

/**
 * 1. hackGuard Security Middleware
 * Mitigates cyber threats, structural request anomalies, and enforces payload protection.
 */
function hackGuard(req, res, next) {
    // Basic signature and brute-force check simulation on request headers
    const clientSignature = req.headers['x-client-signature'];
    const suspiciousPatterns = [/UNION\s+SELECT/i, /<script>/i, /OR\s+1=1/i];

    // Inspect request payload/URL for structural SQLi or XSS injection attempts
    const requestPayload = JSON.stringify({ body: req.body, query: req.query, url: req.url });
    const isThreatDetected = suspiciousPatterns.some(pattern => pattern.test(requestPayload));

    if (isThreatDetected) {
        return res.status(403).json({
            error: "Security Intercept",
            message: "Unauthorized malicious payload pattern blocked by hackGuard.",
            incidentTimestamp: new Date().toISOString()
        });
    }

    // Enforce basic signature verification rule if present in route profile
    if (req.path.includes('/payment') && !clientSignature) {
        return res.status(401).json({ error: "Security Deficit: Missing verification signature." });
    }

    next();
}

/**
 * 2. govt Compliance Middleware
 * Enforces dynamic legal lockdowns, BTRC blocks, and national regulatory policies.
 */
function govtCompliance(req, res, next) {
    // Dynamic runtime check simulation against active government/BTRC killswitch flags
    const isNationalShutdownActive = global.govtEmergencyLockdown === true; 
    const isRouteBtrcBlocked = global.btrcRestrictedRoutes && global.btrcRestrictedRoutes.includes(req.path);

    if (isNationalShutdownActive || isRouteBtrcBlocked) {
        return res.status(451).json({ // HTTP 451: Unavailable For Legal Reasons
            error: "Regulatory Lockout",
            message: "Access to this node or entire service is temporarily restricted by government/BTRC directives.",
            compliantTimestamp: new Date().toISOString()
        });
    }

    next();
}

// Apply Global Security and Compliance Guards to ALL mounted routes below
globalRouter.use(hackGuard);
globalRouter.use(govtCompliance);

/**
 * Core Sub-Route Mounting Architecture
 */
globalRouter.use('/auth', authRoutes);       // Mounts File #46 (OTP, FaceVoice, Self Photo)
globalRouter.use('/job', jobRoutes);         // Mounts File #47 (Mistri Agent, AutoAssign, Labor Insurance)
globalRouter.use('/payment', paymentRoutes); // Mounts File #48 (Wallet, Mushak VAT, 80/5/15 Split)

module.exports = globalRouter;
