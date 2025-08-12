const { AppError } = require('../middleware/errorHandler');
const StudySession = require('../models/StudySession');
const logger = require('./logger');
const mongoose = require('mongoose');

/**
 * Checks for scheduling conflicts for a user
 * @param {string} userId - The user ID to check
 * @param {Date} startTime - Proposed session start time
 * @param {number} duration - Session duration in minutes
 * @param {string} [excludeSessionId] - Optional session ID to exclude from conflict check (for updates)
 * @returns {Promise<boolean>} - True if there's a conflict, false otherwise
 */
/**
 * Checks for scheduling conflicts for a user with improved time handling and conflict detection
 * @param {string} userId - The user ID to check
 * @param {Date} startTime - Proposed session start time (UTC)
 * @param {number} duration - Session duration in minutes
 * @param {string} [excludeSessionId] - Optional session ID to exclude from conflict check (for updates)
 * @returns {Promise<{hasConflict: boolean, conflicts: Array}>} - Object with conflict status and details
 */
/**
 * Enhanced conflict detection with precise time handling and detailed conflict information
 */
const hasSchedulingConflict = async (userId, startTime, duration, excludeSessionId = null) => {
  try {
    // Validate inputs
    if (!userId || !startTime || !duration) {
      throw new AppError('Missing required parameters for conflict check', 400);
    }

    // Parse and validate start time
    const utcStartTime = new Date(startTime);
    if (isNaN(utcStartTime.getTime())) {
      throw new AppError('Invalid start time provided', 400);
    }

    // Calculate time boundaries
    const SESSION_BUFFER_MINUTES = 15;
    const bufferMs = SESSION_BUFFER_MINUTES * 60 * 1000;
    const sessionDurationMs = duration * 60000;
    const utcEndTime = new Date(utcStartTime.getTime() + sessionDurationMs);
    
    // Define search window (wider than actual session for buffer)
    const searchStart = new Date(utcStartTime.getTime() - bufferMs);
    const searchEnd = new Date(utcEndTime.getTime() + bufferMs);

    // Find all relevant sessions for the user in the time window
    const potentialConflicts = await StudySession.find({
      'attendees.user': new mongoose.Types.ObjectId(userId),
      status: { $in: ['scheduled', 'ongoing'] },
      $or: [
        // Sessions that start or end in our search window
        { scheduledDate: { $gte: searchStart, $lte: searchEnd } },
        { endTime: { $gte: searchStart, $lte: searchEnd } },
        // Sessions that completely contain our search window
        { 
          scheduledDate: { $lte: searchStart },
          endTime: { $gte: searchEnd }
        }
      ]
    })
    .select('title scheduledDate endTime status groupId')
    .populate('groupId', 'name')
    .sort({ scheduledDate: 1 })
    .lean();

    // Filter out the session being updated (if any)
    const conflicts = potentialConflicts.filter(session => 
      !excludeSessionId || !session._id.equals(excludeSessionId)
    );

    // Detailed conflict analysis
    const analyzedConflicts = conflicts.map(session => {
      const sessionStart = new Date(session.scheduledDate);
      const sessionEnd = new Date(session.endTime);
      
      // Calculate overlap details
      const overlapStart = new Date(Math.max(utcStartTime, sessionStart));
      const overlapEnd = new Date(Math.min(utcEndTime, sessionEnd));
      const overlapMinutes = Math.max(0, (overlapEnd - overlapStart) / 60000);
      
      // Determine conflict type
      let conflictType = 'overlap';
      if (sessionStart < utcStartTime && sessionEnd > utcEndTime) {
        conflictType = 'contained';
      } else if (sessionStart >= utcStartTime && sessionEnd <= utcEndTime) {
        conflictType = 'contains';
      }
      
      // Calculate time until next available slot
      const timeUntilAvailable = new Date(sessionEnd.getTime() + bufferMs);
      
      return {
        id: session._id,
        title: session.title,
        group: session.groupId?.name || 'Unknown Group',
        startTime: sessionStart,
        endTime: sessionEnd,
        status: session.status,
        conflictDetails: {
          type: conflictType,
          overlapMinutes: Math.round(overlapMinutes * 10) / 10, // Round to 1 decimal
          timeUntilAvailable,
          bufferMinutes: SESSION_BUFFER_MINUTES
        }
      };
    });

    // Filter out non-conflicts (buffer time only)
    const actualConflicts = analyzedConflicts.filter(conflict => {
      // Only include if there's an actual time overlap (not just buffer time)
      return conflict.conflictDetails.overlapMinutes > 0;
    });

    return {
      hasConflict: actualConflicts.length > 0,
      conflicts: actualConflicts,
      proposedSession: {
        startTime: utcStartTime,
        endTime: utcEndTime,
        durationMinutes: duration
      }
    };
  } catch (error) {
    logger.error('Error checking scheduling conflict:', error);
    throw new AppError('Error checking scheduling conflict', 500);
  }
};

/**
 * Balances session assignments across group members
 * @param {string} groupId - The group ID
 * @param {string[]} userIds - Array of user IDs to balance across
 * @param {number} maxSessions - Maximum sessions per user to balance against
 * @returns {Promise<Object>} - Object with balanced user assignments
 */
const balanceSessionAssignments = async (groupId, userIds, maxSessions = 3) => {
  try {
    // Get session counts for each user in the group
    const sessionCounts = await StudySession.aggregate([
      { 
        $match: { 
          groupId: mongoose.Types.ObjectId(groupId),
          'attendees.user': { $in: userIds.map(id => mongoose.Types.ObjectId(id)) }
        } 
      },
      { $unwind: '$attendees' },
      { 
        $match: { 
          'attendees.user': { $in: userIds.map(id => mongoose.Types.ObjectId(id)) } 
        } 
      },
      {
        $group: {
          _id: '$attendees.user',
          sessionCount: { $sum: 1 }
        }
      }
    ]);

    // Convert to a map for easy lookup
    const userSessionCounts = new Map();
    userIds.forEach(id => userSessionCounts.set(id.toString(), 0));
    
    sessionCounts.forEach(item => {
      userSessionCounts.set(item._id.toString(), item.sessionCount);
    });

    // Sort users by session count (ascending)
    const sortedUsers = Array.from(userSessionCounts.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([userId]) => userId);

    // Find users with the minimum session count
    const minSessions = userSessionCounts.get(sortedUsers[0]) || 0;
    const eligibleUsers = sortedUsers.filter(
      userId => userSessionCounts.get(userId) <= minSessions + 1 && 
               userSessionCounts.get(userId) < maxSessions
    );

    // Randomly select users from the eligible pool
    const selectedUsers = [];
    const pool = [...eligibleUsers];
    
    while (pool.length > 0 && selectedUsers.length < 3) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      selectedUsers.push(pool.splice(randomIndex, 1)[0]);
    }

    return {
      selectedUsers,
      userSessionCounts: Object.fromEntries(userSessionCounts)
    };
  } catch (error) {
    logger.error('Error balancing session assignments:', error);
    throw new AppError('Error balancing session assignments', 500);
  }
};

/**
 * Validates session time against group availability
 * @param {Date} startTime - Proposed session start time
 * @param {string} groupId - The group ID
 * @returns {Promise<{isValid: boolean, message?: string}>} - Validation result
 */
const validateSessionTime = async (startTime, groupId) => {
  try {
    const hour = startTime.getUTCHours();
    const day = startTime.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Get group's availability preferences (you'll need to implement this in your Group model)
    const group = await mongoose.model('StudyGroup').findById(groupId);
    
    if (!group) {
      return { isValid: false, message: 'Group not found' };
    }

    // Check if time is within group's preferred hours (example: 9 AM to 9 PM)
    if (hour < 9 || hour >= 21) {
      return { 
        isValid: false, 
        message: 'Session time is outside preferred group hours (9 AM - 9 PM)' 
      };
    }

    // Check if it's a weekend and group prefers weekdays
    if ((day === 0 || day === 6) && group.preferences?.preferWeekdays) {
      return { 
        isValid: false, 
        message: 'Group prefers sessions on weekdays' 
      };
    }

    return { isValid: true };
  } catch (error) {
    logger.error('Error validating session time:', error);
    throw new AppError('Error validating session time', 500);
  }
};

module.exports = {
  hasSchedulingConflict,
  balanceSessionAssignments,
  validateSessionTime
};
