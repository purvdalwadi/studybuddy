const { AppError } = require('../middleware/errorHandler');
const Message = require('../models/Message');
const StudyGroup = require('../models/StudyGroup');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Helper for consistent logging
const log = (message, data) => {
  logger.info(`[MESSAGE] ${message}`, data || '');
};

// @desc    Get messages for a group
// @route   GET /api/groups/:groupId/messages
// @access  Private
exports.getMessages = async (req, res, next) => {
  console.log('[MESSAGE] getMessages called', { groupId: req.params.groupId, query: req.query });
  
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    console.log('[MESSAGE] Checking group membership', { groupId, userId: req.user.id });
    
    // Check if user is a member of the group
    const isMember = await StudyGroup.findOne({
      _id: groupId,
      'members.user': req.user.id,
    }).lean();

    console.log('[MESSAGE] Group membership check complete', { isMember: !!isMember });

    if (!isMember) {
      console.log('[MESSAGE] Unauthorized access attempt', { groupId, userId: req.user.id });
      return next(new AppError('Not authorized to view messages for this group', 403));
    }

    // Build query
    const query = { groupId };
    if (search) {
      query.$text = { $search: search };
      console.log('[MESSAGE] Search query added', { search });
    }

    console.log('[MESSAGE] Fetching messages with query', { query, skip, limit });
    
    // Get messages with pagination and read status for current user
    const [total, messages] = await Promise.all([
      Message.countDocuments(query),
      Message.find(query)
        .lean()
        .transform((docs) => {
          return docs.map(doc => ({
            ...doc,
            // Add isRead flag for each message based on current user
            isRead: doc.readBy?.some(receipt => 
              receipt.user && receipt.user.toString() === req.user.id.toString()
            ) || false,
            // Add readBy count
            readCount: doc.readBy?.length || 0
          }));
        })
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .populate('sender', 'name avatar')
        .populate({
          path: 'replyTo',
          select: 'content sender',
          populate: {
            path: 'sender',
            select: 'name'
          }
        })
        .lean()
    ]);

    console.log(`[MESSAGE] Found ${messages.length} messages out of ${total} total`);

    // Mark messages as read (non-blocking) - only if readBy field exists
    const messagesToMarkRead = messages
      .filter(m => {
        // Skip if message was sent by the current user
        if (m.sender.toString() === req.user.id) return false;
        
        // If readBy doesn't exist, treat as unread
        if (!m.readBy) return true;
        
        // Check if current user has already read the message
        return !m.readBy.some(r => r.user && r.user.toString() === req.user.id);
      })
      .map(m => m._id);

    if (messagesToMarkRead.length > 0) {
      Message.updateMany(
        { _id: { $in: messagesToMarkRead } },
        { $addToSet: { readBy: { user: req.user.id } } }
      ).catch(err => {
        console.error('Error marking messages as read:', err);
      });
    }

    res.json({
      success: true,
      count: messages.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: messages.reverse(), // Return oldest first
    });
  } catch (error) {
    log('Error in getMessages:', error);
    next(error);
  }
};

// @desc    Send a message
// @route   POST /api/groups/:groupId/messages
// @access  Private
exports.sendMessage = async (req, res, next) => {
  const startTime = Date.now();
  const logStep = (step) => {
    const timestamp = Date.now() - startTime;
    log(`[${timestamp}ms] ${step}`);
  };

  try {
    logStep('1. Starting sendMessage');
    const { groupId } = req.params;
    const { content, replyTo } = req.body;
    logStep(`2. Received params - groupId: ${groupId}, content: ${content?.substring(0, 20)}...`);

    // Verify group membership
    logStep('3. Verifying group membership');
    console.log('Querying StudyGroup with:', { groupId, userId: req.user.id });
    
    let group;
    try {
      group = await StudyGroup.findOne({
        _id: groupId,
        'members.user': req.user.id,
      });
      console.log('StudyGroup query result:', group ? 'Found group' : 'Group not found or user not a member');
    } catch (dbError) {
      console.error('Database error in StudyGroup.findOne:', dbError);
      throw dbError;
    }

    if (!group) {
      logStep('❌ Group not found or user not a member');
      throw new AppError('Not authorized to send messages to this group', 403);
    }
    logStep('✅ Group membership verified');

    // Create message with initial status
    logStep('4. Creating message');
    const message = await Message.create({
      groupId,
      sender: req.user.id,
      content,
      messageType: 'text',
      replyTo,
      status: 'sent'
    });

    logStep(`✅ Message created with ID: ${message._id}`);

    // Populate related fields
    logStep('5. Populating message data');
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar')
      .populate('replyTo', 'content sender');
    logStep('✅ Message data populated');

    // Notify group members via WebSocket if available
    if (req.io) {
      logStep('6. Sending WebSocket notification');
      req.io.to(groupId).emit('new-message', populatedMessage);
      logStep('✅ WebSocket notification sent');
    } else {
      logStep('6. WebSocket not available, skipping notification');
    }

    logStep(`✅ Message sent to group ${groupId} by user ${req.user.id}`);
    
    res.status(201).json({
      success: true,
      data: populatedMessage,
    });
    logStep('✅ Response sent to client');
  } catch (error) {
    logStep(`❌ Error in sendMessage: ${error.message}`);
    logStep(`Stack: ${error.stack}`);
    next(error);
  }
};

// @desc    Update a message
// @route   PUT /api/messages/:id
// @access  Private
exports.updateMessage = async (req, res, next) => {
  const logStep = (step, data = {}) => {
    console.log(`[MESSAGE] [${step}]`, { 
      requestId: req.requestId,
      messageId: req.params.id,
      userId: req.user?.id,
      ...data 
    });
  };

  try {
    logStep('START', { contentLength: req.body.content?.length });
    
    const { id } = req.params;
    const { content } = req.body;

    // Validate content exists and is not empty
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      logStep('VALIDATION_ERROR', { error: 'Content is required' });
      return next(new AppError('Message content cannot be empty', 400));
    }

    // Find the message
    const message = await Message.findById(id).lean();
    if (!message) {
      logStep('NOT_FOUND', { messageId: id });
      return next(new AppError('Message not found', 404));
    }

    logStep('FOUND_MESSAGE', { 
      senderId: message.sender.toString(),
      isEdited: message.isEdited || false
    });

    // Check permissions - only sender can update
    if (message.sender.toString() !== req.user.id) {
      logStep('UNAUTHORIZED', { 
        userId: req.user.id,
        senderId: message.sender.toString()
      });
      return next(new AppError('Not authorized to update this message', 403));
    }

    // Update message
    const updateData = {
      content: content.trim(),
      isEdited: true,
      updatedAt: Date.now()
    };

    logStep('UPDATING', { 
      oldContentLength: message.content?.length || 0,
      newContentLength: content.length
    });

    // Use findByIdAndUpdate for atomic update
    const updatedMessage = await Message.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
    .populate('sender', 'name avatar')
    .populate('replyTo', 'content sender');

    if (!updatedMessage) {
      logStep('UPDATE_FAILED', { messageId: id });
      return next(new AppError('Failed to update message', 500));
    }

    // Notify group members via WebSocket if available
    if (req.io) {
      logStep('EMITTING_UPDATE', { groupId: updatedMessage.groupId });
      req.io
        .to(updatedMessage.groupId.toString())
        .emit('update-message', updatedMessage);
    }

    logStep('SUCCESS', { messageId: id });
    
    res.status(200).json({
      success: true,
      data: updatedMessage
    });
    
  } catch (error) {
    logStep('ERROR', { 
      error: error.message,
      stack: error.stack?.split('\n')[0]
    });
    
    if (error.name === 'ValidationError') {
      return next(new AppError(error.message, 400));
    }
    next(error);
  }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:id
// @access  Private
exports.deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find and validate message
    const message = await Message.findById(id);
    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Check permissions
    const isGroupAdmin = await StudyGroup.exists({
      _id: message.groupId,
      $or: [
        { 'members.user': req.user.id, 'members.role': 'admin' },
        { creator: req.user.id },
      ],
    });

    const canDelete = 
      message.sender.toString() === req.user.id || 
      req.user.role === 'admin' || 
      isGroupAdmin;

    if (!canDelete) {
      throw new AppError('Not authorized to delete this message', 403);
    }

    // Delete the message
    await Message.deleteOne({ _id: message._id });

    // Notify group members via WebSocket if available
    if (req.io) {
      req.io.to(message.groupId.toString()).emit('delete-message', { id: message._id });
    }

    log(`Message ${id} deleted by user ${req.user.id}`);
    
    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    log('Error in deleteMessage:', error);
    next(error);
  }
};
// @route   PUT /api/v1/messages/:id/react
// @access  Private
exports.reactToMessage = async (req, res, next) => {
  console.log('[MESSAGE] reactToMessage called', { 
    messageId: req.params.id,
    userId: req.user.id,
    body: req.body 
  });

  try {
    const { reaction } = req.body;
    const userId = req.user.id;
    const messageId = req.params.id;

    // Input validation
    if (!reaction || typeof reaction !== 'string') {
      console.log('[MESSAGE] Invalid reaction format', { reaction });
      return next(new AppError('Invalid reaction format', 400));
    }

    // Validate reaction type
    const validReactions = [
      'like', 'love', 'laugh', 'wow', 'sad', 'angry',
      'thumbsup', 'thumbsdown', 'heart', 'fire', 'clap',
      'pray', 'rocket', 'eyes', 'thinking', 'tada', 'check'
    ];

    if (!validReactions.includes(reaction)) {
      console.log('[MESSAGE] Invalid reaction type', { reaction });
      return next(new AppError('Invalid reaction type', 400));
    }

    console.log('[MESSAGE] Finding message', { messageId });
    
    // Find the message
    const message = await Message.findById(messageId).lean();
    if (!message) {
      console.log('[MESSAGE] Message not found', { messageId });
      return next(new AppError('Message not found', 404));
    }

    console.log('[MESSAGE] Checking group membership', { 
      groupId: message.groupId,
      userId 
    });

    // Check if user is a member of the group with proper error handling
    try {
      const isMember = await StudyGroup.exists({
        _id: message.groupId,
        'members.user': userId
      });

      if (!isMember) {
        console.log('[MESSAGE] User not authorized to react', { 
          groupId: message.groupId,
          userId 
        });
        return next(new AppError('Not authorized to react to messages in this group', 403));
      }
    } catch (groupError) {
      console.error('[MESSAGE] Error checking group membership:', groupError);
      return next(new AppError('Error verifying group membership', 500));
    }

    // Ensure reactions array exists
    if (!message.reactions) {
      message.reactions = [];
    }

    console.log('[MESSAGE] Updating reactions', { 
      currentReactions: message.reactions.length,
      userId 
    });

    console.log('[MESSAGE] Current reactions:', {
      count: message.reactions.length,
      userReactions: message.reactions
        .filter(r => r && r.user && r.user.toString() === userId)
        .map(r => r.reaction)
        .filter(Boolean) // Filter out any undefined values
    });

    // Check if user already has this exact reaction
    const hasExactReaction = message.reactions.some(
      r => r && r.user && r.user.toString() === userId && r.reaction === reaction
    );

    let query;

    if (hasExactReaction) {
      // User is removing this specific reaction
      console.log('[MESSAGE] Removing reaction', { userId, reaction });
      query = Message.findByIdAndUpdate(
        messageId,
        {
          $pull: {
            reactions: {
              user: new mongoose.Types.ObjectId(userId),
              reaction: reaction
            }
          }
        },
        { new: true, runValidators: true }
      );
    } else {
      // User is adding a new reaction - remove any existing reaction first
      console.log('[MESSAGE] Adding new reaction', { userId, reaction });
      query = Message.findOneAndUpdate(
        { _id: messageId },
        [
          {
            $set: {
              // First, remove any existing reaction from this user
              reactions: {
                $filter: {
                  input: '$reactions',
                  as: 'r',
                  cond: { $ne: ['$$r.user', new mongoose.Types.ObjectId(userId)] }
                }
              }
            }
          },
          {
            // Then add the new reaction
            $set: {
              reactions: {
                $concatArrays: [
                  '$reactions',
                  [{
                    user: new mongoose.Types.ObjectId(userId),
                    reaction: reaction
                  }]
                ]
              }
            }
          }
        ],
        { new: true, runValidators: true }
      );
    }

    // Execute the query with population
    let updatedMessage;
    try {
      updatedMessage = await query
        .populate('sender', 'name avatar')
        .populate('reactions.user', 'name avatar')
        .lean();

      if (!updatedMessage) {
        console.error('[MESSAGE] Failed to update message reactions', { messageId });
        return next(new AppError('Failed to update message reactions', 500));
      }

      // Ensure reactions array exists
      if (!updatedMessage.reactions) {
        updatedMessage.reactions = [];
      }

      console.log('[MESSAGE] Reaction updated successfully', { 
        messageId,
        reactions: updatedMessage.reactions ? updatedMessage.reactions.length : 0
      });
    } catch (dbError) {
      console.error('[MESSAGE] Database error when updating reactions:', dbError);
      return next(new AppError('Error updating message reactions', 500));
    }

    // Notify group members via WebSocket if available
    if (req.io) {
      console.log('[MESSAGE] Emitting message-reacted event', { 
        groupId: updatedMessage.groupId,
        messageId: updatedMessage._id 
      });
      req.io.to(updatedMessage.groupId.toString()).emit('message-reacted', updatedMessage);
    }

    res.json({
      success: true,
      data: updatedMessage
    });
  } catch (error) {
    console.error('[MESSAGE] Error in reactToMessage:', error);
    next(error);
  }
};

// @desc    Toggle pin status of a message
// @route   PUT /api/v1/messages/:id/pin
// @access  Private
exports.togglePinMessage = async (req, res, next) => {
  console.log('[MESSAGE] togglePinMessage called', { 
    messageId: req.params.id,
    userId: req.user.id
  });

  try {
    const { id: messageId } = req.params;
    const userId = req.user.id;

    console.log('[MESSAGE] Finding message', { messageId });
    
    // Find the message with basic validation
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      console.log('[MESSAGE] Invalid message ID format', { messageId });
      return next(new AppError('Invalid message ID', 400));
    }

    const message = await Message.findById(messageId);
    if (!message) {
      console.log('[MESSAGE] Message not found', { messageId });
      return next(new AppError('Message not found', 404));
    }

    // Ensure user ID is valid
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('[MESSAGE] Invalid user ID format', { userId });
      return next(new AppError('Invalid user ID', 400));
    }

    console.log('[MESSAGE] Checking group membership', { 
      groupId: message.groupId,
      userId 
    });

    // Check if user is a member of the group
    const isMember = await StudyGroup.exists({
      _id: message.groupId,
      'members.user': userId
    });

    if (!isMember) {
      console.log('[MESSAGE] User not authorized to pin message', { 
        groupId: message.groupId,
        userId 
      });
      return next(new AppError('Not authorized to pin messages in this group', 403));
    }

    // Check if user is a member of the group
    const group = await StudyGroup.findOne({
      _id: message.groupId,
      'members.user': userId
    });

    if (!group) {
      console.log('[MESSAGE] User is not a member of the group', { userId });
      return next(new AppError('You must be a member of the group to pin messages', 403));
    }

    // Toggle the pin status
    const newPinStatus = !message.isPinned;
    console.log('[MESSAGE] Toggling pin status', { 
      currentStatus: message.isPinned,
      newStatus: newPinStatus 
    });

    // Update the message with the new pin status
    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      { 
        isPinned: newPinStatus,
        // Store who pinned the message (without trying to populate)
        $addToSet: { pinnedBy: userId }
      },
      { new: true, runValidators: true }
    )
    .populate('sender', 'name avatar')
    .populate('reactions.user', 'name avatar');

    if (!updatedMessage) {
      console.error('[MESSAGE] Failed to update message pin status', { messageId });
      return next(new AppError('Failed to update message pin status', 500));
    }

    console.log('[MESSAGE] Pin status updated successfully', { 
      messageId,
      isPinned: updatedMessage.isPinned 
    });

    // Notify group members via WebSocket if available
    if (req.io) {
      console.log('[MESSAGE] Emitting message-pinned event', { 
        groupId: updatedMessage.groupId,
        messageId: updatedMessage._id,
        isPinned: updatedMessage.isPinned
      });
      req.io.to(updatedMessage.groupId.toString()).emit('message-pinned', updatedMessage);
    }

    res.json({
      success: true,
      data: updatedMessage,
    });
  } catch (error) {
    log('Error in togglePinMessage:', error);
    next(error);
  }
};

// @desc    Get message thread
// @desc    Reply to a message (create a thread)
// @route   POST /api/v1/messages/:id/reply
// @access  Private
exports.replyToMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Find the message being replied to
    const parentMessage = await Message.findById(id);
    if (!parentMessage) {
      return next(new AppError('Message not found', 404));
    }

    // Check if user is a member of the group
    const isMember = await StudyGroup.exists({
      _id: parentMessage.groupId,
      'members.user': userId
    });

    if (!isMember) {
      return next(new AppError('Not authorized to reply to this message', 403));
    }

    // Create the reply
    const reply = await Message.create({
      groupId: parentMessage.groupId,
      sender: userId,
      content,
      messageType: 'text',
      replyTo: parentMessage._id
    });

    // Populate sender info for the response
    const populatedReply = await Message.findById(reply._id)
      .populate('sender', 'name avatar')
      .populate('replyTo', 'content sender');

    // Notify group members via WebSocket if available
    if (req.io) {
      req.io.to(parentMessage.groupId.toString()).emit('new-message', {
        message: populatedReply,
        groupId: parentMessage.groupId
      });
    }

    res.status(201).json({
      success: true,
      data: populatedReply
    });
  } catch (error) {
    log('Error in replyToMessage:', error);
    next(error);
  }
};

// @route   GET /api/v1/messages/thread/:threadId
// @access  Private
exports.getMessageThread = async (req, res, next) => {
  try {
    const { messageId: threadId } = req.params; // Using messageId from route param
    const { limit = 50, before } = req.query;

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
      return next(new AppError('Invalid thread ID', 400));
    }

    // Find the root message of the thread
    const rootMessage = await Message.findById(threadId);
    if (!rootMessage) {
      return next(new AppError('Thread not found', 404));
    }

    // Check if user is a member of the group
    const isMember = await StudyGroup.exists({
      _id: rootMessage.groupId,
      'members.user': req.user.id
    });

    if (!isMember) {
      return next(new AppError('Not authorized to view this thread', 403));
    }

    // Build query for thread messages
    const query = {
      $or: [
        { _id: threadId }, // The original message
        { replyTo: threadId } // All replies to the original message
      ]
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'name avatar')
      .populate('reactions.user', 'name avatar')
      .populate('replyTo', 'content sender');

    // Mark messages as read
    await Message.updateMany(
      {
        _id: { 
          $in: messages
            .filter(m => !m.readBy.some(r => r.user.toString() === req.user.id) && 
                       m.sender.toString() !== req.user.id)
            .map(m => m._id) 
        }
      },
      { $addToSet: { readBy: { user: req.user.id } } }
    );

    res.json({
      success: true,
      data: messages.reverse() // Return oldest first
    });
  } catch (error) {
    log('Error in getMessageThread:', error);
    next(error);
  }
};
