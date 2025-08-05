const express = require('express');
const { validationResult } = require('express-validator');
const multer = require('multer');
const { AppError } = require('../middleware/errorHandler');
const router = express.Router();

// File upload configuration
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Please upload only images'), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Controllers
const {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  searchGroups,
  getUserGroups,
  addGroupMember,
  removeGroupMember
} = require('../controllers/groupController');

// Middleware
const { protect } = require('../middleware/auth');
const { validate, groupValidationRules } = require('../middleware/validation');
const { requestLogger } = require('../middleware/utils');

/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Study group management
 */

// Apply authentication to all routes except public ones
router.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] [ROUTE:${req.method} ${req.path}] [1/3] Starting request processing`);
  
  // Add a response finish listener to log when the response is sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] [ROUTE:${req.method} ${req.path}] [X/3] Request completed in ${duration}ms`);
  });
  
  console.log(`[${new Date().toISOString()}] [ROUTE:${req.method} ${req.path}] [2/3] Applying protect middleware`);
  protect(req, res, (err) => {
    if (err) {
      console.error(`[${new Date().toISOString()}] [ROUTE:${req.method} ${req.path}] [PROTECT-ERROR]`, err);
      return next(err);
    }
    console.log(`[${new Date().toISOString()}] [ROUTE:${req.method} ${req.path}] [3/3] Protect middleware completed, moving to route handler`);
    next();
  });
});

/**
 * @swagger
 * /api/v1/groups:
 *   get:
 *     summary: Get all groups
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of groups
 */
router.get('/', (req, res, next) => {
  console.log('[ROUTE] GET /api/v1/groups - Route handler called');
  getGroups(req, res, next);
});

/**
 * @swagger
 * /api/v1/groups/search:
 *   get:
 *     summary: Search groups
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: List of matching groups
 */
router.get('/search', searchGroups);

/**
 * @swagger
 * /api/v1/groups/me:
 *   get:
 *     summary: Get current user's groups (alias for /users/me/groups)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's groups
 */
router.get('/me', (req, res, next) => {
  req.params.userId = req.user.id;
  next();
}, getUserGroups);

/**
 * @swagger
 * /api/v1/groups/users/me/groups:
 *   get:
 *     summary: Get current user's groups (legacy endpoint)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's groups
 */
router.get('/users/me/groups', (req, res, next) => {
  req.params.userId = req.user.id;
  next();
}, getUserGroups);

/**
 * @swagger
 * /api/v1/groups/users/:userId/groups:
 *   get:
 *     summary: Get user's groups by ID
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of user's groups
 */
router.get('/users/:userId/groups', getUserGroups);

/**
 * @swagger
 * /api/v1/groups:
 *   post:
 *     summary: Create a new group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateGroupInput'
 *     responses:
 *       201:
 *         description: Group created successfully
 *       400:
 *         description: Invalid input
 */
router.post(
  '/',
  (req, res, next) => {
    console.log('[ROUTE] POST /api/v1/groups - Route handler called');
    next();
  },
  requestLogger,
  // Handle file upload for group avatar
  upload.single('avatar'),
  (req, res, next) => {
    console.log('[ROUTE] Before validation rules');
    next();
  },
  // Spread the validation rules into the middleware chain
  ...groupValidationRules.createGroup(),
  (req, res, next) => {
    console.log('[ROUTE] After validation rules, before validate');
    next();
  },
  // Use the validate middleware to check for validation errors
  (req, res, next) => {
    console.log('[VALIDATE] Wrapper - before validate');
    validate([])(req, res, (err) => {
      console.log('[VALIDATE] Wrapper - after validate', { err: err?.message });
      if (err) return next(err);
      next();
    });
  },
  (req, res, next) => {
    console.log('[ROUTE] After validate, before controller');
    createGroup(req, res, next);
  }
);

// Group ID parameter middleware
router.param('id', (req, res, next, id) => {
  req.params.groupId = id;
  next();
});

/**
 * @swagger
 * /api/v1/groups/{id}:
 *   get:
 *     summary: Get group by ID
 *     tags: [Groups]
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
 *         description: Group details
 *       404:
 *         description: Group not found
 */
router.get('/:id', getGroup);

/**
 * @swagger
 * /api/v1/groups/{id}:
 *   put:
 *     summary: Update group
 *     tags: [Groups]
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
 *             $ref: '#/components/schemas/UpdateGroupInput'
 *     responses:
 *       200:
 *         description: Group updated successfully
 *       403:
 *         description: Not authorized to update this group
 */
router.put(
  '/:id',
  // Handle file upload for group avatar
  upload.single('avatar'),
  // Log the start of the request
  (req, res, next) => {
    req.requestId = Math.random().toString(36).substr(2, 8);
    req.requestTime = new Date().toISOString();
    
    // Log raw request details
    console.log(`[${req.requestTime}] [${req.requestId}] [ROUTE:PUT /api/v1/groups/${req.params.id}] Starting update request`);
    console.log(`[${req.requestTime}] [${req.requestId}] Headers:`, {
      ...req.headers,
      authorization: req.headers.authorization ? '***REDACTED***' : 'none'
    });
    
    // Log raw body and parsed body
    let bodyData = 'No body';
    try {
      bodyData = req.body || 'No body';
      console.log(`[${req.requestTime}] [${req.requestId}] Raw body:`, typeof req.body, req.body);
      console.log(`[${req.requestTime}] [${req.requestId}] Parsed body:`, JSON.stringify(bodyData, null, 2));
    } catch (e) {
      console.error(`[${req.requestTime}] [${req.requestId}] Error parsing body:`, e);
    }
    
    // Log request details
    console.log(`[${req.requestTime}] [${req.requestId}] Request details:`, {
      method: req.method,
      url: req.originalUrl,
      path: req.path,
      query: req.query,
      params: req.params,
      bodyKeys: bodyData && typeof bodyData === 'object' ? Object.keys(bodyData) : 'N/A',
      contentType: req.get('content-type'),
      contentLength: req.get('content-length')
    });
    
    // Add body data to request for debugging
    req._debugBody = bodyData;
    
    next();
  },
  // Apply validation rules and validate
  ...groupValidationRules.updateGroup().map(middleware => 
    (req, res, next) => {
      console.log(`[${req.requestTime}] [${req.requestId}] [VALIDATION] Running validation for:`, {
        field: middleware.fields?.[0] || 'unknown',
        message: middleware.message || 'No custom message'
      });
      middleware(req, res, next);
    }
  ),
  // Run the validate middleware
  (req, res, next) => {
    console.log(`[${req.requestTime}] [${req.requestId}] [VALIDATION] Validating request`);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error(`[${req.requestTime}] [${req.requestId}] [VALIDATION] Validation failed:`, errors.array());
      return next(new AppError('Validation failed', 400, { errors: errors.array() }));
    }
    console.log(`[${req.requestTime}] [${req.requestId}] [VALIDATION] Validation passed`);
    next();
  },
  // Log validation success and proceed to controller
  (req, res, next) => {
    console.log(`[${req.requestTime}] [${req.requestId}] [ROUTE:PUT /api/v1/groups/${req.params.id}] Validation passed, processing update`);
    next();
  },
  // Handle the update
  (req, res, next) => {
    console.log(`[${req.requestTime}] [${req.requestId}] [CONTROLLER] Starting updateGroup controller`);
    const originalJson = res.json;
    
    // Wrap the response to log when it's sent
    res.json = function(data) {
      console.log(`[${req.requestTime}] [${req.requestId}] [CONTROLLER] Sending response:`, JSON.stringify(data).substring(0, 200) + '...');
      originalJson.call(this, data);
    };
    
    // Call the updateGroup controller
    updateGroup(req, res, next);
  },
  // Error handling middleware
  (err, req, res, next) => {
    console.error(`[${req.requestTime || new Date().toISOString()}] [${req.requestId}] [ERROR] Update failed:`, {
      error: err.message,
      stack: err.stack,
      params: req.params,
      body: req.body
    });
    
    if (!res.headersSent) {
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/groups/{id}:
 *   delete:
 *     summary: Delete group
 *     tags: [Groups]
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
 *         description: Group deleted successfully
 *       403:
 *         description: Not authorized to delete this group
 */
router.delete('/:id', deleteGroup);

/**
 * @swagger
 * /api/v1/groups/{id}/join:
 *   post:
 *     summary: Join a group
 *     tags: [Groups]
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
 *         description: Successfully joined group
 *       400:
 *         description: Already a member or group is full
 */
router.post('/:id/join', joinGroup);

/**
 * @swagger
 * /api/v1/groups/{id}/leave:
 *   post:
 *     summary: Leave a group
 *     tags: [Groups]
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
 *         description: Successfully left group
 *       400:
 *         description: Cannot leave as the only admin
 */
router.post('/:id/leave', leaveGroup);

/**
 * @swagger
 * /api/v1/groups/{id}/members:
 *   get:
 *     summary: Get group members
 *     tags: [Groups]
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
 *         description: List of group members
 */
router.get('/:id/members', getGroupMembers);

/**
 * @swagger
 * /api/v1/groups/{groupId}/members:
 *   post:
 *     summary: Add member to group (admin only)
 *     tags: [Groups]
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
 *             type: object
 *             required:
 *               - userId
 *               - role
 *             properties:
 *               userId:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [member, admin]
 *     responses:
 *       200:
 *         description: Member added successfully
 *       403:
 *         description: Not authorized to add members
 */
router.post(
  '/:groupId/members',
  groupValidationRules.addMember(),
  validate,
  addGroupMember
);

/**
 * @swagger
 * /api/v1/groups/{groupId}/members/{userId}:
 *   delete:
 *     summary: Remove member from group (admin only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       403:
 *         description: Not authorized to remove members
 */
router.delete('/:groupId/members/:userId', removeGroupMember);

module.exports = router;
