const express = require('express');
const router = express.Router();

// Controllers
const userController = require('../controllers/userController');

// Middleware
const { protect, authorize, adminOrGroupAdmin } = require('../middleware/auth');
const { validate, userValidationRules } = require('../middleware/validation');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and profiles
 */

// Apply protection to all routes
router.use(protect);

// Current User Routes
/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
router.get('/me', userController.getMe, userController.getUser);

/**
 * @swagger
 * /api/v1/users/update-me:
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserInput'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid input data
 */
router.put(
  '/update-me',
  userValidationRules.updateProfile(),
  validate,
  userController.updateMe
);

/**
 * @swagger
 * /api/v1/users/delete-me:
 *   delete:
 *     summary: Delete current user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Account deleted successfully
 *       401:
 *         description: Not authenticated
 */
router.delete('/delete-me', userController.deleteMe);

/**
 * @swagger
 * /api/v1/users/upload-photo:
 *   post:
 *     summary: Upload user profile photo
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Photo uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     photo:
 *                       type: string
 *                       description: Filename of the uploaded photo
 */
router.post(
  '/upload-photo',
  userController.uploadUserPhoto,
  userController.resizeUserPhoto,
  (req, res) => {
    res.status(200).json({
      status: 'success',
      data: {
        photo: req.file ? req.file.filename : undefined
      }
    });
  }
);

// Admin or Group Admin Routes
router.use(protect);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Get all users (Admin or Group Admin/Creator)
 *     description: |
 *       - Admins can see all users
 *       - Group admins/creators can see users when providing a groupId query parameter
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: groupId
 *         schema:
 *           type: string
 *         description: Required for group admins/creators to list users
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Group ID is required for non-admin users
 *       403:
 *         description: Not authorized to access this resource
 */
router.route('/')
  .get(adminOrGroupAdmin, userController.getUsers);

// Admin-only routes
router.use(authorize('admin'));

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Create a new user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input data
 */
router.route('/')
  .post(
    userValidationRules.register(),
    validate,
    userController.createUser
  );

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user by ID (Admin only)
 *     tags: [Users]
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
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *   put:
 *     summary: Update user (Admin only)
 *     tags: [Users]
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
 *             $ref: '#/components/schemas/UpdateUserInput'
 *     responses:
 *       200:
 *         description: User updated successfully
 *   delete:
 *     summary: Delete user (Admin only)
 *     tags: [Users]
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
 *         description: User deleted successfully
 */
router.route('/:id')
  .get(userController.getUser)
  .put(
    userValidationRules.updateProfile(),
    validate,
    userController.updateUser
  )
  .delete(userController.deleteUser);

module.exports = router;
