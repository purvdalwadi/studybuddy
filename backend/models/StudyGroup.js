const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Schema definition
const studyGroupSchema = new mongoose.Schema({
  // Basic Info
  title: {
    type: String,
    required: [true, 'Please provide a group title'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  subject: {
    type: String,
    required: [true, 'Please provide a subject'],
    trim: true
  },
  university: {
    type: String,
    required: [true, 'Please specify the university'],
    trim: true,
    index: true
  },
  
  // Group Details
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  difficulty: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    set: function(val) {
      // Ensure consistent capitalization
      if (val) {
        return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
      }
      return val;
    }
  },
  // Legacy support for 'level' field
  level: {
    type: String,
    select: false, // Don't include in query results by default
    set: function(val) {
      // Keep in sync with difficulty
      if (val) {
        this.difficulty = val;
      }
      return val;
    }
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Settings
  maxMembers: {
    type: Number,
    min: [2, 'Minimum group size is 2'],
    max: [50, 'Maximum group size is 50'],
    default: 10
  },
  isActive: {
    type: Boolean,
    default: true
  },
  avatar: {
    type: String,
    default: 'group-default.jpg'
  },
  avatarPublicId: {
    type: String,
    default: null
  },
  
  // References
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Group must have a creator'],
    index: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: { type: Date, default: Date.now },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    }
  }],
  
  meetingSchedule: { type: String, trim: true }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
studyGroupSchema.virtual('studySessions', {
  ref: 'StudySession',
  localField: '_id',
  foreignField: 'groupId',
  justOne: false,
  options: { sort: { scheduledDate: -1 } }
});

studyGroupSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'groupId',
  justOne: false,
  options: { sort: { createdAt: -1 } }
});

studyGroupSchema.virtual('resources', {
  ref: 'Resource',
  localField: '_id',
  foreignField: 'groupId',
  justOne: false,
  options: { sort: { createdAt: -1 } }
});

// Indexes
studyGroupSchema.index({ title: 'text', description: 'text', subject: 'text' });
studyGroupSchema.index({ university: 1, subject: 1 });
studyGroupSchema.index({ 'members.user': 1 });

// Document Methods
studyGroupSchema.methods.addMember = async function(userId, role = 'member') {
  if (this.members.some(m => m.user.toString() === userId.toString())) {
    throw new Error('User is already a member');
  }
  
  if (this.members.length >= this.maxMembers) {
    throw new Error('Group is full');
  }
  
  this.members.push({ user: userId, role });
  return this.save();
};

studyGroupSchema.methods.removeMember = function(userId) {
  const initialLength = this.members.length;
  this.members = this.members.filter(m => m.user.toString() !== userId.toString());
  
  if (this.members.length === initialLength) {
    throw new Error('User not found in group');
  }
  
  return this.save();
};

studyGroupSchema.methods.isAdmin = function(userId) {
  return this.members.some(m => 
    m.user.toString() === userId.toString() && m.role === 'admin'
  );
};

// Static Methods
studyGroupSchema.statics.createWithCreator = async function(groupData, creatorId) {
  try {
    logger.info('Creating group with data:', { 
      ...groupData, 
      creatorId,
      hasDifficulty: !!groupData.difficulty,
      hasLevel: !!groupData.level
    });

    // Ensure we have a valid difficulty
    const validDifficulties = ['Beginner', 'Intermediate', 'Advanced'];
    let difficulty = groupData.difficulty || groupData.level || 'Beginner';
    
    // Ensure proper capitalization
    difficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
    if (!validDifficulties.includes(difficulty)) {
      difficulty = 'Beginner';
    }

    const members = groupData.members || [];
    const creatorExists = members.some(m => 
      m.user && m.user.toString() === creatorId.toString()
    );
    
    if (!creatorExists) {
      members.push({ user: creatorId, role: 'admin' });
    }
    
    // Create the group with the processed data
    const group = new this({ 
      ...groupData,
      difficulty,  // Use the processed difficulty
      level: difficulty, // Keep in sync for legacy support
      creator: creatorId, 
      members, 
      isActive: true 
    });

    logger.info('Saving group with final data:', { 
      difficulty: group.difficulty,
      level: group.level,
      creator: group.creator,
      memberCount: group.members.length
    });
    
    const savedGroup = await group.save();
    
    logger.info('Group saved successfully:', { 
      groupId: savedGroup._id,
      difficulty: savedGroup.difficulty
    });
    
    const populatedGroup = await savedGroup.populate([
      { path: 'creator', select: 'name email avatar' },
      { path: 'members.user', select: 'name email role' }
    ]);

    logger.info('Group populated successfully');
    return populatedGroup;
    
  } catch (error) {
    logger.error('Error creating group', { 
      error: error.message, 
      stack: error.stack,
      creatorId,
      groupData: {
        ...groupData,
        creatorId: undefined,
        members: groupData?.members?.length || 0
      }
    });
    throw error;
  }
};

// Hooks
studyGroupSchema.post('remove', async function(doc) {
  try {
    const [sessions, messages, resources] = await Promise.all([
      mongoose.model('StudySession').deleteMany({ groupId: doc._id }),
      mongoose.model('Message').deleteMany({ groupId: doc._id }),
      mongoose.model('Resource').deleteMany({ groupId: doc._id })
    ]);
    logger.info(`Cleaned up group ${doc._id} resources`, {
      sessions: sessions.deletedCount,
      messages: messages.deletedCount,
      resources: resources.deletedCount
    });
  } catch (error) {
    logger.error(`Error cleaning up group ${doc._id}`, { error: error.message });
  }
});

studyGroupSchema.pre(/^find/, function(next) {
  if (this.getQuery().includeInactive !== true) {
    this.find({ isActive: { $ne: false } });
  }
  this.populate({ path: 'members.user', select: 'name email avatar' });
  next();
});

const StudyGroup = mongoose.model('StudyGroup', studyGroupSchema);
module.exports = StudyGroup;
