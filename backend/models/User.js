const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');

/**
 * User Schema Definition
 * Defines the structure and validation for user documents
 */
const userSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email'],
      index: true, // Single index definition here
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false,
    },
    
    // Academic Information
    university: {
      type: String,
      required: [true, 'Please provide your university'],
      trim: true,
    },
    major: {
      type: String,
      required: [true, 'Please provide your major'],
      trim: true,
    },
    year: {
      type: String,
      enum: {
        values: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Other'],
        message: 'Please select a valid academic year',
      },
      required: [true, 'Please provide your academic year'],
    },
    
    // Profile Information
    avatar: {
      url: {
        type: String,
        default: 'https://res.cloudinary.com/demo/image/upload/v1624395234/default-avatar.png',
      },
      publicId: {
        type: String,
        default: null,
      },
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: '',
    },
    
    // Account Information
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    
    // References
    joinedGroups: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyGroup',
    }],
    
    // Security
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtuals
userSchema.virtual('studySessions', {
  ref: 'StudySession',
  localField: '_id',
  foreignField: 'attendees.user',
  justOne: false,
});

userSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'sender',
  justOne: false,
});

// Document Methods
userSchema.methods.generateAuthToken = function() {
  const payload = {
    id: this._id,
    role: this.role,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
    
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

userSchema.methods.isValidVerificationToken = function(token) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
    
  return (
    this.emailVerificationToken === hashedToken &&
    this.emailVerificationExpires > Date.now()
  );
};

userSchema.methods.verifyEmail = function() {
  this.isVerified = true;
  this.emailVerificationToken = undefined;
  this.emailVerificationExpires = undefined;
};

// Pre-save Middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    // Update passwordChangedAt if not new user
    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000; // Ensure token is created after
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('password')) {
    this.updatedAt = new Date();
  }
  next();
});

// Cascade delete user's data when user is deleted
userSchema.pre('remove', async function(next) {
  await this.model('StudyGroup').updateMany(
    { members: { $elemMatch: { user: this._id } } },
    { $pull: { members: { user: this._id } } }
  );
  
  await this.model('StudySession').updateMany(
    { 'attendees.user': this._id },
    { $pull: { attendees: { user: this._id } } }
  );
  
  next();
});

// Create index for joinedGroups for better query performance
userSchema.index({ 'joinedGroups': 1 });

// Filter out inactive users by default
userSchema.pre(/^find/, function(next) {
  // Only include active users unless explicitly told not to
  if (this.getQuery().includeInactive !== true) {
    this.find({ isActive: { $ne: false } });
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
