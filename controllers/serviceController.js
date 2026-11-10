const Service = require('../models/Service');
const { success, error } = require('../utils/response');

const createService = async (req, res) => {
  try {
    const service = await Service.create(req.body);
    return success(res, 'Service created', service, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getAllServices = async (req, res) => {
  try {
    const services = await Service.find({ isActive: true });
    return success(res, 'Services found', services);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getServicesByCategory = async (req, res) => {
  try {
    const services = await Service.find({ category: req.params.category, isActive: true });
    return success(res, 'Services found', services);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const deleteService = async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    return success(res, 'Service deleted');
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = { createService, getAllServices, getServicesByCategory, deleteService };