const Order = require('../models/Order');
const { success, error } = require('../utils/response');

const createOrder = async (req, res) => {
  try {
    const order = await Order.create({ ...req.body, customer: req.user.id });
    return success(res, 'Order created', order, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user.id }).populate('worker', 'name phone');
    return success(res, 'Orders found', orders);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getWorkerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ worker: req.user.id }).populate('customer', 'name phone');
    return success(res, 'Orders found', orders);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    return success(res, 'Order updated', order);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = { createOrder, getMyOrders, getWorkerOrders, updateOrderStatus };