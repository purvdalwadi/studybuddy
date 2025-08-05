const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyGroup',
      required: [true, 'Please add a group ID'],
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please add a sender ID'],
    },
    content: {
      type: String,
      required: [true, 'Please add message content'],
      maxlength: [1000, 'Message cannot be more than 1000 characters'],
      trim: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'file', 'image'],
      default: 'text',
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    fileName: {
      type: String,
      trim: true,
    },
    fileType: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered'],
      default: 'sent'
    },
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        reaction: {
          type: String,
          required: true,
          trim: true,
        },
        _id: false,
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    isPinned: {
      type: Boolean,
      default: false,
    },

  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add index for better query performance
messageSchema.index({ groupId: 1, createdAt: -1 });

// Add text index for search functionality
messageSchema.index(
  { content: 'text' },
  { weights: { content: 3 } }
);

// Virtual for populating the sender
messageSchema.virtual('senderInfo', {
  ref: 'User',
  localField: 'sender',
  foreignField: '_id',
  justOne: true,
  select: 'name avatar email',
});

// Virtual for populating the replyTo message
messageSchema.virtual('replyToMessage', {
  ref: 'Message',
  localField: 'replyTo',
  foreignField: '_id',
  justOne: true,
  select: 'content sender',
});

// Method to add a reaction
messageSchema.methods.addReaction = async function (userId, reaction) {
  // Check if the user already reacted with the same reaction
  const reactionIndex = this.reactions.findIndex(
    (r) => r.user.toString() === userId.toString() && r.reaction === reaction
  );

  if (reactionIndex >= 0) {
    // Remove the reaction if it's the same
    this.reactions.splice(reactionIndex, 1);
  } else {
    // Check if user already has a reaction
    const userReactionIndex = this.reactions.findIndex(
      (r) => r.user.toString() === userId.toString()
    );

    if (userReactionIndex >= 0) {
      // Update existing reaction
      this.reactions[userReactionIndex].reaction = reaction;
    } else {
      // Add new reaction
      this.reactions.push({ user: userId, reaction });
    }
  }

  await this.save();
  return this;
};

// Static method to search messages in a group
messageSchema.statics.searchInGroup = async function (groupId, searchTerm, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  return this.find({
    groupId,
    $text: { $search: searchTerm },
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'name avatar')
    .populate('replyTo', 'content sender');
};

module.exports = mongoose.model('Message', messageSchema);
