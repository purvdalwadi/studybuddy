const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Token = require('../models/Token');
const { AppError } = require('../middleware/errorHandler');
const { sendEmail, emailTemplates } = require('../utils/sendEmail');
const logger = require('../utils/logger');


// Configuration
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 7;

// Cookie options
// For local development, set secure: false, sameSite: 'lax', and remove domain.
// For production, restore secure: true, sameSite: 'strict', and set domain.
const cookieOptions = {
  httpOnly: true,
  secure: false, // set to true in production
  sameSite: 'lax', // 'strict' or 'none' for production
  maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  path: '/',
  domain: process.env.COOKIE_DOMAIN
};


// Helper functions
const logAuth = (message, data = {}) => {
  logger.info(`[AUTH] ${message}`, data);
};

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
};

const generateRefreshToken = async (userId, req) => {
  const token = crypto.randomBytes(40).toString('hex');
  
  await Token.create({
    token,
    user: userId,
    type: 'refresh',
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  });
  
  return token;
};

const sendTokenResponse = (user, statusCode, res, additionalData = {}) => {
  const token = signToken(user._id);
  
  // Create a sanitized user object without sensitive data
  const userObj = user.toObject();
  delete userObj.password;
  delete userObj.refreshTokens;
  
  res.status(statusCode).json({
    success: true,
    token,
    user: userObj,
    ...additionalData
  });
};

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, university, major, year } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('User already exists with this email', 400));
    }
    
    // Create user
    const user = await User.create({
      name,
      email,
      password,
      university,
      major,
      year,
      verificationToken: crypto.randomBytes(20).toString('hex')
    });
    
    // Send welcome email (in background) - temporarily disabled for testing
    // await sendEmail({
    //   email: user.email,
    //   subject: 'Welcome to StudyBuddy!',
    //   message: `Welcome ${user.name}! Your account has been created.`
    // }).catch(err => logAuth('Error sending welcome email', { error: err.message }));
    
    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('Registration error:', error);
    logger.error('Registration failed', { 
      error: error.message, 
      stack: error.stack,
      name: error.name,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue
    });
    next(new AppError(`Registration failed: ${error.message}`, 400));
  }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = [

  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return next(new AppError('Please provide email and password', 400));
      }

      // Check if user exists and password is correct
      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.comparePassword(password))) {
        return next(new AppError('Invalid credentials', 401));
      }

      // Generate tokens
      const token = signToken(user._id);
      const refreshToken = await generateRefreshToken(user._id, req);

      // Update user's last login
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      // Set refresh token in cookie
      res.cookie('refreshToken', refreshToken, cookieOptions);
      
      // Send response with token
      res.status(200).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue
      });
      logger.error('Login failed', { 
        error: error.message, 
        stack: error.stack,
        name: error.name,
        code: error.code,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue
      });
      next(new AppError(`Login failed: ${error.message}`, 500));
    }
  }
];

// @desc    Get current user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(new AppError('Failed to fetch user', 500));
  }
};

// @desc    Update user details
// @route   PUT /api/v1/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Check if this is an avatar removal request (either null or default.jpg)
    const isAvatarRemoval = req.body.avatar === null || 
                          (req.file && req.file.originalname === 'default.jpg');
    
    if (isAvatarRemoval) {
      const removalType = req.body.avatar === null ? 'explicit null' : 'default.jpg upload';
      logger.info(`🔄 [Avatar] Processing avatar removal (${removalType})`, {
        userId: user._id,
        hasExistingAvatar: !!(user.avatar && user.avatar.publicId),
        existingPublicId: user.avatar?.publicId || 'none',
        requestType: req.file ? 'file upload' : 'json data'
      });

      // If avatar is explicitly set to null, remove it
      if (user.avatar && user.avatar.publicId) {
        try {
          const cloudinary = require('../utils/cloudinary');
          logger.info(`🗑️ [Avatar] Deleting avatar from Cloudinary: ${user.avatar.publicId}`);
          
          const startTime = Date.now();
          await cloudinary.deleteFile(user.avatar.publicId);
          const duration = Date.now() - startTime;
          
          logger.info(`✅ [Avatar] Successfully deleted avatar from Cloudinary in ${duration}ms`, {
            publicId: user.avatar.publicId,
            durationMs: duration
          });
        } catch (error) {
          logger.error('❌ [Avatar] Error removing old avatar from Cloudinary', {
            error: error.message,
            stack: error.stack,
            publicId: user.avatar?.publicId
          });
          // Continue even if deletion fails
        }
      } else {
        logger.info('ℹ️ [Avatar] No avatar found to remove from Cloudinary');
      }
      
      // Set default avatar instead of removing it
      const defaultAvatar = {
        url: 'https://res.cloudinary.com/dsp5azdut/image/upload/v1752304495/default-avatar_ucj7rr.webp',
        publicId: null
      };
      
      logger.info(`📝 [Avatar] Setting default avatar for user: ${user._id}`);
      const startTime = Date.now();
      const updatedUser = await User.findByIdAndUpdate(
        req.user.id, 
        { $set: { avatar: defaultAvatar } },
        {
          new: true,
          runValidators: true,
          select: '-password -__v -passwordChangedAt -passwordResetToken -passwordResetExpires'
        }
      );
      const duration = Date.now() - startTime;
      
      logger.info(`✅ [Avatar] Successfully updated user document in ${duration}ms`, {
        userId: user._id,
        durationMs: duration,
        updatedFields: Object.keys(updatedUser._doc).filter(k => k !== 'password')
      });

      return res.status(200).json({ 
        success: true, 
        data: updatedUser 
      });
    }

    // For non-avatar updates, process normally
    const fieldsToUpdate = {
      name: req.body.name || user.name,
      email: req.body.email || user.email,
      university: req.body.university || user.university,
      major: req.body.major || user.major,
      year: req.body.year || user.year,
      bio: req.body.bio || user.bio
    };

    // Handle file upload if present
    if (req.file) {
      try {
        logger.info('Processing file upload', {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          bufferLength: req.file.buffer ? req.file.buffer.length : 'no buffer'
        });

        const cloudinary = require('../utils/cloudinary');
        
        // If user already has an avatar, delete the old one from Cloudinary
        if (user.avatar && user.avatar.publicId) {
          try {
            logger.info(`Deleting old avatar with publicId: ${user.avatar.publicId}`);
            await cloudinary.deleteFile(user.avatar.publicId);
          } catch (deleteError) {
            logger.error('Error deleting old avatar:', deleteError);
            // Continue with upload even if deletion fails
          }
        }

        // Upload new avatar to Cloudinary
        logger.info('Uploading new avatar to Cloudinary...');
        const result = await cloudinary.uploadFile(
          req.file.buffer, 
          'avatars', 
          `user_${user._id}`
        );
        
        if (!result || !result.secure_url) {
          throw new Error('Invalid response from Cloudinary');
        }
        
        logger.info('Avatar uploaded successfully', {
          url: result.secure_url,
          publicId: result.public_id
        });
        
        // Store both URL and public ID for future updates/deletions
        fieldsToUpdate.avatar = {
          url: result.secure_url,
          publicId: result.public_id
        };
      } catch (error) {
        logger.error('Error in avatar upload process:', {
          error: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code,
          http_code: error.http_code
        });
        return next(new AppError(`Error uploading avatar: ${error.message}`, 500));
      }
    } else if (req.body.avatar === null) {
      // If avatar is explicitly set to null, remove it
      if (user.avatar && user.avatar.publicId) {
        try {
          const cloudinary = require('../utils/cloudinary');
          await cloudinary.deleteFile(user.avatar.publicId);
        } catch (error) {
          logger.error('Error removing old avatar:', error);
          // Continue even if deletion fails
        }
      }
      fieldsToUpdate.avatar = undefined; // This will remove the avatar field
    }

    // Update user with new data
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id, 
      { $set: fieldsToUpdate },
      {
        new: true,
        runValidators: true,
        select: '-password -__v -passwordChangedAt -passwordResetToken -passwordResetExpires'
      }
    );

    res.status(200).json({ 
      success: true, 
      data: updatedUser 
    });
  } catch (error) {
    logger.error('Error in updateDetails:', error);
    next(new AppError('Failed to update details', 500));
  }
};

// @desc    Update password
// @route   PUT /api/v1/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return next(new AppError('Current password is incorrect', 401));
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(new AppError('Failed to update password', 500));
  }
};

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  let user;
  try {
    user = await User.findOne({ email: req.body.email });
    
    if (!user) {
      return next(new AppError('No user found with that email', 404));
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL (pointing to frontend)
    const frontendUrl = process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    try {
      // Use the HTML email template
      const emailTemplate = emailTemplates.resetPassword(user, resetUrl);
      
      await sendEmail({
        email: user.email,  // Changed from 'to' to 'email' to match the expected parameter
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: `You are receiving this email because you requested a password reset.\n\n${resetUrl}`
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      throw new Error('Failed to send password reset email');
    }

    res.status(200).json({ success: true, message: 'Token sent to email' });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    
    if (user) {
      console.log('Clearing password reset token due to error');
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      try {
        await user.save({ validateBeforeSave: false });
      } catch (saveError) {
        console.error('Error clearing reset token:', saveError);
      }
    }
    
    // Log detailed error information
    if (error.response) {
      console.error('Email service response error:', {
        status: error.response.status,
        body: error.response.body,
        headers: error.response.headers
      });
    }
    
    next(new AppError(`There was an error sending the email: ${error.message}`, 500));
  }
};

// @desc    Reset password
// @route   PUT /api/v1/auth/resetpassword/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return next(new AppError('Token is invalid or has expired', 400));
    }

    // Set new password and update timestamps
    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = Date.now();
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(new AppError('Failed to reset password', 500));
  }
};

// @desc    Logout user / clear cookie
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = (req, res) => {
  res.cookie('refreshToken', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({ success: true, data: {} });
};

// @desc    Logout user from all devices
// @route   POST /api/v1/auth/logout-all
// @access  Private
exports.logoutAll = async (req, res, next) => {
  try {
    // Delete all refresh tokens for this user
    await Token.deleteMany({ user: req.user.id, type: 'refresh' });
    
    // Clear the refresh token cookie
    res.cookie('refreshToken', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    res.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully',
      data: {}
    });
  } catch (error) {
    log('Error in logoutAll:', error);
    next(new AppError('Failed to log out from all devices', 500));
  }
};

// @desc    Refresh access token
// @route   POST /api/v1/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies || {};
    
    if (!refreshToken) {
      return next(new AppError('No refresh token provided', 401));
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    // Find the token in the database
    const tokenDoc = await Token.findOne({
      token: refreshToken,
      type: 'refresh',
      expiresAt: { $gt: new Date() }
    });

    if (!tokenDoc) {
      return next(new AppError('Invalid or expired refresh token', 401));
    }

    // Get the user
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }

    // Generate new access token
    const newAccessToken = signToken(user._id);
    
    // Optionally, you can generate a new refresh token here as well
    // and delete the old one (refresh token rotation)
    
    res.status(200).json({
      success: true,
      token: newAccessToken
    });
  } catch (error) {
    next(new AppError('Failed to refresh token', 401));
  }
};
