const { AppError } = require('../middleware/errorHandler');
const Resource = require('../models/Resource');
const StudyGroup = require('../models/StudyGroup');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// Helper for consistent logging
const log = (message, data) => {
  logger.info(`[RESOURCE] ${message}`, data || '');
};

// Constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Helper function to check group membership and permissions
const checkGroupAccess = async (groupId, userId, isAdmin = false) => {
  const group = await StudyGroup.findOne({
    _id: groupId,
    'members.user': userId,
    ...(isAdmin && { 'members.role': 'admin' })
  });
  
  if (!group) {
    throw new AppError('Not authorized to access this resource', 403);
  }
  return group;
};

// Helper function to handle file upload
const handleFileUpload = async (file, groupId) => {
  if (!file) {
    throw new AppError('Please upload a file', 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError(`File size should be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`, 400);
  }

  const fileExt = path.extname(file.name);
  const fileName = `resource_${groupId}_${Date.now()}${fileExt}`;
  const uploadPath = path.join(UPLOAD_DIR, fileName);

  try {
    await file.mv(uploadPath);
    return {
      fileName,
      filePath: `/uploads/${fileName}`,
      fileType: file.mimetype,
      fileSize: file.size
    };
  } catch (error) {
    log('File upload failed', { error: error.message });
    throw new AppError('Failed to upload file', 500);
  }
};

// @desc    Upload resource
// @route   POST /api/groups/:groupId/resources
// @access  Private
exports.uploadResource = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { title, description, category, tags } = req.body;
    const file = req.files?.file;

    // Verify group membership
    await checkGroupAccess(groupId, req.user.id);
    
    // Handle file upload
    const fileInfo = await handleFileUpload(file, groupId);

    // Create resource
    const resource = await Resource.create({
      groupId,
      uploadedBy: req.user.id,
      title: title || file.name,
      description: description || '',
      fileUrl: fileInfo.filePath,
      fileName: file.name,
      fileType: fileInfo.fileType,
      fileSize: fileInfo.fileSize,
      category: category || 'other',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
    });

    log(`Resource uploaded by user ${req.user.id} to group ${groupId}`, { resourceId: resource._id });
    
    res.status(201).json({
      success: true,
      data: await resource.populate('uploadedBy', 'name avatar')
    });
  } catch (error) {
    log('Error in uploadResource:', error);
    next(error);
  }
};

// @desc    Get all resources for a group
// @route   GET /api/groups/:groupId/resources
// @access  Private
exports.getResources = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 10, category, search } = req.query;
    const skip = (page - 1) * limit;

    // Verify group membership
    await checkGroupAccess(groupId, req.user.id);

    // Build query
    const query = { groupId };
    if (category) query.category = category;
    if (search) query.$text = { $search: search };

    // Get resources with pagination
    const [total, resources] = await Promise.all([
      Resource.countDocuments(query),
      Resource.find(query)
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('uploadedBy', 'name avatar')
    ]);

    res.json({
      success: true,
      count: resources.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: resources
    });
  } catch (error) {
    log('Error in getResources:', error);
    next(error);
  }
};

// @desc    Get single resource
// @route   GET /api/resources/:id
// @access  Private
exports.getResource = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id)
      .populate('uploadedBy', 'name avatar');

    if (!resource) {
      throw new AppError('Resource not found', 404);
    }

    // Verify group membership
    await checkGroupAccess(resource.groupId, req.user.id);
    
    res.json({
      success: true,
      data: resource
    });
  } catch (error) {
    log('Error in getResource:', error);
    next(error);
  }
};

// @desc    Download resource
// @route   GET /api/resources/:id/download
// @access  Private
exports.downloadResource = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      throw new AppError('Resource not found', 404);
    }

    // Verify group membership
    await checkGroupAccess(resource.groupId, req.user.id);

    const filePath = path.join(__dirname, '..', resource.fileUrl);
    
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new AppError('File not found', 404);
    }

    // Increment download count
    resource.downloadCount += 1;
    await resource.save();

    // Send file
    res.download(filePath, resource.fileName, (err) => {
      if (err) {
        log('Error downloading file:', { error: err.message, resourceId: resource._id });
        next(new AppError('Error downloading file', 500));
      }
    });
  } catch (error) {
    log('Error in downloadResource:', error);
    next(error);
  }
};

// @desc    Update resource
// @route   PUT /api/resources/:id
// @access  Private
exports.updateResource = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, category, tags, isPinned } = req.body;

    const resource = await Resource.findById(id);
    if (!resource) {
      throw new AppError('Resource not found', 404);
    }

    // Check permissions
    const isAdmin = await StudyGroup.exists({
      _id: resource.groupId,
      $or: [
        { 'members.user': req.user.id, 'members.role': 'admin' },
        { creator: req.user.id }
      ]
    });

    const canUpdate = resource.uploadedBy.toString() === req.user.id || 
                    req.user.role === 'admin' || 
                    isAdmin;

    if (!canUpdate) {
      throw new AppError('Not authorized to update this resource', 403);
    }

    // Update fields
    const updates = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category) updates.category = category;
    if (tags) updates.tags = tags.split(',').map(tag => tag.trim());
    if (isPinned !== undefined) updates.isPinned = isPinned;

    const updatedResource = await Resource.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    }).populate('uploadedBy', 'name avatar');

    log(`Resource ${id} updated by user ${req.user.id}`, { updates });
    
    res.json({
      success: true,
      data: updatedResource
    });
  } catch (error) {
    log('Error in updateResource:', error);
    next(error);
  }
};

// @desc    Delete resource
// @route   DELETE /api/resources/:id
// @access  Private
exports.deleteResource = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      throw new AppError('Resource not found', 404);
    }

    // Check permissions
    const isAdmin = await StudyGroup.exists({
      _id: resource.groupId,
      $or: [
        { 'members.user': req.user.id, 'members.role': 'admin' },
        { creator: req.user.id }
      ]
    });

    const canDelete = resource.uploadedBy.toString() === req.user.id || 
                    req.user.role === 'admin' || 
                    isAdmin;

    if (!canDelete) {
      throw new AppError('Not authorized to delete this resource', 403);
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, '..', resource.fileUrl);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      log('Error deleting file:', { error: error.message, filePath });
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await resource.remove();

    log(`Resource ${resource._id} deleted by user ${req.user.id}`);
    
    res.json({
      success: true,
      data: {}
    });
  } catch (error) {
    log('Error in deleteResource:', error);
    next(error);
  }
};

// @desc    Upload new version of a resource
// @route   POST /api/resources/:id/version
// @access  Private
exports.uploadNewVersion = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      throw new AppError('Resource not found', 404);
    }

    // Check permissions
    if (resource.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('Not authorized to update this resource', 403);
    }

    const file = req.files?.file;
    if (!file) {
      throw new AppError('Please upload a file', 400);
    }

    // Handle file upload
    const fileInfo = await handleFileUpload(file, resource.groupId);

    // Add current version to previous versions
    resource.previousVersions.push({
      fileUrl: resource.fileUrl,
      fileName: resource.fileName,
      fileType: resource.fileType,
      fileSize: resource.fileSize,
      updatedAt: resource.updatedAt,
      updatedBy: resource.uploadedBy,
      version: resource.version,
    });

    // Update resource with new version
    resource.fileUrl = fileInfo.filePath;
    resource.fileName = file.name;
    resource.fileType = fileInfo.fileType;
    resource.fileSize = fileInfo.fileSize;
    resource.uploadedBy = req.user.id;
    resource.version += 1;

    await resource.save();

    log(`New version uploaded for resource ${resource._id} by user ${req.user.id}`, { version: resource.version });
    
    res.json({
      success: true,
      data: await resource.populate('uploadedBy', 'name avatar')
    });
  } catch (error) {
    log('Error in uploadNewVersion:', error);
    next(error);
  }
};

// @desc    Get resource versions
// @route   GET /api/resources/:id/versions
// @access  Private
exports.getResourceVersions = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    
    if (!resource) {
      return next(new AppError('Resource not found', 404));
    }
    
    // Check if user has access to view this resource's versions
    await checkGroupAccess(resource.group, req.user.id);
    
    // Get all versions of this resource, sorted by version number (newest first)
    const versions = await Resource.find({
      $or: [
        { _id: resource._id },
        { originalResource: resource.originalResource || resource._id }
      ]
    }).sort('-versionNumber');
    
    res.json({
      success: true,
      count: versions.length,
      data: versions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search resources across groups
// @route   GET /api/resources/search
// @access  Private
exports.searchResources = async (req, res, next) => {
  try {
    const { q: searchQuery, groupId, type, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    // Build the base query
    const query = {};
    
    // Add search query if provided
    if (searchQuery) {
      query.$text = { $search: searchQuery };
    }
    
    // Filter by group if specified
    if (groupId) {
      // Check if user is a member of the specified group
      const isMember = await StudyGroup.exists({
        _id: groupId,
        'members.user': req.user.id
      });
      
      if (!isMember) {
        return next(new AppError('Not authorized to access resources in this group', 403));
      }
      
      query.groupId = groupId;
    } else {
      // If no group specified, only show resources from groups the user is a member of
      const userGroups = await StudyGroup.find({
        'members.user': req.user.id
      }).select('_id');
      
      query.groupId = { $in: userGroups.map(g => g._id) };
    }
    
    // Filter by resource type if specified
    if (type) {
      query.fileType = { $regex: type, $options: 'i' };
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute count and find queries in parallel
    const [total, resources] = await Promise.all([
      Resource.countDocuments(query),
      Resource.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('groupId', 'name')
        .populate('uploadedBy', 'name avatar')
    ]);
    
    res.json({
      success: true,
      count: resources.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: resources
    });
  } catch (error) {
    log('Error in searchResources:', error);
    next(error);
  }
};
