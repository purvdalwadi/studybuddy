const mongoose = require('mongoose');

// Custom validator to ensure unique attendees
const uniqueAttendeesValidator = function(attendees) {
  const userIds = new Set();
  for (const attendee of attendees) {
    const userId = attendee.user && attendee.user.toString();
    if (userIds.has(userId)) {
      return false; // Duplicate user found
    }
    userIds.add(userId);
  }
  return true;
};

const studySessionSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyGroup',
      required: [true, 'Please add a group ID'],
    },
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot be more than 1000 characters'],
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Please add a scheduled date'],
    },
    duration: {
      type: Number,
      required: [true, 'Please add duration in minutes'],
      min: [30, 'Minimum duration is 30 minutes'],
      max: [480, 'Maximum duration is 8 hours (480 minutes)'],
    },
    location: {
      type: String,
      trim: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    meetingLink: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    attendees: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        rsvpStatus: {
          type: String,
          enum: ['going', 'maybe', 'not-going'],
          default: 'not-going',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    notes: {
      type: String,
      maxlength: [5000, 'Notes cannot be more than 5000 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add validation for unique attendees
studySessionSchema.path('attendees').validate({
  validator: uniqueAttendeesValidator,
  message: 'Each user can only be added to a session once',
  type: 'uniqueAttendees'
});

// Add creator as attendee when creating a session if not already added
studySessionSchema.pre('save', function (next) {
  if (this.isNew) {
    // Check if creator is already in attendees
    const creatorAlreadyAdded = this.attendees.some(
      attendee => attendee.user && attendee.user.toString() === this.createdBy.toString()
    );
    
    if (!creatorAlreadyAdded) {
      this.attendees.push({
        user: this.createdBy,
        rsvpStatus: 'going',
        joinedAt: new Date()
      });
    }
  }
  next();
});

// Add index for better query performance
studySessionSchema.index({ groupId: 1, scheduledDate: -1 });
studySessionSchema.index({ scheduledDate: 1 });

// Virtual for end time
studySessionSchema.virtual('endTime').get(function () {
  if (!this.scheduledDate || !this.duration) return null;
  return new Date(this.scheduledDate.getTime() + this.duration * 60000);
});

// Check if session is upcoming
studySessionSchema.virtual('isUpcoming').get(function () {
  if (!this.scheduledDate) return false;
  return this.scheduledDate > new Date() && this.status === 'scheduled';
});

// Check if session is in progress
studySessionSchema.virtual('isInProgress').get(function () {
  if (!this.scheduledDate || !this.duration) return false;
  const now = new Date();
  const endTime = new Date(this.scheduledDate.getTime() + this.duration * 60000);
  return (
    this.status === 'ongoing' ||
    (now >= this.scheduledDate && now <= endTime && this.status !== 'cancelled')
  );
});

// Static method to get upcoming sessions for a user
studySessionSchema.statics.getUpcomingSessions = async function (userId, limit = 5) {
  return this.find({
    'attendees.user': userId,
    status: 'scheduled',
    scheduledDate: { $gte: new Date() },
  })
    .sort({ scheduledDate: 1 })
    .limit(limit)
    .populate('groupId', 'title')
    .populate('createdBy', 'name avatar');
};

// Method to check if a user is an attendee
studySessionSchema.methods.isAttendee = function (userId) {
  return this.attendees.some(
    (attendee) => attendee.user.toString() === userId.toString()
  );
};

// Method to get RSVP status for a user
studySessionSchema.methods.getUserRsvp = function (userId) {
  const attendee = this.attendees.find(
    (a) => a.user.toString() === userId.toString()
  );
  return attendee ? attendee.rsvpStatus : null;
};

module.exports = mongoose.model('StudySession', studySessionSchema);
