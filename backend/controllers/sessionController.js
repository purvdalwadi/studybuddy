const { AppError } = require('../middleware/errorHandler');
const StudySession = require('../models/StudySession');
const StudyGroup = require('../models/StudyGroup');
const logger = require('../utils/logger');

// Helper for consistent logging
const log = (message, data) => {
  logger.info(`[SESSION] ${message}`, data || '');
};

// Helper to check group membership
const checkGroupMembership = async (groupId, userId) => {
  const group = await StudyGroup.findOne({
    _id: groupId,
    'members.user': userId,
  });

  if (!group) {
    throw new AppError('You are not a member of this group', 403);
  }
  return group;
};

// Helper to check session access
const checkSessionAccess = (session, userId, isAdmin = false) => {
  // Convert userId to string for comparison
  const userIdStr = userId.toString();
  
  const isAttendee = session.attendees.some(attendee => {
    // Handle both populated user objects and string IDs
    const attendeeUserId = attendee.user && attendee.user._id 
      ? attendee.user._id.toString() 
      : attendee.user.toString();
    return attendeeUserId === userIdStr;
  });
  
  if (!isAttendee && !isAdmin) {
    throw new AppError('Not authorized to access this session', 403);
  }
};

// @desc    Get all study sessions
// @route   GET /api/study-sessions
// @access  Private
exports.getSessions = async (req, res, next) => {
  try {
    // For non-admins, only return sessions they're attending
    if (req.user.role !== 'admin') {
      const sessions = await StudySession.find({
        'attendees.user': req.user.id,
      })
        .sort('-scheduledDate')
        .populate('groupId', 'title subject')
        .populate('createdBy', 'name avatar');

      return res.json({
        success: true,
        count: sessions.length,
        data: sessions,
      });
    }

    // For admins, use advanced query results
    res.json(res.advancedResults);
  } catch (error) {
    log('Error in getSessions:', error);
    next(error);
  }
};

// @desc    Get sessions by group
// @route   GET /api/groups/:groupId/study-sessions
// @access  Private
exports.getSessionsByGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    // Verify group membership
    await checkGroupMembership(groupId, req.user.id);

    const sessions = await StudySession.find({ groupId })
      .sort('-scheduledDate')
      .populate('createdBy', 'name avatar')
      .populate('attendees.user', 'name avatar');

    res.json({
      success: true,
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    log('Error in getSessionsByGroup:', error);
    next(error);
  }
};

// @desc    Get single session
// @route   GET /api/study-sessions/:id
// @access  Private
exports.getSession = async (req, res, next) => {
  try {
    const session = await StudySession.findById(req.params.id)
      .populate('groupId', 'title subject')
      .populate('createdBy', 'name avatar')
      .populate('attendees.user', 'name avatar');

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Check access
    checkSessionAccess(session, req.user.id, req.user.role === 'admin');

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    log('Error in getSession:', error);
    next(error);
  }
};

// @desc    Create session
// @route   POST /api/groups/:groupId/study-sessions
// @access  Private
exports.createSession = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    // Verify group membership
    await checkGroupMembership(groupId, req.user.id);

    // Create session
    const session = await StudySession.create({
      ...req.body,
      groupId,
      createdBy: req.user.id,
      attendees: [
        { user: req.user.id, rsvpStatus: 'going', role: 'host' },
      ],
    });

      // Populate the createdBy and attendees.user fields using Model.populate()
      const populatedSession = await StudySession.populate(session, [
        { path: 'createdBy', select: 'name avatar' },
        { path: 'attendees.user', select: 'name avatar' }
      ]);

    log(`Session created by user ${req.user.id} in group ${groupId}`, { sessionId: session._id });
    
    res.status(201).json({
      success: true,
      data: populatedSession,
    });
  } catch (error) {
    log('Error in createSession:', error);
    next(error);
  }
};

// @desc    Update session
// @route   PUT /api/study-sessions/:id
// @access  Private
exports.updateSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    
    // Find session
    const session = await StudySession.findById(id);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Check permissions
    if (session.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('Not authorized to update this session', 403);
    }

    // Validate session status
    if (['completed', 'cancelled'].includes(session.status)) {
      throw new AppError(`Cannot update a ${session.status} session`, 400);
    }

    // Prevent changing restricted fields
    const restrictedUpdates = ['createdBy', 'groupId'];
    const isValidUpdate = Object.keys(updates).every(
      update => !restrictedUpdates.includes(update)
    );

    if (!isValidUpdate) {
      throw new AppError('Invalid updates', 400);
    }

    // Update session
    const updatedSession = await StudySession.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('createdBy', 'name avatar')
      .populate('attendees.user', 'name avatar');

    log(`Session ${id} updated by user ${req.user.id}`, { updates });
    
    res.json({
      success: true,
      data: updatedSession,
    });
  } catch (error) {
    log('Error in updateSession:', error);
    next(error);
  }
};

// @desc    Delete session
// @route   DELETE /api/study-sessions/:id
// @access  Private
exports.deleteSession = async (req, res, next) => {
  try {
    const session = await StudySession.findById(req.params.id);

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Check permissions
    if (session.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('Not authorized to delete this session', 403);
    }

    await StudySession.deleteOne({ _id: session._id });
    log(`Session ${session._id} deleted by user ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      data: {},
      message: 'Session deleted successfully'
    });
  } catch (error) {
    log('Error in deleteSession:', error);
    next(error);
  }
};

// @desc    RSVP to a session
// @route   PUT /api/study-sessions/:id/rsvp
// @access  Private
exports.rsvpToSession = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['going', 'maybe', 'not-going'];

    if (!validStatuses.includes(status)) {
      throw new AppError(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        400
      );
    }

    const session = await StudySession.findById(req.params.id);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Check group membership
    await checkGroupMembership(session.groupId, req.user.id);

    // Check session status
    if (['completed', 'cancelled'].includes(session.status)) {
      throw new AppError(`Cannot RSVP to a ${session.status} session`, 400);
    }

    // First, remove any duplicate entries for the current user
    const uniqueAttendees = [];
    const seenUsers = new Set();
    
    // Process attendees in reverse to keep the most recent entry
    for (let i = session.attendees.length - 1; i >= 0; i--) {
      const attendee = session.attendees[i];
      const userId = attendee.user.toString();
      
      if (!seenUsers.has(userId)) {
        seenUsers.add(userId);
        // Add to the beginning to maintain reverse chronological order
        uniqueAttendees.unshift(attendee);
      }
    }
    
    // Replace the attendees array with the deduplicated one
    session.attendees = uniqueAttendees;

    // Find the attendee index for the current user
    const attendeeIndex = session.attendees.findIndex(
      attendee => attendee.user.toString() === req.user.id
    );

    if (attendeeIndex === -1) {
      // Add new attendee
      session.attendees.push({
        user: req.user.id,
        rsvpStatus: status,
        joinedAt: new Date()
      });
    } else {
      // Update existing attendee's status
      session.attendees[attendeeIndex].rsvpStatus = status;
      session.attendees[attendeeIndex].updatedAt = new Date();
    }

    await session.save();
    
    // Populate the createdBy and attendees.user fields using Model.populate()
    const populatedSession = await StudySession.populate(session, [
      { path: 'createdBy', select: 'name avatar' },
      { path: 'attendees.user', select: 'name avatar' }
    ]);

    log(`User ${req.user.id} updated RSVP to "${status}" for session ${session._id}`);
    
    res.json({
      success: true,
      data: populatedSession,
    });
  } catch (error) {
    log('Error in rsvpToSession:', error);
    next(error);
  }
};

// @desc    Get upcoming sessions
// @route   GET /api/study-sessions/upcoming
// @access  Private
exports.getUpcomingSessions = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;

    const sessions = await StudySession.find({
      'attendees.user': req.user.id,
      status: 'scheduled',
      scheduledDate: { $gte: new Date() },
    })
      .sort('scheduledDate')
      .limit(limit)
      .populate('groupId', 'title')
      .populate('createdBy', 'name avatar');

    res.json({
      success: true,
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    log('Error in getUpcomingSessions:', error);
    next(error);
  }
};

// @desc    Get sessions by date range
// @route   GET /api/study-sessions/date-range
// @access  Private
exports.getSessionsByDateRange = async (req, res, next) => {
  try {
    const { startDate, endDate, groupId, status } = req.query;
    
    // Validate date range (max 90 days)
    const start = new Date(startDate);
    const end = new Date(endDate || startDate);
    
    if (isNaN(start.getTime())) {
      return next(new AppError('Please provide a valid start date', 400));
    }
    
    // If no end date provided, default to 7 days from start
    if (!endDate) {
      end.setDate(start.getDate() + 7);
    }
    
    // Ensure the date range is not too large (max 90 days)
    const maxDays = 90;
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > maxDays) {
      return next(new AppError(`Date range cannot exceed ${maxDays} days`, 400));
    }
    
    // Build the base query
    const query = {
      'attendees.user': req.user.id,
      scheduledDate: { $gte: start, $lte: end }
    };
    
    // Add group filter if provided
    if (groupId) {
      // Verify user is a member of the group
      const isMember = await StudyGroup.exists({
        _id: groupId,
        'members.user': req.user.id
      });
      
      if (!isMember) {
        return next(new AppError('Not authorized to view sessions for this group', 403));
      }
      
      query.groupId = groupId;
    }
    
    // Add status filter if provided
    if (status) {
      query.status = status;
    }
    
    // Execute the query
    const sessions = await StudySession.find(query)
      .sort('scheduledDate')
      .populate('groupId', 'title subject')
      .populate('createdBy', 'name avatar')
      .populate('attendees.user', 'name avatar');
    
    res.json({
      success: true,
      count: sessions.length,
      startDate: start,
      endDate: end,
      data: sessions
    });
  } catch (error) {
    log('Error in getSessionsByDateRange:', error);
    next(error);
  }
};
