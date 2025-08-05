const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Set mongoose options
mongoose.set('strictQuery', true);

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studybuddy';
    logger.info(`Connecting to MongoDB at: ${mongoUri.replace(/:([^:]+)@/, ':***@')}`);
    
    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 5000,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 10000,
      family: 4,
      retryWrites: true,
      retryReads: true
    };
    
    // Log connection attempt details
    logger.info('Attempting to connect to MongoDB...');
    logger.debug(`Connection URI: ${mongoUri}`);
    logger.debug(`Connection options: ${JSON.stringify(options)}`);
    
    // Test MongoDB connection first
    try {
      const testConn = await mongoose.createConnection(mongoUri, options).asPromise();
      await testConn.db.command({ ping: 1 });
      logger.info('MongoDB connection test successful');
      await testConn.close();
    } catch (testError) {
      logger.error('MongoDB connection test failed:', testError);
      throw testError;
    }
    
    // Proceed with main connection
    const conn = await mongoose.connect(mongoUri, options);
    
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    logger.info(`Database name: ${conn.connection.name}`);
    logger.info(`MongoDB version: ${conn.connection.version}`);
    logger.info(`MongoDB connection pool size: ${conn.connection.maxPoolSize}`);
    
    // Verify the connection
    await conn.connection.db.command({ ping: 1 });
    logger.info('MongoDB connection verified');
    
    return conn;
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
    // Exit process with failure
    process.exit(1);
  }
};

// Handle MongoDB connection events
mongoose.connection.on('connecting', () => {
  logger.info('Connecting to MongoDB...');
});

mongoose.connection.on('connected', () => {
  logger.info('MongoDB connected successfully');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB connection error: ${err.message}`);
});

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    logger.error(`Error closing MongoDB connection: ${err.message}`);
    process.exit(1);
  }
});

module.exports = connectDB;
