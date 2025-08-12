const mongoose = require('mongoose');
const { AppError } = require('../middleware/errorHandler');
const StudySession = require('../models/StudySession');
const StudyGroup = require('../models/StudyGroup');
const logger = require('../utils/logger');
const { 
  hasSchedulingConflict, 
  balanceSessionAssignments, 
  validateSessionTime 
} = require('../utils/sessionDistribution');

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
    // For admins, use advanced query results with all sessions
    if (req.user.role === 'admin') {
      return res.json(res.advancedResults);
    }

    // For regular users, get their group memberships
    const userGroups = await StudyGroup.find({
      'members.user': req.user.id,
      'members.status': 'active'
    }).select('_id');
    
    const groupIds = userGroups.map(g => g._id);
    
    // Find sessions where:
    // 1. User is an attendee, OR
    // 2. Session is from a group the user is a member of
    const sessions = await StudySession.find({
      $or: [
        { 'attendees.user': req.user.id },
        { groupId: { $in: groupIds } }
      ]
    })
      .sort('-scheduledDate')
      .populate('groupId', 'title subject')
      .populate('createdBy', 'name avatar')
      .populate('attendees.user', 'name avatar');

    res.json({
      success: true,
      count: sessions.length,
      data: sessions,
    });
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
  const isProduction = process.env.NODE_ENV === 'production';
  let session = null;
  
  if (isProduction) {
    session = await mongoose.startSession();
    await session.startTransaction();
  }
  
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    const { scheduledDate, duration, autoAssign = false } = req.body;
    
    // Validate required fields
    if (!scheduledDate || !duration) {
      throw new AppError('Scheduled date and duration are required', 400);
    }

    // Check if user is a member of the group
    const group = await StudyGroup.findById(groupId)
      .populate('members.user', '_id name email')
      .session(session || null);
      
    if (!group) {
      throw new AppError('Group not found', 404);
    }
    
    console.log('Group members after population:', group.members);

    // Debug logging for 403 error
    console.log('User ID from token:', userId);
    console.log('Group members:', group.members.map(m => ({
      userId: m.user.toString(),
      isMatch: m.user.toString() === userId
    })));
    console.log('User role:', req.user.role);
    
    // Debug membership check with enhanced logging
    console.log('\n=== Enhanced Membership Check ===');
    console.log('Current user ID (from token):', userId);
    console.log('User role in request:', req.user.role);
    
    // Log detailed member information
    console.log('\nGroup Members:');
    group.members.forEach((m, i) => {
      const memberId = m.user?._id?.toString() || m.user?.toString() || 'Invalid ID';
      const isCurrentUser = memberId === userId;
      console.log(`  Member ${i + 1}:`, {
        memberId,
        isCurrentUser,
        role: m.role,
        rawUser: m.user,
        rawMember: m
      });
    });
    
    // Verify user is a group member or admin
    const isMember = group.members.some(member => {
      // Handle all possible member reference formats
      let memberId;
      
      // Case 1: Fully populated member object
      if (member.user?._id) {
        memberId = member.user._id.toString();
      } 
      // Case 2: Member with unpopulated user reference
      else if (member.user) {
        memberId = member.user.toString();
      }
      // Case 3: Direct member ID (shouldn't happen with proper population)
      else if (member._id) {
        memberId = member._id.toString();
      }
      // Case 4: Direct string ID (last resort)
      else {
        memberId = member.toString();
      }
      
      const isMatch = memberId === userId;
      
      console.log('Membership check:', {
        memberId,
        userId,
        isMatch,
        memberType: typeof member,
        userType: typeof member.user
      });
      
      return isMatch;
    });
    
    console.log('\nMembership Check Result:', {
      isMember,
      isAdmin: req.user.role === 'admin',
      hasPermission: isMember || req.user.role === 'admin'
    });
    
    if (!isMember && req.user.role !== 'admin') {
      console.log('403 Error - User is not a member and not an admin');
      console.log('User ID from token:', userId);
      console.log('Group members:', group.members);
      throw new AppError('Not authorized to create sessions for this group. You must be a member of the group.', 403);
    }

    // Check for scheduling conflicts with detailed logging
    console.log('\n=== Checking for scheduling conflicts ===');
    console.log('User ID:', userId);
    const proposedStart = new Date(scheduledDate);
    const proposedEnd = new Date(proposedStart.getTime() + (duration * 60000));
    
    console.log('Proposed session:', {
      start: proposedStart.toISOString(),
      end: proposedEnd.toISOString(),
      duration: `${duration} minutes`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    
    // Check for scheduling conflicts using the enhanced conflict detection
    const conflictCheckStart = Date.now();
    const { hasConflict, conflicts } = await hasSchedulingConflict(
      userId,
      proposedStart,
      duration
    );
    
    console.log(`Conflict check took ${Date.now() - conflictCheckStart}ms`);
    
    if (hasConflict) {
      console.log('Scheduling conflicts found:', conflicts);
      
      // Helper function to safely format dates
      const formatDateSafe = (dateStr) => {
        try {
          const date = new Date(dateStr);
          // Check if date is valid
          if (isNaN(date.getTime())) return 'Invalid Date';
          // Return ISO string in local timezone
          return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        } catch (error) {
          console.error('Error formatting date:', error);
          return 'Invalid Date';
        }
      };

      // Format conflict details with safe date handling
      const conflictDetails = conflicts.map(conflict => {
        const startDate = new Date(conflict.startTime);
        const endDate = new Date(conflict.endTime);
        const durationMinutes = !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())
          ? Math.round((endDate - startDate) / 60000)
          : NaN;
          
        return {
          title: conflict.title,
          group: conflict.group || 'Unknown Group',
          time: {
            start: formatDateSafe(conflict.startTime),
            end: formatDateSafe(conflict.endTime),
            duration: isNaN(durationMinutes) ? 'N/A' : `${durationMinutes} minutes`
          }
        };
      });
      
      // Create error message with formatted conflicts
      let errorMessage = 'You have a scheduling conflict with another session.\n\n';
      errorMessage += 'Conflicting sessions:\n';
      errorMessage += conflictDetails.map(c => 
        `- "${c.title}" in ${c.group} (${c.time.start} - ${c.time.end})`
      ).join('\n');
      errorMessage += '\n\nPlease choose a different time or reschedule the conflicting session.';
      
      throw new AppError(
        errorMessage,
        400,
        { 
          conflicts: conflictDetails,
          message: 'Scheduling conflict detected',
          code: 'SCHEDULING_CONFLICT'
        }
      );
    }

    // Validate session time against group preferences
    const timeValidation = await validateSessionTime(
      new Date(scheduledDate),
      groupId
    );
    
    if (!timeValidation.isValid) {
      throw new AppError(timeValidation.message || 'Invalid session time', 400);
    }

    // Initialize session data with creator as 'going'
    const sessionData = {
      ...req.body,
      groupId,
      createdBy: userId,
      endTime: new Date(new Date(scheduledDate).getTime() + (duration * 60000)),
      attendees: [
        { 
          user: userId, 
          rsvpStatus: 'going',
          joinedAt: new Date()
        }
      ]
    };

    // Add all other group members with 'not-going' status
    const otherMembers = group.members
      .filter(member => member.user.toString() !== userId)
      .map(member => ({
        user: member.user._id || member.user, // Handle both populated and unpopulated
        rsvpStatus: 'not-going',
        invitedAt: new Date()
      }));
    
    // Add other members to attendees
    sessionData.attendees.push(...otherMembers);
    
    // Remove duplicates (in case creator was added again)
    const uniqueAttendees = [];
    const seenUsers = new Set();
    
    sessionData.attendees.forEach(attendee => {
      const userId = attendee.user.toString();
      if (!seenUsers.has(userId)) {
        seenUsers.add(userId);
        uniqueAttendees.push(attendee);
      }
    });
    
    sessionData.attendees = uniqueAttendees;

    // Auto-assign group members if enabled
    if (autoAssign && group.members.length > 1) {
      const memberIds = group.members
        .filter(m => m.user.toString() !== userId) // Exclude creator
        .map(m => m.user.toString());
      
      if (memberIds.length > 0) {
        const { selectedUsers } = await balanceSessionAssignments(
          groupId,
          memberIds
        );
        
        selectedUsers.forEach(userId => {
          sessionData.attendees.push({
            user: userId,
            status: 'pending',
            invitedAt: new Date()
          });
        });
      }
    }

    let newSession;
    if (isProduction) {
      // In production, create with transaction - returns an array
      const result = await StudySession.create([sessionData], { session });
      newSession = result[0];
      
      // Add session to group's sessions array
      group.sessions.push(newSession._id);
      
      await group.save({ session });
      await session.commitTransaction();
      session.endSession();
    } else {
      // In development, create without transaction - returns a single document
      newSession = await StudySession.create(sessionData);
      
      // Add session to group's sessions array
      group.sessions.push(newSession._id);
      await group.save();
    }

    // Populate the created session with user details
    const sessionId = isProduction ? newSession._id : newSession._id;
    const populatedSession = await StudySession.findById(sessionId)
      .populate('createdBy', 'name email avatar')
      .populate('attendees.user', 'name email avatar');
    
    res.status(201).json({
      success: true,
      data: populatedSession,
    });
  } catch (error) {
    log('Error in createSession:', error);
    
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    
    next(error);
  }
};
// @route   PUT /api/study-sessions/:id
// @access  Private
exports.updateSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    const userId = req.user.id;
    
    // Find session
    const existingSession = await StudySession.findById(id);
    if (!existingSession) {
      throw new AppError('Session not found', 404);
    }

    // Check permissions
    if (existingSession.createdBy.toString() !== userId && req.user.role !== 'admin') {
      throw new AppError('Not authorized to update this session', 403);
    }

    // Validate session status
    if (existingSession.status === 'completed' || existingSession.status === 'cancelled') {
      throw new AppError('Cannot update a completed or cancelled session', 400);
    }

    // Prevent certain fields from being updated
    const restrictedUpdates = ['_id', 'createdAt', 'createdBy'];
    const isValidUpdate = Object.keys(updates).every(
      update => !restrictedUpdates.includes(update)
    );

    if (!isValidUpdate) {
      throw new AppError('Invalid updates', 400);
    }

    // Check for scheduling conflicts if time-related fields are being updated
    if (updates.scheduledDate || updates.duration) {
      const proposedStart = new Date(updates.scheduledDate || existingSession.scheduledDate);
      const duration = updates.duration || existingSession.duration;
      
      // Check for conflicts with other sessions
      const { hasConflict, conflicts } = await hasSchedulingConflict(
        userId,
        proposedStart,
        duration,
        id // Exclude current session from conflict check
      );
      
      if (hasConflict) {
        // Format conflict details for user-friendly error message
        const formatDate = (date) => {
          return new Date(date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        };
        
        const conflictDetails = conflicts.map(conflict => ({
          title: conflict.title,
          group: conflict.group,
          startTime: formatDate(conflict.startTime),
          endTime: formatDate(conflict.endTime),
          conflictType: conflict.conflictDetails?.type || 'overlap',
          overlapMinutes: conflict.conflictDetails?.overlapMinutes || 0
        }));
        
        throw new AppError(
          'Scheduling conflict detected with existing sessions',
          400,
          { 
            code: 'SCHEDULING_CONFLICT',
            conflicts: conflictDetails
          }
        );
      }
    }

    // Update session
    const updatedSession = await StudySession.findByIdAndUpdate(
      id, 
      updates, 
      { 
        new: true, 
        runValidators: true
      }
    )
    .populate('createdBy', 'name avatar')
    .populate('attendees.user', 'name avatar')
    .populate('groupId', 'name');
    
    log(`Session ${id} updated by user ${userId}`, { 
      updates,
      updatedFields: Object.keys(updates)
    });
    
    res.json({
      success: true,
      data: updatedSession,
    });
  } catch (error) {
    log('Error in updateSession:', error);
    
    // Handle scheduling conflicts with a more specific error message
    if (error.code === 'SCHEDULING_CONFLICT') {
      return next(new AppError(
        error.message || 'Scheduling conflict detected',
        error.statusCode || 400,
        {
          code: 'SCHEDULING_CONFLICT',
          conflicts: error.conflicts || []
        }
      ));
    }
    
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
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    let query = {
      status: 'scheduled',
      scheduledDate: { $gte: new Date() },
    };
    
    // For non-admin users, filter by group membership
    if (!isAdmin) {
      // Get user's active groups
      const userGroups = await StudyGroup.find({
        'members.user': userId,
        'members.status': 'active'
      }).select('_id');
      
      const groupIds = userGroups.map(g => g._id);
      
      // Find sessions where user is an attendee or session is from a group they're a member of
      query.$or = [
        { 'attendees.user': userId },
        { groupId: { $in: groupIds } }
      ];
    }
    
    // Execute query
    const sessions = await StudySession.find(query)
      .sort('scheduledDate')
      .limit(limit)
      .populate('groupId', 'title')
      .populate('createdBy', 'name avatar')
      .populate('attendees.user', 'name avatar');

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
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
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
    
    // Validate date range is not too large (max 90 days)
    const maxDays = 90;
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > maxDays) {
      return next(
        new AppError(`Date range cannot exceed ${maxDays} days`, 400)
      );
    }
    
    // Start building the base query with date range
    const baseQuery = {
      scheduledDate: {
        $gte: start,
        $lte: end,
      },
    };
    
    // For non-admin users, filter by group membership unless a specific group is provided
    if (!isAdmin) {
      // If a specific group is provided, verify the user is a member
      if (groupId) {
        const isMember = await StudyGroup.exists({
          _id: groupId,
          'members.user': userId,
          'members.status': 'active'
        });
        
        if (!isMember) {
          return next(new AppError('Not authorized to access sessions for this group', 403));
        }
        
        baseQuery.groupId = groupId;
      } else {
        // Get user's active groups
        const userGroups = await StudyGroup.find({
          'members.user': userId,
          'members.status': 'active'
        }).select('_id');
        
        const groupIds = userGroups.map(g => g._id);
        
        // Find sessions where user is an attendee or session is from a group they're a member of
        baseQuery.$or = [
          { 'attendees.user': userId },
          { groupId: { $in: groupIds } }
        ];
      }
    } else if (groupId) {
      // Admin with specific group filter
      baseQuery.groupId = groupId;
    }
    
    // Add status filter if provided
    if (status) {
      baseQuery.status = status;
    }
    
    // Execute the query
    const sessions = await StudySession.find(baseQuery)
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
