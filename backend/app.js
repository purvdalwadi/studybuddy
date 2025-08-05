const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const path = require('path');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const timeout = require('./middleware/timeout');

// Load environment variables
require('dotenv').config();

// Import routes
const auth = require('./routes/auth');
const users = require('./routes/users');
const groups = require('./routes/groups');
const messages = require('./routes/messages');
const sessions = require('./routes/sessions');
const resources = require('./routes/resources');

// Initialize express app
const app = express();

// Set security headers
app.use(helmet());

// Enable CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parser
app.use(cookieParser());

// Data sanitization against XSS
app.use(xss());

// Sanitize data
app.use(mongoSanitize());

// Set request timeout (10 seconds)
app.use(timeout(10000));

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Mount routers
app.use('/api/v1/auth', auth);
app.use('/api/v1/users', users);
app.use('/api/v1/groups', groups);
app.use('/api/v1/messages', messages);
// Support both /sessions and /study-sessions for backward compatibility
app.use('/api/v1/study-sessions', sessions);
app.use('/api/v1/sessions', sessions);
app.use('/api/v1/resources', resources);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware - only use in non-test environments
if (process.env.NODE_ENV !== 'test') {
  app.use(errorHandler);

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    logger.error(`Error: ${err.message}`);
    // Close server & exit process
    // server.close(() => process.exit(1));
  });
}

// Simple error handler for test environment
if (process.env.NODE_ENV === 'test') {
  app.use((err, req, res, next) => {
    console.error('Error in test environment:', err);
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || 'Server Error'
    });
  });
}

module.exports = app;
