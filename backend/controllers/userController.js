const multer = require('multer');
const sharp = require('sharp');
const { AppError } = require('../middleware/errorHandler');
const User = require('../models/User');
const logger = require('../utils/logger');

// Helper for consistent logging
const log = (message, data) => {
  logger.info(`[USER] ${message}`, data || '');
};

// File upload configuration
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Please upload only images', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = async (req, res, next) => {
  try {
    if (!req.file) return next();
    
    const filename = `user-${req.user.id}-${Date.now()}.jpeg`;
    const filepath = `public/img/users/${filename}`;

    await sharp(req.file.buffer)
      .resize(500, 500)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toFile(filepath);

    req.file.filename = filename;
    next();
  } catch (error) {
    log('Error resizing user photo:', error);
    next(new AppError('Error processing image', 500));
  }
};

// @desc    Get current user profile
// @route   GET /api/v1/users/me
// @access  Private
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

// @desc    Update current user profile
// @route   PATCH /api/v1/users/me
// @access  Private
exports.updateMe = async (req, res, next) => {
  try {
    // 1) Prevent password updates via this route
    if (req.body.password || req.body.passwordConfirm) {
      throw new AppError('This route is not for password updates. Please use /updateMyPassword.', 400);
    }

    // 2) Filter allowed fields
    const allowedFields = ['name', 'email', 'university', 'major', 'year', 'bio', 'interests'];
    const filteredBody = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) filteredBody[key] = req.body[key];
    });

    // 3) Handle photo upload if exists
    if (req.file) filteredBody.photo = req.file.filename;

    // 4) Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      filteredBody,
      {
        new: true,
        runValidators: true,
        select: '-__v -passwordChangedAt'
      }
    );

    log(`User ${req.user.id} updated their profile`);
    
    res.json({
      success: true,
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    log('Error in updateMe:', error);
    next(error);
  }
};

// @desc    Deactivate current user account
// @route   DELETE /api/v1/users/me
// @access  Private
exports.deleteMe = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { active: false });
    
    log(`User ${req.user.id} deactivated their account`);
    
    res.status(204).json({
      success: true,
      data: null
    });
  } catch (error) {
    log('Error in deleteMe:', error);
    next(error);
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/v1/users
// @access  Private/Admin
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-__v -passwordChangedAt');
    
    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    log('Error in getAllUsers:', error);
    next(error);
  }
};

// Alias for getAllUsers
exports.getUsers = exports.getAllUsers;

// @desc    Get user by ID
// @route   GET /api/v1/users/:id
// @access  Private/Admin
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-__v -passwordChangedAt');
    
    if (!user) {
      throw new AppError('No user found with that ID', 404);
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    log('Error in getUser:', error);
    next(error);
  }
};

// @desc    Create user (Admin only)
// @route   POST /api/v1/users
// @access  Private/Admin
exports.createUser = async (req, res, next) => {
  try {
    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      passwordConfirm: req.body.passwordConfirm,
      university: req.body.university,
      major: req.body.major,
      year: req.body.year,
      role: req.body.role || 'user'
    });

    // Don't send back password in response
    newUser.password = undefined;
    
    log(`New user created by admin: ${newUser._id}`);
    
    res.status(201).json({
      success: true,
      data: newUser
    });
  } catch (error) {
    log('Error in createUser:', error);
    next(error);
  }
};

// @desc    Update user (Admin only)
// @route   PATCH /api/v1/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res, next) => {
  try {
    // 1) Prevent password updates via this route
    if (req.body.password) {
      throw new AppError('This route is not for password updates', 400);
    }

    // 2) Filter allowed fields
    const allowedFields = [
      'name', 'email', 'university', 'major', 'year', 
      'bio', 'interests', 'role', 'active'
    ];
    
    const filteredBody = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) filteredBody[key] = req.body[key];
    });

    // 3) Handle photo upload if exists
    if (req.file) filteredBody.photo = req.file.filename;

    // 4) Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      filteredBody,
      {
        new: true,
        runValidators: true,
        select: '-__v -passwordChangedAt'
      }
    );

    if (!updatedUser) {
      throw new AppError('No user found with that ID', 404);
    }
    
    log(`User ${req.params.id} updated by admin ${req.user.id}`);
    
    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    log('Error in updateUser:', error);
    next(error);
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/v1/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      throw new AppError('No user found with that ID', 404);
    }
    
    log(`User ${req.params.id} deleted by admin ${req.user.id}`);
    
    res.status(204).json({
      success: true,
      data: null
    });
  } catch (error) {
    log('Error in deleteUser:', error);
    next(error);
  }
};
