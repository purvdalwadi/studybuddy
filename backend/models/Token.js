const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  token: {
    type: String,
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['passwordReset', 'emailVerification', 'refresh', 'access'],
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours default
    index: { expires: '1d' },
  },
  used: {
    type: Boolean,
    default: false,
  },
  blacklisted: {
    type: Boolean,
    default: false,
  },
  ipAddress: String,
  userAgent: String,
}, {
  timestamps: true,
});

// Indexes
tokenSchema.index({ token: 1, type: 1 }, { unique: true });

/**
 * Check if token is blacklisted
 */
tokenSchema.statics.isBlacklisted = async function(token) {
  const tokenDoc = await this.findOne({ 
    token, 
    $or: [
      { blacklisted: true },
      { used: true },
      { expiresAt: { $lt: new Date() } }
    ]
  });
  return !!tokenDoc;
};

/**
 * Blacklist a token
 */
tokenSchema.statics.blacklist = async function(token, userId) {
  const query = { token };
  if (userId) {
    query.userId = userId;
  }
  
  await this.updateMany(
    query,
    { 
      $set: { 
        blacklisted: true,
        used: true,
        expiresAt: new Date()
      } 
    },
    { upsert: true }
  );
  
  return true;
};

/**
 * Blacklist all tokens for a user (for logout all devices)
 */
tokenSchema.statics.blacklistAllForUser = async function(userId) {
  await this.updateMany(
    { userId, type: 'access' },
    { 
      $set: { 
        blacklisted: true,
        used: true,
        expiresAt: new Date()
      } 
    }
  );
  
  return true;
};

/**
 * Save token to database
 */
tokenSchema.statics.saveToken = async function(token, userId, type, req) {
  const tokenDoc = await this.create({
    token,
    userId,
    type,
    expiresAt: new Date(Date.now() + (type === 'refresh' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)),
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.headers['user-agent']
  });
  
  return tokenDoc;
};

/**
 * Mark token as used
 */
tokenSchema.methods.markAsUsed = async function() {
  this.used = true;
  await this.save();
  return this;
};

// Add method to check if token is expired
tokenSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Create and export the Token model
const Token = mongoose.model('Token', tokenSchema);
module.exports = Token;

module.exports = mongoose.model('Token', tokenSchema);
