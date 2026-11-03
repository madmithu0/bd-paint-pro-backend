const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SuperAdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    btrcMaskingID: { type: String, required: true },
    bin: { type: String, required: true },
    nbrData: { type: String, required: true },
    role: { type: String, default: 'SuperAdmin' }
});

const SuperAdmin = mongoose.model('SuperAdmin', SuperAdminSchema);

const seedSuperAdmin = async () => {
    try {
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET || JWT_SECRET.length !== 64) {
            throw new Error("Security Alert: JWT Secret must be exactly 64 characters long.");
        }

        const adminPassword = process.env.ADMIN_PASSWORD || "P@ss12CharMin!";
        if (adminPassword.length < 12) {
            throw new Error("Security Alert: Admin password must be at least 12 digits/characters long.");
        }

        const existingAdmin = await SuperAdmin.findOne({ role: 'SuperAdmin' });
        if (existingAdmin) {
            return;
        }

        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        const superAdminData = {
            username: process.env.ADMIN_USERNAME || 'superadmin_bd',
            password: hashedPassword,
            btrcMaskingID: process.env.BTRC_MASKING_ID || 'BTRC-MASK-99X',
            bin: process.env.BIN_NUMBER || '123456789-0001',
            nbrData: process.env.NBR_DATA || 'NBR-REG-2026'
        };

        const newAdmin = new SuperAdmin(superAdminData);
        await newAdmin.save();

        const token = jwt.sign(
            { id: newAdmin._id, role: newAdmin.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

    } catch (error) {
        process.exit(1);
    }
};

module.exports = seedSuperAdmin;
