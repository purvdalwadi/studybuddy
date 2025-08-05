// Custom error class for operational errors
class AppError extends Error {
  constructor(message, statusCode, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle different types of errors
const handleErrors = (err) => {
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return new AppError('Invalid token. Please log in again!', 401);
  }
  
  // Handle token expiration
  if (err.name === 'TokenExpiredError') {
    return new AppError('Your token has expired! Please log in again.', 401);
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(el => el.message);
    return new AppError(`Validation failed: ${errors.join('. ')}`, 400);
  }
  
  // Handle duplicate field errors
  if (err.code === 11000) {
    const value = err.errmsg.match(/(["'])(\?.)*?\1/)[0];
    return new AppError(`Duplicate field value: ${value}. Please use another value!`, 400);
  }
  
  // Handle cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  }
  
  return err;
};

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  let error = { ...err };
  error.message = err.message;
  
  // Handle errors in development vs production
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
      ...(err.details && { details: err.details })
    });
  } else {
    // In production, don't leak error details
    const processedError = handleErrors(error);
    
    if (processedError.isOperational) {
      res.status(processedError.statusCode).json({
        status: processedError.status,
        message: processedError.message,
        ...(processedError.details && { details: processedError.details })
      });
    } else {
      console.error('ERROR ', err);
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
      });
    }
  }
};

// 404 Not Found handler
const notFound = (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
};

module.exports = {
  AppError,
  errorHandler,
  notFound
};
