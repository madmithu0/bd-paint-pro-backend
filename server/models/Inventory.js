import mongoose from 'mongoose';
const InventorySchema = new mongoose.Schema({
  itemName: String,
  quantity: Number,
  unit: String,
  price: Number,
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
export default mongoose.model('Inventory', InventorySchema);