const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

/**
 * Async handler to wrap route handlers for better error handling
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Simple validation middleware
 */
const validate = (validations) => {
  console.log('[VALIDATE] Creating validation middleware');
  
  return async (req, res, next) => {
    const startTime = Date.now();
    const requestId = req.requestId || Math.random().toString(36).substr(2, 8);
    
    const log = (message, data = {}) => {
      const timestamp = Date.now() - startTime;
      console.log(`[VALIDATE:${requestId}][+${timestamp}ms] ${message}`, data);
    };
    
    log('Starting validation middleware', {
      path: req.path,
      method: req.method,
      validationCount: validations ? validations.length : 0
    });
    
    try {
      if (!validations || !Array.isArray(validations) || validations.length === 0) {
        log('No validations to run, proceeding to next middleware');
        return next();
      }
      
      log(`Running ${validations.length} validations`);
      
      // Run all validations with timing
      await Promise.all(validations.map(async (validation, index) => {
        const validationStart = Date.now();
        const validationId = `${index + 1}/${validations.length}`;
        
        try {
          log(`[${validationId}] Starting validation`, { 
            validation: validation.toString() 
          });
          
          if (typeof validation.run !== 'function') {
            throw new Error('Validation is not a valid express-validator middleware');
          }
          
          await validation.run(req);
          
          log(`[${validationId}] Validation completed`, {
            duration: Date.now() - validationStart,
            validation: validation.toString()
          });
        } catch (validationError) {
          log(`[${validationId}] Error in validation`, {
            error: validationError.message,
            stack: validationError.stack,
            duration: Date.now() - validationStart
          });
          throw validationError;
        }
      }));
      
      log('All validations completed, checking for errors');
      
      // Check for validation errors
      const errors = validationResult(req);
      
      if (errors.isEmpty()) {
        log('No validation errors found, proceeding to next middleware');
        return next();
      }
      
      // Format errors
      const formattedErrors = {};
      errors.array().forEach(({ param, msg, value }) => {
        if (!formattedErrors[param]) {
          formattedErrors[param] = [];
        }
        formattedErrors[param].push({
          message: msg,
          value: value
        });
      });
      
      log('Validation failed', { errors: formattedErrors });
      
      // Pass to error handler with 400 status
      return next(new AppError('Validation failed', 400, { 
        errors: formattedErrors,
        requestId
      }));
      
    } catch (error) {
      log('Unexpected error in validation middleware', {
        error: error.message,
        stack: error.stack,
        errorName: error.name,
        errorCode: error.code
      });
      
      // Handle any unexpected errors during validation
      return next(error);
    }
  };
};

/**
 * Simple request logger
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 8);
  const { method, originalUrl, body, query, params, headers } = req;
  
  // Store request ID for later use
  req.requestId = requestId;
  
  // Log request details with timing
  const log = (message, data = {}) => {
    const timestamp = Date.now() - startTime;
    console.log(`[REQ:${requestId}][+${timestamp}ms] ${message}`, data);
  };
  
  log('Request started', {
    method,
    url: originalUrl,
    timestamp: new Date().toISOString()
  });
  
  // Log request body if present and not too large
  if (Object.keys(body).length > 0) {
    log('Request body', { body });
  }
  
  // Log query parameters if present
  if (Object.keys(query).length > 0) {
    log('Query parameters', { query });
  }
  
  // Log URL parameters if present
  if (Object.keys(params).length > 0) {
    log('URL parameters', { params });
  }
  
  // Log headers (excluding sensitive ones)
  const { authorization, cookie, ...safeHeaders } = headers;
  log('Request headers', { 
    headers: safeHeaders,
    hasAuth: !!authorization,
    hasCookies: !!cookie
  });
  
  // Log response when it's finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    log('Request completed', {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  });
  
  // Log any errors that occur during request processing
  res.on('error', (error) => {
    log('Request error', {
      error: error.message,
      stack: error.stack,
      duration: `${Date.now() - startTime}ms`
    });
  });
  
  // Continue to next middleware
  next();
};

module.exports = {
  asyncHandler,
  validate,
  requestLogger
};
