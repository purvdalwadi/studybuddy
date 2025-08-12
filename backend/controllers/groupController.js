const mongoose = require('mongoose');
const { AppError } = require('../middleware/errorHandler');
const StudyGroup = require('../models/StudyGroup');
const logger = require('../utils/logger');
const cloudinary = require('../utils/cloudinary');

// Logging helper
const log = (message, data = {}) => logger.info(`[GROUP] ${message}`, data);

// Search groups with filters
exports.searchGroups = async (req, res, next) => {
  try {
    const { q: searchQuery, subject, level, limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    const query = { isActive: true };
    
    // Apply filters
    if (searchQuery) query.$text = { $search: searchQuery };
    if (subject) query.subject = subject;
    if (level) query.level = level;
    
    const [total, groups] = await Promise.all([
      StudyGroup.countDocuments(query),
      StudyGroup.find(query)
        .sort({ memberCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('creator', 'name avatar')
        .populate('members.user', 'name avatar role')
    ]);
    
    res.json({
      success: true,
      count: groups.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: groups
    });
  } catch (error) {
    log('Search error:', error);
    next(new AppError('Failed to search groups', 500));
  }
};

// Get groups for a specific user
exports.getUserGroups = async (req, res, next) => {
  try {
    const userId = req.params.userId === 'me' ? req.user.id : req.params.userId;
    log(`Fetching groups for user ${userId}`);
    
    const groups = await StudyGroup.find({
      $and: [
        { isActive: true },
        { $or: [{ creator: userId }, { 'members.user': userId }] }
      ]
    })
    .populate('creator', 'name avatar')
    .populate('members.user', 'name avatar role');
    
    res.json({ success: true, count: groups.length, data: groups });
  } catch (error) {
    log('Get user groups error:', error);
    next(error);
  }
};

// Get all active groups
exports.getGroups = async (req, res, next) => {
  try {
    const groups = await StudyGroup.find({ isActive: true })
      .populate('creator', 'name avatar')
      .populate('members.user', 'name avatar role');
    res.json({ success: true, count: groups.length, data: groups });
  } catch (error) {
    log('Get groups error:', error);
    next(new AppError('Failed to retrieve groups', 500));
  }
};

// Get a single group by ID
exports.getGroup = async (req, res, next) => {
  try {
    const group = await StudyGroup.findOne({
      _id: req.params.id,
      isActive: true
    })
    .populate('creator', 'name avatar')
    .populate('members.user', 'name avatar role');
    
    if (!group) return next(new AppError('Group not found or is inactive', 404));
    res.json({ success: true, data: group });
  } catch (error) {
    log('Get group error:', error);
    next(new AppError('Failed to retrieve group', 500));
  }
};

// Get all members of a group
exports.getGroupMembers = async (req, res, next) => {
  try {
    const group = await StudyGroup.findOne({
      _id: req.params.id,
      isActive: true
    }).populate('members.user', 'name avatar role');
    
    if (!group) return next(new AppError('Group not found or is inactive', 404));
    res.json({ success: true, count: group.members.length, data: group.members });
  } catch (error) {
    log('Get group members error:', error);
    next(new AppError('Failed to retrieve group members', 500));
  }
};

// Create a new study group
exports.createGroup = async (req, res, next) => {
  const requestId = req.requestId || Math.random().toString(36).substr(2, 8);
  const startTime = Date.now();
  
  // Enhanced logging function
  const log = (message, data = {}) => {
    const timestamp = Date.now() - startTime;
    const logData = { 
      ...data, 
      timestamp: `${timestamp}ms`,
      requestId,
      userId: req.user?.id
    };
    console.log(`[GROUP_CREATE:${requestId}][+${timestamp}ms] ${message}`, logData);
  };
  
  log('Starting group creation', {
    method: req.method,
    url: req.originalUrl,
    body: { ...req.body, password: undefined } // Redact sensitive data
  });
  
  try {
    // Validate required fields
    const required = ['title', 'subject', 'university'];
    const missing = required.filter(field => !req.body[field]);
    
    log('Validating required fields', { required, provided: Object.keys(req.body).filter(k => req.body[k]) });
    
    if (missing.length) {
      const error = new AppError(`Missing required fields: ${missing.join(', ')}`, 400);
      log('Validation failed - missing required fields', { missing });
      return next(error);
    }
    
    // Validate and normalize difficulty/level
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    let difficulty = (req.body.difficulty || req.body.level || 'beginner').toLowerCase();
    
    // Ensure difficulty is valid
    if (!validDifficulties.includes(difficulty)) {
      log('Invalid difficulty provided, defaulting to beginner', { 
        received: difficulty,
        validOptions: validDifficulties 
      });
      difficulty = 'beginner';
    }
    
    // Handle avatar upload if present
    let avatarUrl = 'group-default.jpg';
    let avatarPublicId = null;
    
    if (req.file) {
      try {
        const result = await cloudinary.uploadFile(
          req.file.buffer, 
          'studybuddy/groups',
          `group_${Date.now()}`
        );
        avatarUrl = result.secure_url;
        avatarPublicId = result.public_id;
        log('Avatar uploaded to Cloudinary', { avatarUrl, avatarPublicId });
      } catch (error) {
        log('Error uploading avatar to Cloudinary', { error: error.message });
        return next(new AppError('Failed to upload group avatar', 500));
      }
    }
    
    // Prepare group data with normalized values
    const groupData = {
      title: req.body.title,
      subject: req.body.subject,
      university: req.body.university,
      description: req.body.description || '',
      difficulty: difficulty,
      level: difficulty, // Keep both for backward compatibility
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      maxMembers: Number.isInteger(Number(req.body.maxMembers)) ? 
                 Math.min(Math.max(Number(req.body.maxMembers), 2), 50) : 10,
      isActive: true,
      avatar: avatarUrl,
      avatarPublicId: avatarPublicId
    };
    
    // Log the values being used
    log('Group creation data prepared', {
      requestBody: {
        difficulty: req.body.difficulty,
        level: req.body.level,
        maxMembers: req.body.maxMembers,
        tags: req.body.tags
      },
      processedData: {
        difficulty: groupData.difficulty,
        level: groupData.level,
        maxMembers: groupData.maxMembers,
        tags: groupData.tags
      }
    });
    
    log('Prepared group data', { groupData });
    
    // Create group with creator
    log('Calling StudyGroup.createWithCreator', { userId: req.user.id });
    const group = await StudyGroup.createWithCreator(groupData, req.user.id);
    
    log('Group created successfully', { 
      groupId: group._id,
      duration: `${Date.now() - startTime}ms`
    });
    
    // Prepare response data
    const responseData = group.toObject ? group.toObject() : group;
    
    // Ensure difficulty is properly set in response
    if (!responseData.difficulty && responseData.level) {
      responseData.difficulty = responseData.level;
    } else if (!responseData.level && responseData.difficulty) {
      responseData.level = responseData.difficulty;
    }
    
    const response = { 
      success: true, 
      data: responseData 
    };
    
    log('Sending response', { 
      statusCode: 201,
      difficulty: responseData.difficulty,
      level: responseData.level
    });
    
    res.status(201).json(response);
    log('Response sent successfully');
    
  } catch (error) {
    const errorInfo = {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      duration: `${Date.now() - startTime}ms`
    };
    
    log('Group creation failed', errorInfo);
    
    if (error.name === 'ValidationError') {
      const errors = Object.fromEntries(
        Object.entries(error.errors || {}).map(([key, { message }]) => [key, message])
      );
      log('Validation error details', { errors });
      return next(new AppError('Validation failed', 400, { errors }));
    }
    
    if (error.code === 11000) {
      log('Duplicate key error - group name already exists');
      return next(new AppError('A group with this name already exists', 400));
    }
    
    log('Unexpected error during group creation');
    next(new AppError('Failed to create group', 500));
  }
};

// Update a group's details
exports.updateGroup = async (req, res, next) => {
  const startTime = Date.now();
  const log = (message, data = {}) => {
    console.log(`[${new Date().toISOString()}] [GroupUpdate] ${message}`, {
      ...data,
      duration: Date.now() - startTime,
      groupId: req.params.id,
      userId: req.user?.id
    });
  };

  try {
    log('Starting group update', { groupId: req.params.id, userId: req.user.id });
    
    // Find the group
    log('Searching for group in database...');
    const group = await StudyGroup.findById(req.params.id);
    if (!group) {
      log('Group not found', { groupId: req.params.id });
      return next(new AppError('Group not found', 404));
    }
    
    // Handle avatar changes (upload or removal)
    if (req.file) {
      // New avatar file was uploaded
      try {
        // Delete old avatar if exists
        if (group.avatarPublicId) {
          await cloudinary.deleteFile(group.avatarPublicId);
          log('Deleted old avatar from Cloudinary', { publicId: group.avatarPublicId });
        }
        
        // Upload new avatar
        const result = await cloudinary.uploadFile(
          req.file.buffer, 
          'studybuddy/groups',
          `group_${group._id}_${Date.now()}`
        );
        
        // Update group with new avatar
        group.avatar = result.secure_url;
        group.avatarPublicId = result.public_id;
        log('Uploaded new avatar to Cloudinary', { 
          avatarUrl: group.avatar,
          avatarPublicId: group.avatarPublicId 
        });
      } catch (error) {
        log('Error updating group avatar', { error: error.message });
        return next(new AppError('Failed to update group avatar', 500));
      }
    } else if (req.body.avatar === 'null' || req.body.avatar === null) {
      // Avatar removal requested
      log('Avatar removal requested');
      try {
        // Delete old avatar from Cloudinary if exists
        if (group.avatarPublicId) {
          await cloudinary.deleteFile(group.avatarPublicId);
          log('Deleted avatar from Cloudinary', { publicId: group.avatarPublicId });
        }
        
        // Clear avatar fields
        group.avatar = undefined;
        group.avatarPublicId = undefined;
        log('Cleared avatar fields');
      } catch (error) {
        log('Error removing avatar', { error: error.message });
        // Continue even if Cloudinary deletion fails, as we still want to clear the fields
      }
    }
    
    log('Found group', { 
      groupId: group._id, 
      currentTitle: group.title,
      creator: group.creator,
      memberCount: group.members ? group.members.length : 0,
      isActive: group.isActive
    });
    
    // Log the raw request body for debugging
    log('Raw request body:', { body: req.body, bodyKeys: Object.keys(req.body) });
    
    // Check permissions
    log('Checking user permissions', { 
      userId: req.user.id,
      creatorId: group.creator ? group.creator.toString() : 'null',
      members: group.members ? group.members.length : 0
    });
    
    // Debug: Log the group object structure
    log('Group object structure:', {
      _id: group._id,
      title: group.title,
      creator: group.creator,
      members: group.members ? group.members.map(m => ({
        user: m.user ? m.user.toString() : 'null',
        role: m.role
      })) : 'no members'
    });
    
    // Debug: Log the request user
    log('Request user:', {
      _id: req.user._id,
      id: req.user.id,
      email: req.user.email
    });
    
    // Debug: Check if user is in members
    const userInMembers = group.members && group.members.some(m => 
      m.user && m.user.toString() === req.user.id
    );
    log('User in members check:', { userInMembers });
    
    // Check if user is creator (handle both object and string/objectId cases)
    const isCreator = group.creator && 
      (typeof group.creator === 'object' ? 
        (group.creator._id ? group.creator._id.toString() : group.creator.toString()) === req.user.id : 
        group.creator.toString() === req.user.id);
    log('Is creator check:', { isCreator });
    
    // Check if user is admin
    const isAdmin = group.members && group.members.some(member => {
      const memberUserId = member.user ? 
        (typeof member.user === 'object' ? 
          (member.user._id ? member.user._id.toString() : member.user.toString()) : 
          member.user.toString()) : 
        null;
      
      const isMatch = memberUserId === req.user.id && member.role === 'admin';
      log('Admin check for member:', { 
        memberUserId,
        isMatch,
        memberRole: member.role,
        expectedUserId: req.user.id,
        isObject: typeof member.user === 'object'
      });
      return isMatch;
    });
    
    log('Permission check result:', { isAdmin, isCreator });
    log('Permission check', { 
      isAdmin, 
      isCreator, 
      userId: req.user.id,
      groupCreator: group.creator ? group.creator.toString() : 'null'
    });
    
    if (!isAdmin && !isCreator) {
      log('Permission denied', { userId: req.user.id, groupId: group._id });
      return next(new AppError('Not authorized to update this group', 403));
    }
    
    log('User has permission to update the group');
    log('Current group data before update:', {
      title: group.title,
      description: group.description,
      subject: group.subject,
      isActive: group.isActive
    });
    
    // Log the requested updates
    log('Requested updates:', req.body);
    
    // Only update allowed fields
    log('Filtering allowed updates...');
    const allowedUpdates = ['title', 'description', 'subject', 'difficulty', 'isPublic', 'tags', 'maxMembers'];
    log('Allowed updates:', allowedUpdates);
    
    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});
      
    log('Filtered updates to apply', { updates });
    
    // Update and save
    log('Starting to apply updates to group...');
    const updateStart = Date.now();
    
    try {
      log('Before Object.assign - group:', {
        title: group.title,
        description: group.description,
        subject: group.subject
      });
      
      Object.assign(group, updates);
      group.updatedAt = Date.now();
      
      log('After Object.assign - group:', {
        title: group.title,
        description: group.description,
        subject: group.subject,
        updatedAt: group.updatedAt
      });
      
      log('Changes applied, preparing to save group', { 
        updateDuration: Date.now() - updateStart,
        changes: group.getChanges ? group.getChanges() : 'No getChanges method'
      });
    } catch (assignError) {
      log('Error during Object.assign:', {
        error: assignError.message,
        stack: assignError.stack
      });
      return next(new AppError('Failed to apply updates', 500));
    }
    
    let savedGroup;
    try {
      log('Attempting to save group...');
      const saveStart = Date.now();
      savedGroup = await group.save({ new: true }).catch(saveError => {
        log('Error saving group:', { 
          error: saveError.message,
          stack: saveError.stack,
          name: saveError.name,
          code: saveError.code
        });
        throw saveError;
      });
      
      log('Group saved successfully', { 
        saveDuration: Date.now() - saveStart,
        updatedAt: savedGroup.updatedAt,
        savedGroupId: savedGroup._id
      });
    } catch (saveError) {
      log('Save operation failed:', {
        error: saveError.message,
        stack: saveError.stack,
        name: saveError.name,
        code: saveError.code
      });
      throw saveError;
    }
    
    // Populate and return
    log('Starting population of creator and members');
    const populateStart = Date.now();
    try {
      // Use a fresh query to get the populated document
      const populatedGroup = await StudyGroup.findById(savedGroup._id)
        .populate('creator', 'name avatar')
        .populate('members.user', 'name avatar role')
        .lean();
        
      log('Population completed successfully', { 
        populateDuration: Date.now() - populateStart,
        hasCreator: !!populatedGroup.creator,
        memberCount: populatedGroup.members ? populatedGroup.members.length : 0
      });
      
      // Update the savedGroup with populated data
      const responseData = { ...savedGroup.toObject(), ...populatedGroup };
      
      log('Sending response');
      res.json({ 
        success: true, 
        data: responseData 
      });
      log('Response sent successfully');
      return;
    } catch (populateError) {
      log('Error during population', { 
        error: populateError.message,
        stack: populateError.stack
      });
      // Send response even if population fails
      res.json({ 
        success: true, 
        data: savedGroup,
        message: 'Group updated but there was an error populating all fields'
      });
      return;
    }
  } catch (error) {
    log('Error in updateGroup', { 
      error: error.message,
      stack: error.stack,
      name: error.name 
    });
    next(new AppError('Failed to update group', 500));
  }
};

// Soft delete a group (creator only)
exports.deleteGroup = async (req, res, next) => {
  try {
    const group = await StudyGroup.findById(req.params.id);
    if (!group) return next(new AppError('Group not found', 404));
    
    // Only creator can delete
    if (group.creator.toString() !== req.user.id) {
      return next(new AppError('Not authorized to delete this group', 403));
    }
    
    // Soft delete
    group.isActive = false;
    await group.save();
    
    res.json({ success: true, data: {} });
  } catch (error) {
    log('Delete group error:', error);
    next(new AppError('Failed to delete group', 500));
  }
};

// Join a study group
exports.joinGroup = async (req, res, next) => {
  try {
    const group = await StudyGroup.findById(req.params.id);
    if (!group) return next(new AppError('Group not found', 404));

    // Check if already a member (handles string, ObjectId, or populated user)
    if (group.members.some(m => {
      if (!m.user) return false;
      if (typeof m.user === 'string') return m.user === req.user.id;
      if (typeof m.user === 'object' && m.user._id) return m.user._id.toString() === req.user.id;
      return false;
    })) {
      return next(new AppError('Already a member of this group', 400));
    }

    // Add user to members
    group.members.push({ user: req.user.id, role: 'member' });
    await group.save();

    // Populate and return
    await group.populate('creator', 'name avatar');
    await group.populate('members.user', 'name avatar role');

    res.json({ success: true, data: group });
  } catch (error) {
    log('Join group error:', error);
    next(new AppError('Failed to join group', 500));
  }
};

// Leave a study group
exports.leaveGroup = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    
    console.log(`[leaveGroup] User ${userId} attempting to leave group ${groupId}`);

    // Validate group ID format
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      console.log(`[leaveGroup] Invalid group ID format: ${groupId}`);
      return next(new AppError('Invalid group ID', 400));
    }

    const group = await StudyGroup.findById(groupId);
    if (!group) {
      console.log(`[leaveGroup] Group ${groupId} not found`);
      return next(new AppError('Group not found', 404));
    }

    // Ensure members array exists
    if (!group.members) {
      group.members = [];
    }

    // Log current state for debugging
    console.log(`[leaveGroup] Group: ${group._id}, Creator: ${group.creator}`);
    console.log(`[leaveGroup] Current members:`, group.members.map(m => ({
      userId: m.user.toString(),
      role: m.role,
      isCurrentUser: m.user.toString() === userId
    })));
    
    // Check if user is the creator
    if (group.creator.toString() === userId) {
      console.log(`[leaveGroup] User ${userId} is the creator of group ${group._id}`);
      return next(new AppError('Creator cannot leave the group. Transfer ownership or delete the group.', 400));
    }
    
    // Check if user is a member
    console.log(`[leaveGroup] Checking membership - User ID: ${userId}, Type: ${typeof userId}`);
    
    // Handle both cases where m.user could be an object with _id/id or just an ID
    const memberIndex = group.members.findIndex(member => {
      let memberId;
      
      if (typeof member.user === 'object' && member.user !== null) {
        // Handle case where user is a populated object
        memberId = (member.user._id || member.user.id || '').toString();
      } else {
        // Handle case where user is just an ID
        memberId = member.user?.toString();
      }
      
      console.log(`[leaveGroup] Checking member ID: ${memberId} (type: ${typeof memberId})`);
      return memberId === userId;
    });
    
    console.log(`[leaveGroup] Member index found: ${memberIndex}`);
    
    if (memberIndex === -1) {
      const availableMemberIds = group.members.map(m => {
        if (typeof m.user === 'object' && m.user !== null) {
          return (m.user._id || m.user.id || 'unknown').toString();
        }
        return m.user?.toString() || 'unknown';
      });
      
      console.log(`[leaveGroup] User ${userId} is not a member of group ${group._id}`);
      console.log(`[leaveGroup] Available member IDs:`, availableMemberIds);
      return next(new AppError('You are not a member of this group', 400));
    }
    
    // Remove user from members
    group.members.splice(memberIndex, 1);
    await group.save();

    console.log(`[leaveGroup] Successfully removed user ${userId} from group ${group._id}`);
    console.log(`[leaveGroup] Remaining members:`, group.members.map(m => m.user.toString()));
    
    res.json({ success: true, data: {} });
  } catch (error) {
    console.error('[leaveGroup] Error:', error);
    next(new AppError('Failed to leave group', 500));
  }
};

// Add a member to a group (admin/creator only)
exports.addGroupMember = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const { userId, role = 'member' } = req.body;
    const currentUserId = req.user.id;

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
      console.log(`[addGroupMember] Invalid ID format - Group: ${groupId}, User: ${userId}`);
      return next(new AppError('Invalid ID format', 400));
    }

    // Find group
    const group = await StudyGroup.findById(groupId);
    if (!group) {
      console.log(`[addGroupMember] Group ${groupId} not found`);
      return next(new AppError('Group not found', 404));
    }

    // Ensure members array exists
    if (!group.members) {
      group.members = [];
    }

    console.log(`[addGroupMember] Adding user ${userId} to group ${groupId} as ${role}`);
    console.log(`[addGroupMember] Current members:`, group.members.map(m => ({
      userId: m.user.toString(),
      role: m.role
    })));

    // Check permissions
    const isAdmin = group.members.some(
      m => m.user.toString() === currentUserId && m.role === 'admin'
    );
    
    if (group.creator.toString() !== currentUserId && !isAdmin) {
      console.log(`[addGroupMember] User ${currentUserId} not authorized to add members`);
      return next(new AppError('Not authorized to add members', 403));
    }
    
    // Check if already a member
    if (group.members.some(m => m.user.toString() === userId)) {
      console.log(`[addGroupMember] User ${userId} already in group ${groupId}`);
      return next(new AppError('User is already a member of this group', 400));
    }
    
    // Add user to members
    group.members.push({ user: userId, role });
    await group.save();
    
    console.log(`[addGroupMember] Successfully added user ${userId} to group ${groupId}`);
    
    // Populate and return
    await group.populate('members.user', 'name avatar role');
    
    res.status(201).json({ success: true, data: group });
  } catch (error) {
    console.error('[addGroupMember] Error:', error);
    next(new AppError('Failed to add member to group', 500));
  }
};

// Remove a member from a group (admin/creator only)
exports.removeGroupMember = async (req, res, next) => {
  try {
    const { groupId, userId: memberId } = req.params;
    const currentUserId = req.user.id;

    console.log(`[removeGroupMember] Starting removal - Group: ${groupId}, Member: ${memberId}, Current User: ${currentUserId}`);

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      const error = new AppError(`Invalid group ID format: ${groupId}`, 400);
      console.error(`[removeGroupMember] ${error.message}`);
      return next(error);
    }
    
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      const error = new AppError(`Invalid member ID format: ${memberId}`, 400);
      console.error(`[removeGroupMember] ${error.message}`);
      return next(error);
    }

    // Find group with members populated
    const group = await StudyGroup.findById(groupId).populate('members.user', 'name email');
    if (!group) {
      const error = new AppError(`Group not found with ID: ${groupId}`, 404);
      console.error(`[removeGroupMember] ${error.message}`);
      return next(error);
    }
    
    console.log(`[removeGroupMember] Found group: ${group.name} (${group._id})`);

    // Ensure members array exists
    if (!group.members) {
      group.members = [];
    }

    console.log(`[removeGroupMember] Current members in group:`);
    group.members.forEach((m, i) => {
      const userId = m.user?._id?.toString() || m.user?.toString() || 'unknown';
      console.log(`  [${i}] User: ${userId}, Role: ${m.role}, Name: ${m.user?.name || 'N/A'}`);
    });
    
    // Check permissions
    const currentUserIsCreator = group.creator.toString() === currentUserId;
    const currentUserIsAdmin = group.members.some(
      m => m.user.toString() === currentUserId && m.role === 'admin'
    );
    
    if (!currentUserIsCreator && !currentUserIsAdmin) {
      const error = new AppError('Not authorized to remove members', 403);
      console.error(`[removeGroupMember] User ${currentUserId} not authorized to remove members`);
      return next(error);
    }
    
    console.log(`[removeGroupMember] Current user is ${currentUserIsCreator ? 'creator' : 'admin'}, proceeding with removal`);
    
    // Prevent removing the creator
    if (group.creator.toString() === memberId) {
      const error = new AppError('Cannot remove group creator', 400);
      console.error(`[removeGroupMember] Attempted to remove creator ${memberId}`);
      return next(error);
    }
    
    // Find and remove member
    const initialCount = group.members.length;
    const memberIdStr = memberId.toString();
    
    console.log(`[removeGroupMember] Looking for member with ID: ${memberIdStr}`);
    
    // Find the member to be removed
    const memberToRemove = group.members.find(m => {
      const userId = m.user?._id?.toString() || m.user?.toString();
      return userId === memberIdStr;
    });
    
    if (!memberToRemove) {
      const error = new AppError(`User ${memberIdStr} is not a member of this group`, 400);
      console.error(`[removeGroupMember] ${error.message}`);
      console.log(`[removeGroupMember] Available member IDs:`, group.members.map(m => 
        m.user?._id?.toString() || m.user?.toString()
      ));
      return next(error);
    }
    
    console.log(`[removeGroupMember] Found member to remove:`, {
      userId: memberToRemove.user?._id?.toString() || memberToRemove.user?.toString(),
      name: memberToRemove.user?.name || 'Unknown',
      role: memberToRemove.role
    });
    
    // Remove the member
    group.members = group.members.filter(m => {
      const userId = m.user?._id?.toString() || m.user?.toString();
      return userId !== memberIdStr;
    });
    
    try {
      const savedGroup = await group.save();
      
      console.log(`[removeGroupMember] Successfully removed user ${memberId} from group ${groupId}`);
      console.log(`[removeGroupMember] Remaining members:`, savedGroup.members.map(m => ({
        userId: m.user?._id?.toString() || m.user?.toString(),
        name: m.user?.name || 'Unknown',
        role: m.role
      })));
      
      res.json({ 
        success: true, 
        data: { 
          removedMemberId: memberId,
          remainingMembers: savedGroup.members.length
        } 
      });
    } catch (saveError) {
      console.error(`[removeGroupMember] Error saving group after member removal:`, saveError);
      return next(new AppError('Failed to update group after member removal', 500));
    }
  } catch (error) {
    console.error('[removeGroupMember] Error:', error);
    next(new AppError('Failed to remove member from group', 500));
  }
};
