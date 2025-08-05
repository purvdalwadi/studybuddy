const express = require('express');
const multer = require('multer');

const router = express.Router();

// Controllers
const authController = require('../controllers/authController');

// Middleware
const { protect } = require('../middleware/auth');
const { validate, userValidationRules } = require('../middleware/validation');

// File upload configuration
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  console.log('Multer processing file:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    const error = new Error('Please upload only images');
    console.error('Multer file filter error:', error.message);
    cb(error, false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
});

// Add middleware to log multer errors
const handleMulterErrors = (err, req, res, next) => {
  if (err) {
    console.error('Multer error:', {
      message: err.message,
      name: err.name,
      stack: err.stack,
      code: err.code,
      field: err.field
    });
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
    
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Error uploading file.'
    });
  }
  next();
};

/**
 * Rate Limiting Configuration
 * Protects against brute force and DDoS attacks
 */

/**
 * Security Headers Middleware
 * Adds security headers to all auth routes
 */
const securityHeaders = (req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'same-origin');
  
  // Prevent caching of sensitive data
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

// Apply security headers to all routes
router.use(securityHeaders);

// Health check endpoint (excluded from rate limiting)
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Auth service is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV || 'development',
    cloudinary: {
      configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '***' + String(process.env.CLOUDINARY_CLOUD_NAME).slice(-4) : 'not set',
      api_key: process.env.CLOUDINARY_API_KEY ? '***' + String(process.env.CLOUDINARY_API_KEY).slice(-4) : 'not set',
      api_secret: process.env.CLOUDINARY_API_SECRET ? '***' + String(process.env.CLOUDINARY_API_SECRET).slice(-4) : 'not set'
    }
  });
});


// Public Routes
router.post(
  '/register',
  validate(userValidationRules.register()),
  authController.register
);

router.post(
  '/login',

  validate(userValidationRules.login()),
  authController.login
);

router.post(
  '/forgot-password',
  validate(userValidationRules.forgotPassword()),
  authController.forgotPassword
);

router.put(
  '/reset-password/:token',
  validate(userValidationRules.resetPassword()),
  authController.resetPassword
);

// Protected Routes (require authentication)
router.use(protect);

router.get('/me', authController.getMe);
router.put('/profile', 
  upload.single('avatar'),
  handleMulterErrors,
  validate(userValidationRules.updateProfile()),
  authController.updateDetails
);
router.put('/update-password',
  validate(userValidationRules.changePassword()),
  authController.updatePassword
);
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout-all', authController.logoutAll);

module.exports = router;
