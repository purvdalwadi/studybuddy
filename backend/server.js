require('dotenv').config();

// Core dependencies
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const socketio = require('socket.io');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');

// Custom modules
const { errorHandler, notFound } = require('./middleware/errorHandler');
const connectDB = require('./config/db');
const logger = require('./utils/logger');

// Set default environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || 5050;
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/studybuddy';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Initialize Express
const app = express();
const httpServer = http.createServer(app);

// ======================
// 1. Database Connection
// ======================
const startServer = async () => {
  try {
    await connectDB();
    logger.info('MongoDB connected successfully');

    // Start server
    const PORT = process.env.PORT;
    const HOST = '0.0.0.0'; // Bind to all network interfaces
    
    httpServer.listen(PORT, HOST, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on ${HOST}:${PORT}`);
      console.log(`Server running at http://${HOST}:${PORT}`);
      
      // Log network interfaces for debugging
      const os = require('os');
      const ifaces = os.networkInterfaces();
      
      logger.info('Network Interfaces:');
      Object.keys(ifaces).forEach(ifname => {
        ifaces[ifname].forEach(iface => {
          if ('IPv4' === iface.family && !iface.internal) {
            logger.info(`- ${ifname}: ${iface.address}`);
          }
        });
      });
    });
    
    // Log server errors
    httpServer.on('error', (error) => {
      logger.error('Server error:', error);
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      }
    });
  } catch (error) {
    logger.error(`Server startup error: ${error.message}`);
    process.exit(1);
  }
};

// ======================
// 2. Middleware
// ======================

// Request ID and logging
app.use((req, res, next) => {
  req.id = uuidv4();
  req.requestTime = new Date().toISOString();
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Security headers
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.API_RATE_LIMIT || 100,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.'
  }
});
app.use('/api/', (req, res, next) => {
  if (req.path === '/v1/auth/me') return next();
  return apiLimiter(req, res, next);
});

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser(process.env.JWT_SECRET));

// Data sanitization
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Compression
app.use(compression());

// ======================
// 3. Socket.io Setup
// ======================
const io = socketio(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const connectedUsers = {};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('setup', (userId) => {
    socket.userId = userId;
    connectedUsers[userId] = socket.id;
  });

  socket.on('joinGroup', (groupId) => {
    socket.join(`group_${groupId}`);
  });

  socket.on('leaveGroup', (groupId) => {
    socket.leave(`group_${groupId}`);
  });

  socket.on('sendMessage', (data) => {
    io.to(`group_${data.groupId}`).emit('newMessage', data);
  });

  socket.on('typing', (data) => {
    socket.broadcast.to(`group_${data.groupId}`).emit('userTyping', data);
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      delete connectedUsers[socket.userId];
    }
  });
});

// Make io accessible in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ======================
// 4. Routes
// ======================
// API Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/groups', require('./routes/groups'));
app.use('/api/v1/study-sessions', require('./routes/sessions'));
app.use('/api/v1/resources', require('./routes/resources'));
app.use('/api/v1/messages', require('./routes/messages'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Welcome to the StudyBuddy API',
    version: '1.0.0',
    docs: `${req.protocol}://${req.get('host')}/api-docs`
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/build');
  
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(frontendPath, 'index.html'));
    });
  }
}

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  httpServer.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;
