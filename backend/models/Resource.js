const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyGroup',
      required: [true, 'Please add a group ID'],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please add an uploader ID'],
    },
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
      maxlength: [200, 'Title cannot be more than 200 characters'],
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot be more than 1000 characters'],
    },
    fileUrl: {
      type: String,
      required: [true, 'Please add a file URL'],
      trim: true,
    },
    fileName: {
      type: String,
      required: [true, 'Please add a file name'],
      trim: true,
    },
    fileType: {
      type: String,
      required: [true, 'Please add a file type'],
      trim: true,
    },
    fileSize: {
      type: Number,
      required: [true, 'Please add file size in bytes'],
    },
    category: {
      type: String,
      enum: [
        'notes',
        'assignment',
        'presentation',
        'book',
        'paper',
        'other',
      ],
      default: 'other',
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    downloadCount: {
      type: Number,
      default: 0,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    accessLevel: {
      type: String,
      enum: ['public', 'members', 'restricted'],
      default: 'members',
    },
    version: {
      type: Number,
      default: 1,
    },
    previousVersions: [
      {
        fileUrl: String,
        fileName: String,
        fileType: String,
        fileSize: Number,
        updatedAt: Date,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        version: Number,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add index for better query performance
resourceSchema.index({ groupId: 1, category: 1, isPinned: -1, createdAt: -1 });
resourceSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Virtual for file extension
resourceSchema.virtual('fileExtension').get(function () {
  if (!this.fileName) return '';
  return this.fileName.split('.').pop().toLowerCase();
});

// Virtual for formatted file size
resourceSchema.virtual('formattedSize').get(function () {
  if (!this.fileSize) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = this.fileSize;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
});

// Virtual for icon based on file type
resourceSchema.virtual('icon').get(function () {
  const extensions = {
    // Documents
    'pdf': 'file-pdf',
    'doc': 'file-word',
    'docx': 'file-word',
    'txt': 'file-text',
    'rtf': 'file-text',
    'odt': 'file-text',
    // Spreadsheets
    'xls': 'file-excel',
    'xlsx': 'file-excel',
    'csv': 'file-csv',
    'ods': 'file-csv',
    // Presentations
    'ppt': 'file-powerpoint',
    'pptx': 'file-powerpoint',
    'odp': 'file-powerpoint',
    // Code
    'js': 'file-code',
    'jsx': 'file-code',
    'ts': 'file-code',
    'tsx': 'file-code',
    'html': 'file-code',
    'css': 'file-code',
    'json': 'file-code',
    'py': 'file-code',
    'java': 'file-code',
    'c': 'file-code',
    'cpp': 'file-code',
    'cs': 'file-code',
    'php': 'file-code',
    'rb': 'file-code',
    'go': 'file-code',
    'rs': 'file-code',
    'swift': 'file-code',
    'kt': 'file-code',
    'sh': 'file-code',
    // Archives
    'zip': 'file-archive',
    'rar': 'file-archive',
    '7z': 'file-archive',
    'tar': 'file-archive',
    'gz': 'file-archive',
    'bz2': 'file-archive',
    // Images
    'jpg': 'file-image',
    'jpeg': 'file-image',
    'png': 'file-image',
    'gif': 'file-image',
    'bmp': 'file-image',
    'svg': 'file-image',
    'webp': 'file-image',
    'tiff': 'file-image',
    // Audio
    'mp3': 'file-audio',
    'wav': 'file-audio',
    'ogg': 'file-audio',
    'm4a': 'file-audio',
    'flac': 'file-audio',
    'aac': 'file-audio',
    // Video
    'mp4': 'file-video',
    'webm': 'file-video',
    'mov': 'file-video',
    'avi': 'file-video',
    'mkv': 'file-video',
    'flv': 'file-video',
    'wmv': 'file-video',
  };

  const ext = this.fileExtension.toLowerCase();
  return extensions[ext] || 'file';
});

// Method to increment download count
resourceSchema.methods.incrementDownloadCount = async function () {
  this.downloadCount += 1;
  await this.save();
  return this.downloadCount;
};

// Method to create a new version
resourceSchema.methods.createNewVersion = async function (newFileData, userId) {
  // Add current version to previous versions
  this.previousVersions.push({
    fileUrl: this.fileUrl,
    fileName: this.fileName,
    fileType: this.fileType,
    fileSize: this.fileSize,
    updatedAt: this.updatedAt,
    updatedBy: this.uploadedBy,
    version: this.version,
  });

  // Update current file data
  this.fileUrl = newFileData.fileUrl;
  this.fileName = newFileData.fileName;
  this.fileType = newFileData.fileType;
  this.fileSize = newFileData.fileSize;
  this.uploadedBy = userId;
  this.version += 1;

  await this.save();
  return this;
};

// Static method to get resources by category
resourceSchema.statics.getByCategory = async function (groupId, category, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const query = { groupId };
  if (category && category !== 'all') {
    query.category = category;
  }
  
  return this.find(query)
    .sort({ isPinned: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('uploadedBy', 'name avatar');
};

// Static method to search resources
resourceSchema.statics.search = async function (groupId, searchTerm, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  return this.find({
    groupId,
    $text: { $search: searchTerm },
  })
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limit)
    .populate('uploadedBy', 'name avatar');
};

module.exports = mongoose.model('Resource', resourceSchema);
