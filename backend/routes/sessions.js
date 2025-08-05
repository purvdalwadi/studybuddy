const express = require('express');
console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] Loading sessions router`);
const router = express.Router({ mergeParams: true });
console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] Router created`);
const {
  createSession,
  getSessions,
  getSession,
  updateSession,
  deleteSession,
  rsvpToSession,
  getSessionsByGroup,
  getUpcomingSessions,
  getSessionsByDateRange
} = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');
const { validate, sessionValidationRules } = require('../middleware/validation');

/**
 * @swagger
 * tags:
 *   name: StudySessions
 *   description: Study session management
 */

// Log all requests for debugging
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] [1/3] Request received: ${req.method} ${req.path}`, {
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
    method: req.method,
    user: req.user ? { id: req.user._id, email: req.user.email } : 'No user',
    params: req.params,
    query: req.query
  });
  next();
});

// Apply protect middleware
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] [2/3] Applying protect middleware`);
  protect(req, res, next);
});

// Log after protect middleware
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] [3/3] After protect middleware`);
  next();
});

/**
 * @swagger
 * /api/v1/study-sessions/group/{groupId}:
 *   get:
 *     summary: Get all sessions for a specific group
 *     tags: [StudySessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of sessions for the group
 */
router.get('/group/:groupId', getSessionsByGroup);

/**
 * @swagger
 * /api/v1/study-sessions/upcoming:
 *   get:
 *     summary: Get upcoming study sessions
 *     tags: [StudySessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of upcoming sessions
 */
router.get('/upcoming', getUpcomingSessions);

/**
 * @swagger
 * /api/v1/study-sessions/range:
 *   get:
 *     summary: Get sessions within a date range
 *     tags: [StudySessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date (ISO 8601)
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date (ISO 8601)
 *     responses:
 *       200:
 *         description: List of sessions within date range
 */
router.get('/range', getSessionsByDateRange);

/**
 * @swagger
 * /api/v1/study-sessions/groups/{groupId}:
 *   post:
 *     summary: Create a new study session for a group
 *     tags: [StudySessions]
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
 *             $ref: '#/components/schemas/CreateSessionInput'
 *     responses:
 *       201:
 *         description: Session created successfully
 *       400:
 *         description: Invalid input data
 */
// Add a debug wrapper for the createSession controller
const debugCreateSession = async (req, res, next) => {
  console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] [3/4] Create session controller started`, {
    groupId: req.params.groupId,
    body: req.body,
    user: req.user ? { id: req.user._id, email: req.user.email } : 'No user'
  });
  
  try {
    await createSession(req, res, next);
    console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] [4/4] Create session controller completed`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [SESSION-ROUTE] Create session error:`, error);
    next(error);
  }
};

// Add route with validation and debug middleware
router.post(
  '/groups/:groupId',
  // Log request details
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] [1/3] Request received`, {
      method: req.method,
      path: req.path,
      params: req.params,
      body: req.body,
      query: req.query
    });
    next();
  },
  // Validation middleware with logging
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] [2/3] Starting validation`);
    const validationMiddleware = validate(sessionValidationRules.create());
    validationMiddleware(req, res, (err) => {
      if (err) {
        console.error(`[${new Date().toISOString()}] [SESSION-ROUTE] Validation error:`, err);
        return next(err);
      }
      console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] [2/3] Validation completed`);
      next();
    });
  },
  // Controller with error handling
  async (req, res, next) => {
    try {
      console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] [3/3] Controller started`);
      await createSession(req, res, next);
      console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] [3/3] Controller completed`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [SESSION-ROUTE] Controller error:`, error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/study-sessions:
 *   get:
 *     summary: Get all study sessions (with filters)
 *     tags: [StudySessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: group
 *         schema:
 *           type: string
 *         description: Filter by group ID
 *       - in: query
 *         name: upcoming
 *         schema:
 *           type: boolean
 *         description: Filter upcoming sessions only
 *     responses:
 *       200:
 *         description: List of study sessions
 */
router.get('/', getSessions);

/**
 * @swagger
 * /api/v1/study-sessions/{id}:
 *   get:
 *     summary: Get a single study session
 *     tags: [StudySessions]
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
 *         description: Session details
 *       404:
 *         description: Session not found
 */
router.get('/:id', getSession);

/**
 * @swagger
 * /api/v1/study-sessions/{id}:
 *   put:
 *     summary: Update a study session
 *     tags: [StudySessions]
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
 *             $ref: '#/components/schemas/UpdateSessionInput'
 *     responses:
 *       200:
 *         description: Session updated successfully
 *       403:
 *         description: Not authorized to update this session
 */
router.put(
  '/:id',
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] Update session endpoint hit:`, {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: req.body,
      user: req.user ? { id: req.user._id } : 'No user'
    });
    next();
  },
  // Debug logging before validation
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] Before validate middleware`);
    console.log(`[${new Date().toISOString()}] [DEBUG] Request body:`, JSON.stringify(req.body));
    next();
  },
  // Apply validation middleware
  validate(sessionValidationRules.update()),
  // Debug logging after validation
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] After validate, before controller`);
    next();
  },
  // Route handler
  updateSession,
  // Final error handler in case controller doesn't send response
  (req, res) => {
    console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] After update controller`);
    if (!res.headersSent) {
      console.error(`[${new Date().toISOString()}] [SESSION-ROUTE] No response sent by update controller!`);
      res.status(500).json({ 
        success: false, 
        message: 'No response from update controller',
        error: 'No response was sent by the update controller'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/study-sessions/{id}:
 *   delete:
 *     summary: Delete a study session
 *     tags: [StudySessions]
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
 *         description: Session deleted successfully
 *       403:
 *         description: Not authorized to delete this session
 */
router.delete('/:id', deleteSession);

/**
 * @swagger
 * /api/v1/study-sessions/{id}/rsvp:
 *   post:
 *     summary: RSVP to a study session
 *     tags: [StudySessions]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [going, maybe, not_going]
 *     responses:
 *       200:
 *         description: RSVP status updated
 *       400:
 *         description: Invalid RSVP status
 */
// Add debug logging for RSVP endpoint
console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] Setting up RSVP endpoint: PUT /:id/rsvp`);

router.put(
  '/:id/rsvp',
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] RSVP endpoint hit:`, {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: req.body,
      user: req.user ? { id: req.user._id } : 'No user'
    });
    next();
  },
  // Use validate with the validation rules
  validate(sessionValidationRules.rsvpToSession()),
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] After validate, before controller`);
    next();
  },
  rsvpToSession,
  (req, res) => {
    console.log(`[${new Date().toISOString()}] [SESSION-ROUTE] After controller`);
    // This should not be necessary as the controller should send a response
    if (!res.headersSent) {
      console.error(`[${new Date().toISOString()}] [SESSION-ROUTE] No response sent by controller!`);
      res.status(500).json({ 
        success: false, 
        message: 'No response from controller',
        error: 'No response was sent by the controller'
      });
    }
  }
);

module.exports = router;
