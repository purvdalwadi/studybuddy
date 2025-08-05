const express = require('express');
const { validationResult } = require('express-validator');
const router = express.Router();

// Controllers
const {
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  reactToMessage,
  togglePinMessage,
  getMessageThread,
  replyToMessage
} = require('../controllers/messageController');

// Middleware
const { protect } = require('../middleware/auth');

const { validate, messageValidationRules } = require('../middleware/validation');

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: Real-time messaging functionality
 */

// Production-ready logging can be added here if needed

// Protect all routes
router.use(protect);

// Log after protect middleware
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] [${req.requestId || 'unknown'}] [AUTH-PASSED] User authenticated:`, {
    userId: req.user?._id,
    email: req.user?.email
  });
  next();
});

/**
 * @swagger
 * /api/v1/messages/groups/{groupId}:
 *   get:
 *     summary: Get messages for a group
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Get messages before this timestamp
 *     responses:
 *       200:
 *         description: List of messages
 *       403:
 *         description: Not a member of this group
 */
router.get('/groups/:groupId', 
  // Log the start of the request
  (req, res, next) => {
    req.requestId = req.requestId || Math.random().toString(36).substring(2, 10);
    console.log(`[${new Date().toISOString()}] [${req.requestId}] [ROUTE] GET /groups/:groupId`);
    next();
  },
  // Apply validation
  messageValidationRules.getMessages(),
  // Handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error(`[${new Date().toISOString()}] [${req.requestId || 'unknown'}] [VALIDATION] Failed:`, errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  },
  // Handle the request
  async (req, res, next) => {
    try {
      await getMessages(req, res, next);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [${req.requestId || 'unknown'}] [ERROR]`, error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/messages/groups/{groupId}:
 *   post:
 *     summary: Send a message to a group
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageInput'
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       403:
 *         description: Not a member of this group
 */
router.post(
  '/groups/:groupId',
  // Initial logging middleware
  (req, res, next) => {
    req.requestId = req.requestId || Math.random().toString(36).substring(2, 10);
    console.log(`[${new Date().toISOString()}] [${req.requestId}] [ROUTE] Starting message send validation`);
    next();
  },
  // Apply validation rules
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [${req.requestId}] [VALIDATION] Applying message validation rules`);
    const validationChain = messageValidationRules.send();
    validationChain.forEach(validation => validation(req, res, next));
  },
  // Handle validation results
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [${req.requestId}] [VALIDATION] Processing validation results`);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error(`[${new Date().toISOString()}] [${req.requestId}] [VALIDATION] Validation failed:`, errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    console.log(`[${new Date().toISOString()}] [${req.requestId}] [VALIDATION] Validation successful, proceeding to controller`);
    next();
  },
  // Finally, call the controller
  sendMessage
);

/**
 * @swagger
 * /api/v1/messages/thread/{messageId}:
 *   get:
 *     summary: Get message thread (replies to a message)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message thread retrieved
 *       403:
 *         description: Not authorized to view this message
 */
router.get('/thread/:messageId', getMessageThread);

// Message ID parameter middleware
router.param('id', (req, res, next, id) => {
  req.params.messageId = id;
  next();
});

/**
 * @swagger
 * /api/v1/messages/{id}/react:
 *   put:
 *     summary: React to a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reaction
 *             properties:
 *               reaction:
 *                 type: string
 *                 enum: [like, love, laugh, wow, sad, angry, thumbsup, thumbsdown, heart, fire, clap, pray, rocket, eyes, thinking, tada, check]
 *     responses:
 *       200:
 *         description: Reaction updated successfully
 *       400:
 *         description: Invalid reaction type
 *       404:
 *         description: Message not found
 *       403:
 *         description: Not authorized to react to this message
 */
router.put('/:id/react', reactToMessage);

/**
 * @swagger
 * /api/v1/messages/{id}:
 *   put:
 *     summary: Update a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMessageInput'
 *     responses:
 *       200:
 *         description: Message updated
 *       403:
 *         description: Not authorized to update this message
 */
// Update message route with proper validation chaining
router.put('/:id', 
  // Log request start
  (req, res, next) => {
    req.requestId = req.requestId || Math.random().toString(36).substr(2, 8);
    console.log(`[${new Date().toISOString()}] [${req.requestId}] [ROUTE] PUT /api/v1/messages/${req.params.id}`);
    next();
  },
  
  // Log before validation
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [${req.requestId}] [VALIDATION] Starting validation`);
    next();
  },
  
  // Run validation middleware with rules
  validate(messageValidationRules.updateMessage()),
  
  // Log before controller
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [${req.requestId}] [CONTROLLER] Starting updateMessage`);
    next();
  },
  
  // Handle the update
  updateMessage
);

/**
 * @swagger
 * /api/v1/messages/{id}:
 *   delete:
 *     summary: Delete a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Message deleted
 *       403:
 *         description: Not authorized to delete this message
 */
router.delete('/:id', deleteMessage);

/**
 * @swagger
 * /api/v1/messages/{id}/react:
 *   post:
 *     summary: React to a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emoji
 *             properties:
 *               emoji:
 *                 type: string
 *                 description: Emoji to react with
 *     responses:
 *       200:
 *         description: Reaction added/updated
 *       400:
 *         description: Invalid emoji
 */
router.post('/:id/react', 
  // Log the start of the request
  (req, res, next) => {
    req.requestId = req.requestId || Math.random().toString(36).substring(2, 10);
    console.log(`[${new Date().toISOString()}] [${req.requestId}] [ROUTE] POST /:id/react`);
    next();
  },
  // Apply validation
  messageValidationRules.reactToMessage(),
  // Handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error(`[${new Date().toISOString()}] [${req.requestId || 'unknown'}] [VALIDATION] Failed:`, errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  },
  // Handle the request
  async (req, res, next) => {
    try {
      await reactToMessage(req, res, next);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [${req.requestId || 'unknown'}] [ERROR]`, error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/messages/{id}/pin:
 *   put:
 *     summary: Toggle pin status of a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message pin status toggled
 *       403:
 *         description: Not authorized to pin this message
 */
router.put('/:id/pin', togglePinMessage);

/**
 * @swagger
 * /api/v1/messages/{id}/reply:
 *   post:
 *     summary: Reply to a message (create a thread)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: The content of the reply
 *     responses:
 *       201:
 *         description: Reply sent successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Not authorized to reply to this message
 */
router.post(
  '/:id/reply',
  // Log the start of the request
  (req, res, next) => {
    req.requestId = req.requestId || Math.random().toString(36).substring(2, 10);
    console.log(`[${new Date().toISOString()}] [${req.requestId}] [ROUTE] POST /:id/reply`);
    next();
  },
  // Apply validation
  messageValidationRules.send(),
  // Handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error(`[${new Date().toISOString()}] [${req.requestId || 'unknown'}] [VALIDATION] Failed:`, errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  },
  // Handle the request
  async (req, res, next) => {
    try {
      await replyToMessage(req, res, next);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [${req.requestId || 'unknown'}] [ERROR]`, error);
      next(error);
    }
  }
);

module.exports = router;
