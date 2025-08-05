const { validationResult, body, query } = require('express-validator');
const { AppError } = require('./errorHandler');

// Simple debug logger
const debug = (req, message, data = {}) => {
  const requestId = req.requestId || 'unknown';
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${requestId}] [VALIDATION] ${message}`, data);
};

/**
 * Middleware to handle request validation using express-validator
 * @param {Array} validations - Array of validation chains
 * @returns {Function} Express middleware function
 */
const validate = (validations) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    req.requestId = req.requestId || Math.random().toString(36).substr(2, 8);
    
    // Enhanced logging function
    const log = (message, data = {}) => {
      const timestamp = Date.now() - startTime;
      const logData = { 
        ...data, 
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        params: req.params || {},
        validationCount: validations?.length || 0,
        timestamp: new Date().toISOString()
      };
      console.log(`[${logData.timestamp}] [${req.requestId}] [VALIDATE][+${timestamp}ms] ${message}`, logData);
      return timestamp;
    };
    
    // Log entry to validation middleware
    console.log(`[${new Date().toISOString()}] [VALIDATION] Starting validation for ${req.method} ${req.path}`, {
      requestId: req.requestId,
      body: req.body,
      params: req.params,
      query: req.query
    });
    
    // Log request details
    log('Request received', {
      url: req.originalUrl,
      method: req.method,
      body: req.body || {},
      query: req.query,
      params: req.params,
      headers: {
        'content-type': req.get('content-type'),
        'authorization': req.get('authorization') ? '***REDACTED***' : 'Not provided',
        'content-length': req.get('content-length')
      }
    });
    
    try {
      // Log the start of validation
      log('🚀 Starting validation middleware', {
        validationCount: validations ? validations.length : 0,
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body) : []
      });
      
      // Skip if no validations
      if (!validations || validations.length === 0) {
        log('ℹ️ No validations to run, skipping validation');
        return next();
      }
      
      // Log the validations that will be run
      log('🔍 Validations to run:', {
        count: validations.length,
        validations: validations.map((v, i) => ({
          index: i,
          field: v.fields?.[0] || 'unknown',
          location: v._context?.location || 'unknown',
          message: v._context?.message || 'No message',
          type: v.constructor.name
        }))
      });
      
      // Run each validation sequentially with logging
      for (let i = 0; i < validations.length; i++) {
        const validation = validations[i];
        const field = validation.fields?.[0] || 'unknown';
        
        try {
          log(`🔄 Running validation ${i + 1}/${validations.length} for field: ${field}`);
          await validation.run(req);
          log(`✅ Validation ${i + 1} completed for field: ${field}`);
        } catch (validationError) {
          log(`❌ Validation ${i + 1} failed for field: ${field}`, { 
            error: validationError.message,
            stack: validationError.stack
          });
          throw validationError;
      }
      }
      
      // Check for validation errors
      log('🔍 Checking for validation errors...');
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        const errorDetails = errors.array();
        log('❌ Validation failed', { errorCount: errorDetails.length, errors: errorDetails });
        return res.status(400).json({
          success: false,
          errors: errorDetails
        });
      }
      
      log('✅ All validations passed successfully');
      return next();
      
    } catch (error) {
      log('🔥 Unhandled validation error', { 
        error: error.message,
        stack: error.stack,
        name: error.name
      });
      return next(error);
    }
    
    // Log the validations that will be run
    if (validations && validations.length > 0) {
      log('🔍 Validations to run:', {
        count: validations.length,
        validations: validations.map(v => ({
          fields: v.fields || [],
          location: v._context?.location || 'unknown',
          message: v._context?.message || 'No message'
        }))
      });
    } else {
      log('ℹ️ No validations to run, skipping validation');
      return next();
    }
    
    // Log request start
    log('🔄 Starting request validation', {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      body: req.body ? JSON.stringify(req.body).substring(0, 500) : 'No body',
      query: req.query,
      params: req.params,
      headers: {
        'content-type': req.get('content-type'),
        authorization: req.get('authorization') ? '***REDACTED***' : 'Not provided',
        'content-length': req.get('content-length')
      }
    });
    
    // Add request ID to response headers for tracing
    res.set('X-Request-ID', req.requestId);
    
    try {
      log('Starting validation middleware', {
        validationCount: validations ? validations.length : 0,
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body) : []
      });

      // Skip if no validations
      if (!validations || !validations.length) {
        log('No validations to run, proceeding to next middleware');
        return next();
      }

      // Log all validations that will be run
      log('Validations to run:', {
        validations: validations.map((v, idx) => ({
          index: idx + 1,
          fields: v.fields || [],
          message: v.message || 'No custom message',
          stack: v.stack ? v.stack.split('\n').slice(0, 3).join('\n') : 'No stack',
          context: v._context || {}
        }))
      });

      // Log before starting validations
      log('🔍 Starting to run validations', {
        validationCount: validations.length,
        validationTypes: validations.map(v => ({
          fields: v.fields || [],
          location: v._context?.location || 'unknown',
          message: v._context?.message || 'No message',
          optional: !!v._context?.optional
        }))
      });

      // Run all validations in sequence for better error handling
      for (let i = 0; i < validations.length; i++) {
        const validation = validations[i];
        const validationId = `${i + 1}/${validations.length}`;
        const context = validation._context || {};
        const validationFields = context.fields || [];
        
        const validationLog = {
          validationId,
          fields: validationFields,
          location: context.location || 'body',
          message: context.message || 'No custom message',
          optional: !!context.optional,
          currentValues: {}
        };

        // Log current values being validated
        validationFields.forEach(field => {
          if (req.body && req.body[field] !== undefined) {
            validationLog.currentValues[field] = 
              typeof req.body[field] === 'string' 
                ? req.body[field].substring(0, 100) 
                : req.body[field];
          }
        });
        
        log(`🔍 [${validationId}] Starting validation`, validationLog);
        
        try {
          const validationStart = Date.now();
          log(`⏳ [${validationId}] Running validation`, { fields: validationFields });
          
          // Add debug logging before and after running the validation
          log(`⏳ [${validationId}] About to run validation.run()`, { 
            validationType: typeof validation.run,
            isAsync: validation.run.constructor.name === 'AsyncFunction'
          });
          
          const result = validation.run(req);
          
          // Check if the validation returned a promise
          if (result && typeof result.then === 'function') {
            log(`⏳ [${validationId}] Validation returned a promise, waiting for it to resolve`);
            await result;
            log(`✅ [${validationId}] Promise-based validation resolved`);
          } else {
            log(`✅ [${validationId}] Synchronous validation completed`);
          }
          
          log(`✅ [${validationId}] Validation completed successfully`, {
            duration: Date.now() - validationStart,
            fields: validationFields
          });
        } catch (error) {
          log(`❌ [${validationId}] Validation failed`, { 
            fields: validationFields,
            error: {
              message: error.message,
              name: error.name,
              code: error.code,
              stack: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : 'No stack'
            }
          });
          throw error;
        }
      }
      
      log('🎉 All validations completed successfully');
      
      // Check for validation errors
      log('Checking for validation errors...');
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        const validationErrors = errors.array();
        log('❌ Validation failed', { validationErrors });
        const error = new AppError('Validation failed', 400);
        error.errors = validationErrors;
        return next(error);
      }
      
      log('✅ All validations completed successfully, proceeding to next middleware');
      
      log('✅ All validations passed, proceeding to next middleware');
      try {
        next();
      } catch (err) {
        log('❌ Error in next() call', {
          error: err.message,
          stack: err.stack
        });
        next(err);
      }
      
    } catch (error) {
      log('Error in validation middleware', { 
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        statusCode: error.statusCode
      });
      
      // Ensure we have a proper error status code
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      
      next(error);
    }
  };
};

// Validation rules
const userValidationRules = {
  /**
   * Validation rules for user registration
   */
  register: () => [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
      
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
      
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
      .matches(/[0-9]/).withMessage('Password must contain at least one number')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain at least one special character'),
      
    body('university')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('University name cannot be longer than 100 characters'),
      
    body('major')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Major cannot be longer than 100 characters'),
      
    body('year')
      .optional()
      .isIn(['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Other'])
      .withMessage('Invalid year value')
  ],

  /**
   * Validation rules for user login
   */
  login: () => [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
      
    body('password')
      .notEmpty().withMessage('Password is required')
  ],

  /**
   * Validation rules for updating user profile
   */
  updateProfile: () => [
    body('name')
      .optional()
      .trim()
      .notEmpty().withMessage('Name cannot be empty')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
      
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
      
    body('university')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('University name cannot be longer than 100 characters'),
      
    body('major')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Major cannot be longer than 100 characters'),
      
    body('year')
      .optional()
      .isIn(['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Other'])
      .withMessage('Invalid year value'),
      
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Bio cannot be longer than 500 characters')
  ],

  /**
   * Validation rules for changing password
   */
  changePassword: () => [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required'),
      
    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
      .matches(/[0-9]/).withMessage('New password must contain at least one number')
      .matches(/[a-z]/).withMessage('New password must contain at least one lowercase letter')
      .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter')
      .matches(/[^a-zA-Z0-9]/).withMessage('New password must contain at least one special character')
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error('New password must be different from current password');
        }
        return true;
      })
  ],

  /**
   * Validation rules for forgot password request
   */
  forgotPassword: () => [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail()
  ],

  /**
   * Validation rules for resetting password
   */
  resetPassword: () => [
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
      .matches(/[0-9]/).withMessage('Password must contain at least one number')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain at least one special character')
  ]
};

const groupValidationRules = {
  /**
   * Validation rules for creating a group
   */
  createGroup: () => {
    console.log('[VALIDATION] Creating group validation rules');
    
    const rules = [
      body('title')
        .trim()
        .notEmpty().withMessage('Group title is required')
        .isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters')
        .withMessage('Title validation failed'),
        
      body('description')
        .trim()
        .notEmpty().withMessage('Description is required')
        .isLength({ max: 1000 }).withMessage('Description cannot be longer than 1000 characters'),
        
      body('subject')
        .trim()
        .notEmpty().withMessage('Subject is required')
        .isLength({ max: 100 }).withMessage('Subject cannot be longer than 100 characters'),
        
      body('university')
        .trim()
        .notEmpty().withMessage('University is required')
        .isLength({ max: 100 }).withMessage('University name is too long')
    ];

    // Add optional fields with debug logging
    console.log('[VALIDATION] Adding optional fields validation');
    
    rules.push(
      body('level')
        .optional()
        .isIn(['beginner', 'intermediate', 'advanced'])
        .withMessage('Invalid level. Must be one of: beginner, intermediate, advanced')
    );
    
    rules.push(
      body('isPublic')
        .optional()
        .isBoolean().withMessage('isPublic must be a boolean value')
    );
    
    rules.push(
      body('tags')
        .optional()
        .isArray().withMessage('Tags must be an array')
        .custom((tags, { req }) => {
          console.log('[VALIDATION] Validating tags:', { tags });
          if (tags && tags.length > 10) {
            throw new Error('Cannot have more than 10 tags');
          }
          return true;
        })
    );
    
    console.log('[VALIDATION] Group validation rules created');
    return rules;
  },
  
  /**
   * Validation rules for updating a group
   */
  updateGroup: () => {
    console.log('[VALIDATION] Creating updateGroup validation rules');
    
    const createValidationLogger = (field) => 
      (value, { req, path, location, ...rest }) => {
        try {
          console.log(`[VALIDATION] Validating ${field}:`, {
            value,
            path,
            location,
            hasReq: !!req,
            hasBody: !!(req && req.body),
            bodyKeys: req && req.body ? Object.keys(req.body) : []
          });
          return Promise.resolve(true);
        } catch (error) {
          console.error(`[VALIDATION] Error in ${field} validation:`, error);
          return Promise.reject(new Error(`Validation error for ${field}`));
        }
      };
    
    const rules = [
      body('name')
        .optional()
        .trim()
        .notEmpty().withMessage('Name cannot be empty')
        .isLength({ min: 3, max: 50 }).withMessage('Group name must be between 3 and 50 characters')
        .escape()
        .custom(createValidationLogger('name')),
        
      body('description')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Description cannot be longer than 500 characters')
        .escape()
        .custom(createValidationLogger('description')),
        
      body('subject')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Subject cannot be longer than 100 characters')
        .escape()
        .custom(createValidationLogger('subject')),
        
      body('level')
        .optional()
        .trim()
        .isIn(['beginner', 'intermediate', 'advanced'])
        .withMessage('Invalid level. Must be one of: beginner, intermediate, advanced')
        .custom(createValidationLogger('level')),
        
      body('isPublic')
        .optional()
        .isBoolean()
        .withMessage('isPublic must be a boolean value')
        .custom(createValidationLogger('isPublic')),
        
      body('tags')
        .optional()
        .custom(createValidationLogger('tags'))
        .isArray({ min: 0, max: 10 })
        .withMessage('Tags must be an array with a maximum of 10 items')
        .customSanitizer((tags, { req }) => {
          console.log(`[${req.requestId}] [VALIDATION] Sanitizing tags:`, {
            input: tags,
            type: typeof tags,
            isArray: Array.isArray(tags),
            length: Array.isArray(tags) ? tags.length : 'N/A'
          });
          
          if (!Array.isArray(tags)) return [];
          
          // Ensure all tags are strings and trim them
          const sanitized = tags
            .map(tag => String(tag).trim())
            .filter(tag => tag.length > 0);
            
          console.log(`[${req.requestId}] [VALIDATION] Sanitized tags:`, sanitized);
          return sanitized;
        })
    ];
    
    console.log('[VALIDATION] Created updateGroup validation rules');
    return rules;
  },
  
  /**
   * Validation rules for adding a member to a group
   */
  addMember: () => [
    body('userId')
      .notEmpty().withMessage('User ID is required')
      .isMongoId().withMessage('Invalid user ID format'),
      
    body('role')
      .optional()
      .isIn(['member', 'moderator', 'admin'])
      .withMessage('Invalid role. Must be one of: member, moderator, admin')
  ],
  
  /**
   * Validation rules for joining a group
   */
  joinGroup: () => [
    // No body parameters needed for joining a public group
  ],
  
  /**
   * Validation rules for leaving a group
   */
  leaveGroup: () => [
    // No body parameters needed for leaving a group
  ]
};

const sessionValidationRules = {
  create: () => [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').optional(),
    body('startTime')
      .notEmpty()
      .withMessage('Start time is required')
      .isISO8601()
      .withMessage('Invalid start time format'),
    body('endTime')
      .notEmpty()
      .withMessage('End time is required')
      .isISO8601()
      .withMessage('Invalid end time format')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.startTime)) {
          throw new Error('End time must be after start time');
        }
        return true;
      }),
    body('maxParticipants')
      .optional()
      .isInt({ min: 2 })
      .withMessage('Maximum participants must be at least 2'),
  ],
  update: () => [
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional().notEmpty().withMessage('Description cannot be empty'),
    body('startTime')
      .optional()
      .isISO8601()
      .withMessage('Invalid start time format'),
    body('endTime')
      .optional()
      .isISO8601()
      .withMessage('Invalid end time format')
      .custom((value, { req }) => {
        if (req.body.startTime && new Date(value) <= new Date(req.body.startTime)) {
          throw new Error('End time must be after start time');
        }
        return true;
      }),
  ],
  rsvpToSession: () => [
    body('status')
      .notEmpty()
      .withMessage('Status is required')
      .isIn(['going', 'maybe', 'not-going'])
      .withMessage('Invalid RSVP status. Must be one of: going, maybe, not-going')
  ]
};

const messageValidationRules = {
  /**
   * Validation rules for getting messages
   */
  getMessages: () => [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
      
    query('before')
      .optional()
      .isISO8601()
      .withMessage('Invalid date format for before parameter')
  ],

  /**
   * Validation rules for sending a message
   */
  send: () => {
    console.log('[VALIDATION] Setting up message send validation rules');
    return [
      body('content')
        .custom((value, { req }) => {
          console.log('[VALIDATION] [1/3] Starting content field validation:', { 
            hasValue: !!value,
            valueLength: typeof value === 'string' ? value.length : 'not a string',
            requestId: req.requestId || 'unknown',
            timestamp: new Date().toISOString()
          });
          return true;
        })
        .notEmpty()
        .withMessage('Message content is required')
        .custom((value, { req }) => {
          console.log('[VALIDATION] [2/3] Content not empty check passed:', { 
            valueLength: value ? value.length : 0,
            requestId: req.requestId || 'unknown',
            timestamp: new Date().toISOString()
          });
          return true;
        })
        .isLength({ max: 2000 })
        .withMessage('Message cannot be longer than 2000 characters')
        .custom((value, { req }) => {
          console.log('[VALIDATION] [3/3] Content length validation passed:', { 
            requestId: req.requestId || 'unknown',
            valueLength: value ? value.length : 0,
            timestamp: new Date().toISOString()
          });
          return true;
        })
    ];
  },

  /**
   * Validation rules for reacting to a message
   */
  react: () => [
    body('reaction')
      .notEmpty()
      .withMessage('Reaction is required')
      .isIn([
        'like', 'love', 'laugh', 'wow', 'sad', 'angry',
        'thumbsup', 'thumbsdown', 'heart', 'fire', 'clap',
        'pray', 'rocket', 'eyes', 'thinking', 'tada', 'check'
      ])
      .withMessage('Invalid reaction type'),
  ],
  
  /**
   * Validation rules for updating a message
   */
  updateMessage: () => {
    console.log('Setting up updateMessage validation rules');
    return [
      // Content validation - make it required for updates
      body('content')
        .exists({ checkFalsy: true, checkNull: true })
        .withMessage('Message content is required')
        .isString()
        .withMessage('Content must be a string')
        .trim()
        .isLength({ min: 1, max: 2000 })
        .withMessage('Message must be between 1 and 2000 characters')
        .bail(),  // Stop validation if this fails
        
      // isPinned validation (optional)
      body('isPinned')
        .optional()
        .isBoolean()
        .withMessage('isPinned must be a boolean value')
        .bail()  // Stop validation if this fails
    ];
  },
  
  /**
   * Validation rules for reacting to a message
   */
  reactToMessage: () => [
    body('reaction')
      .notEmpty()
      .withMessage('Reaction is required')
      .isIn([
        'like', 'love', 'laugh', 'wow', 'sad', 'angry',
        'thumbsup', 'thumbsdown', 'heart', 'fire', 'clap',
        'pray', 'rocket', 'eyes', 'thinking', 'tada', 'check'
      ])
      .withMessage('Invalid reaction type')
  ],
};

const resourceValidationRules = {
  /**
   * Validation rules for getting resources
   */
  getResources: () => [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
      
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
      
    query('sort')
      .optional()
      .isIn(['newest', 'oldest', 'title'])
      .withMessage('Invalid sort option')
  ],

  /**
   * Validation rules for uploading a resource
   */
  uploadResource: () => [
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required')
      .isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
      
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Description cannot be longer than 1000 characters'),
      
    body('tags')
      .optional()
      .isArray().withMessage('Tags must be an array')
      .custom((tags) => {
        if (tags && tags.length > 10) {
          throw new Error('Cannot have more than 10 tags');
        }
        return true;
      })
  ],

  /**
   * Validation rules for updating a resource
   */
  updateResource: () => [
    body('title')
      .optional()
      .trim()
      .notEmpty().withMessage('Title cannot be empty')
      .isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
      
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Description cannot be longer than 1000 characters'),
      
    body('tags')
      .optional()
      .isArray().withMessage('Tags must be an array')
      .custom((tags) => {
        if (tags && tags.length > 10) {
          throw new Error('Cannot have more than 10 tags');
        }
        return true;
      })
  ],
  
  /**
   * Validation rules for uploading a new version of a resource
   */
  uploadNewVersion: () => [
    body('versionNotes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Version notes cannot be longer than 500 characters')
  ]
};

module.exports = {
  validate,
  userValidationRules,
  groupValidationRules,
  sessionValidationRules,
  messageValidationRules,
  resourceValidationRules,
};
