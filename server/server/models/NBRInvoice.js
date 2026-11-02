const mongoose = require('mongoose');

const nbrInvoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerBIN: {
    type: String
  },
  customerAddress: {
    type: String,
    required: true
  },
  items: [{
    description: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    unitPrice: {
      type: Number,
      required: true
    },
    totalPrice: {
      type: Number,
      required: true
    }
  }],
  subTotal: {
    type: Number,
    required: true
  },
  vatRate: {
    type: Number,
    default: 15
  },
  vatAmount: {
    type: Number,
    required: true
  },
  grandTotal: {
    type: Number,
    required: true
  },
  companyBIN: {
    type: String,
    required: true
  },
  mushak: {
    type: String,
    default: '6.3'
  },
  status: {
    type: String,
    enum: ['draft', 'issued', 'cancelled'],
    default: 'issued'
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('NBRInvoice', nbrInvoiceSchema);