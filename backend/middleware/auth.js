const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const User = require('../models/User');
const StudyGroup = require('../models/StudyGroup');
const Token = require('../models/Token');
const ErrorResponse = require('../utils/errorResponse');

// Get token from header with detailed logging
const getToken = (req) => {
  const log = (message, data = {}) => {
    console.log(`[${new Date().toISOString()}] [Auth] ${message}`, data);
  };
  
  try {
    log('Checking for authorization header');
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      log('No authorization header found');
      return null;
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      log('Authorization header does not start with Bearer', { authHeader: authHeader ? '***REDACTED***' : 'undefined' });
      return null;
    }
    
    const token = authHeader.split(' ')[1];
    log('Token extracted from header', { token: token ? '***REDACTED***' : 'undefined' });
    
    return token;
  } catch (error) {
    log('Error extracting token', { error: error.message, stack: error.stack });
    return null;
  }
};

// Protect routes with JWT authentication
const protect = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  const log = (message, data = {}) => {
    const timestamp = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] [Auth][+${timestamp}ms] ${message}`, data);
  };
  
  try {
    log('1️⃣ Starting authentication');
    
    // 1) Get token
    log('2️⃣ Getting token from request');
    const token = getToken(req);
    if (!token) {
      log('❌ No token found in request');
      return next(new ErrorResponse('Please log in to access', 401));
    }
    log('✅ Token found', { tokenLength: token.length });

    // 2) Verify token
    log('3️⃣ Verifying JWT token');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      log('✅ Token verified', { userId: decoded.id });
    } catch (err) {
      log('❌ Token verification failed', { error: err.message });
      if (err.name === 'TokenExpiredError') {
        return next(new ErrorResponse('Token expired', 401));
      }
      return next(new ErrorResponse('Invalid token', 401));
    }

    // 3) Check token blacklist
    log('4️⃣ Checking token blacklist');
    try {
      const isBlacklisted = await Token.isBlacklisted(token);
      if (isBlacklisted) {
        log('❌ Token is blacklisted');
        return next(new ErrorResponse('Token is invalid', 401));
      }
      log('✅ Token is not blacklisted');
    } catch (error) {
      log('❌ Error checking token blacklist', { error: error.message });
      return next(new ErrorResponse('Error validating token', 500));
    }

    // 4) Get user from token
    log('5️⃣ Fetching user from database', { userId: decoded.id });
    let user;
    try {
      user = await User.findById(decoded.id).select('-password +isActive');
      if (!user) {
        log('❌ User not found in database', { userId: decoded.id });
        return next(new ErrorResponse('User not found', 401));
      }
      log('✅ User found', { userId: user._id, email: user.email });
    } catch (error) {
      log('❌ Error fetching user from database', { error: error.message });
      return next(new ErrorResponse('Error authenticating user', 500));
    }

    // 5) Check if user changed password after token was issued
    log('6️⃣ Checking if password was changed after token was issued');
    try {
      if (user.changedPasswordAfter(decoded.iat)) {
        log('❌ Password was changed after token was issued');
        return next(new ErrorResponse('Password was changed. Please log in again', 401));
      }
      log('✅ Password not changed since token was issued');
    } catch (error) {
      log('❌ Error checking password change status', { error: error.message });
      return next(new ErrorResponse('Error validating session', 500));
    }

    // 6) Check if account is active
    log('7️⃣ Checking if account is active', { 
      userId: user._id,
      email: user.email,
      isActive: user.isActive,
      isActiveType: typeof user.isActive
    });
    
    if (!user.isActive) {
      log('❌ Account is deactivated', { email: user.email });
      return next(new ErrorResponse('Account is deactivated', 401));
    }
    log('✅ Account is active');

    // 7) Grant access to protected route
    log('8️⃣ Authentication successful, attaching user to request');
    req.user = user;
    req.token = token;

    // Set user in response locals for use in controllers
    if (res.locals) {
      res.locals.user = user;
    }

    log('✅ Authentication completed successfully', { 
      userId: user._id,
      email: user.email,
      duration: Date.now() - startTime + 'ms'
    });
    
    next();
  } catch (error) {
    log('❌ Unexpected error in authentication middleware', { 
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime + 'ms'
    });
    next(error);
  }
});

// Restrict access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(`User role ${req.user.role} is not authorized`, 403)
      );
    }
    next();
  };
};

// Check if user is a group admin or the resource owner
const groupAdmin = asyncHandler(async (req, res, next) => {
  const groupId = req.params.id || req.params.groupId;
  const userId = req.user.id;

  // Find the group and check if the user is the admin
  const group = await StudyGroup.findOne({
    _id: groupId,
    $or: [
      { 'members.user': userId, 'members.role': 'admin' },
      { creator: userId }
    ]
  });

  if (!group) {
    return next(new ErrorResponse('Not authorized to perform this action', 403));
  }

  req.group = group;
  next();
});

// Check if user is admin or group admin/creator
const adminOrGroupAdmin = asyncHandler(async (req, res, next) => {
  // If user is admin, allow access
  if (req.user.role === 'admin') {
    return next();
  }
  
  // If there's no group ID in query, only allow admins
  const { groupId } = req.query;
  if (!groupId) {
    return next(new ErrorResponse('Group ID is required', 400));
  }

  // Check if user is group admin or creator
  const group = await StudyGroup.findOne({
    _id: groupId,
    $or: [
      { 'members.user': req.user.id, 'members.role': 'admin' },
      { creator: req.user.id }
    ]
  });

  if (!group) {
    return next(new ErrorResponse('Not authorized to access this resource', 403));
  }

  req.group = group;
  next();
});

// Check if user is a group member
const groupMember = asyncHandler(async (req, res, next) => {
  const groupId = req.params.id || req.params.groupId;
  const userId = req.user.id;

  // Find the group and check if the user is a member
  const group = await StudyGroup.findOne({
    _id: groupId,
    'members.user': userId
  });

  if (!group) {
    return next(new ErrorResponse('Not authorized to access this group', 403));
  }

  req.group = group;
  next();
});

// Check if user owns a resource
const resourceOwner = (model, paramName = 'id') => asyncHandler(async (req, res, next) => {
  const resource = await model.findById(req.params[paramName]);
  
  if (!resource) {
    return next(new ErrorResponse('Resource not found', 404));
  }
  
  if (resource.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this resource', 403));
  }
  
  req.resource = resource;
  next();
});

module.exports = { 
  protect, 
  authorize, 
  groupAdmin,
  adminOrGroupAdmin,
  groupMember,
  resourceOwner
};
