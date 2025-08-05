const express = require('express');
const router = express.Router();

// Controllers
const {
  uploadResource,
  getResources,
  getResource,
  downloadResource,
  updateResource,
  deleteResource,
  uploadNewVersion,
  getResourceVersions,
  searchResources
} = require('../controllers/resourceController');

// Middleware
const { protect } = require('../middleware/auth');
const { validate, resourceValidationRules } = require('../middleware/validation');
const upload = require('../middleware/upload');

/**
 * @swagger
 * tags:
 *   name: Resources
 *   description: Study resource management and sharing
 */

// Protect all routes
router.use(protect);

// Resource ID parameter middleware
router.param('id', (req, res, next, id) => {
  req.params.resourceId = id;
  next();
});

/**
 * @swagger
 * /api/v1/resources/groups/{groupId}:
 *   post:
 *     summary: Upload a new resource
 *     tags: [Resources]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Resource uploaded successfully
 *       400:
 *         description: Invalid file or missing required fields
 */
router.post(
  '/groups/:groupId',
  upload.single('file'),
  resourceValidationRules.uploadResource(),
  validate,
  uploadResource
);

/**
 * @swagger
 * /api/v1/resources/groups/{groupId}:
 *   get:
 *     summary: Get all resources for a group
 *     tags: [Resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filter by tag
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [newest, oldest, name]
 *           default: newest
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of resources
 *       403:
 *         description: Not a member of this group
 */
router.get(
  '/groups/:groupId',
  resourceValidationRules.getResources(),
  validate,
  getResources
);

/**
 * @swagger
 * /api/v1/resources/search:
 *   get:
 *     summary: Search resources
 *     tags: [Resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: groupId
 *         schema:
 *           type: string
 *         description: Filter by group ID
 *     responses:
 *       200:
 *         description: List of matching resources
 */
router.get('/search', searchResources);

/**
 * @swagger
 * /api/v1/resources/{id}:
 *   get:
 *     summary: Get resource details
 *     tags: [Resources]
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
 *         description: Resource details
 *       404:
 *         description: Resource not found
 */
router.get('/:id', getResource);

/**
 * @swagger
 * /api/v1/resources/{id}/download:
 *   get:
 *     summary: Download a resource
 *     tags: [Resources]
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
 *         description: File download
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Resource not found
 */
router.get('/:id/download', downloadResource);

/**
 * @swagger
 * /api/v1/resources/{id}:
 *   put:
 *     summary: Update resource metadata
 *     tags: [Resources]
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
 *             $ref: '#/components/schemas/UpdateResourceInput'
 *     responses:
 *       200:
 *         description: Resource updated
 *       403:
 *         description: Not authorized to update this resource
 */
router.put(
  '/:id',
  resourceValidationRules.updateResource(),
  validate,
  updateResource
);

/**
 * @swagger
 * /api/v1/resources/{id}:
 *   delete:
 *     summary: Delete a resource
 *     tags: [Resources]
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
 *         description: Resource deleted
 *       403:
 *         description: Not authorized to delete this resource
 */
router.delete('/:id', deleteResource);

/**
 * @swagger
 * /api/v1/resources/{id}/versions:
 *   post:
 *     summary: Upload a new version of a resource
 *     tags: [Resources]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               versionNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: New version uploaded
 *       400:
 *         description: Invalid file or missing required fields
 */
router.post(
  '/:id/versions',
  upload.single('file'),
  resourceValidationRules.uploadNewVersion(),
  validate,
  uploadNewVersion
);

/**
 * @swagger
 * /api/v1/resources/{id}/versions:
 *   get:
 *     summary: Get version history of a resource
 *     tags: [Resources]
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
 *         description: List of versions
 *       403:
 *         description: Not authorized to view this resource
 */
router.get('/:id/versions', getResourceVersions);

module.exports = router;
