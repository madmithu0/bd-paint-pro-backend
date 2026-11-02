const { body, param, query, validationResult } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Common validation rules
const registerValidation = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').notEmpty().withMessage('Phone is required').isMobilePhone('bn-BD').withMessage('Valid BD phone required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['customer', 'mistri', 'admin', 'manager', 'accounts', 'support', 'super_admin']),
  validate
];

const loginValidation = [
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('phone').optional().notEmpty().withMessage('Phone required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

const jobValidation = [
  body('serviceId').notEmpty().withMessage('Service is required').isMongoId(),
  body('customerId').notEmpty().withMessage('Customer is required').isMongoId(),
  body('address').notEmpty().withMessage('Address is required'),
  body('scheduledDate').optional().isISO8601().withMessage('Valid date required'),
  validate
];

const serviceValidation = [
  body('name').notEmpty().withMessage('Service name is required').trim(),
  body('price').notEmpty().withMessage('Price is required').isNumeric(),
  body('category').notEmpty().withMessage('Category is required'),
  validate
];

const promoCodeValidation = [
  body('code').notEmpty().withMessage('Promo code is required').trim(),
  body('discountType').isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
  body('discountValue').isNumeric().withMessage('Discount value must be a number'),
  body('validFrom').isISO8601().withMessage('Valid from date required'),
  body('validTo').isISO8601().withMessage('Valid to date required'),
  validate
];

const objectIdValidation = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  validate
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  jobValidation,
  serviceValidation,
  promoCodeValidation,
  objectIdValidation
};