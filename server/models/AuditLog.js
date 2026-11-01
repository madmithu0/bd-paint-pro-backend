import mongoose from 'mongoose';
const AuditLogSchema = new mongoose.Schema({
  userId: String, action: String, details: Object, ip: String
}, { timestamps: true });
export default mongoose.model('AuditLog', AuditLogSchema);