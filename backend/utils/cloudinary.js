const cloudinary = require('cloudinary').v2;
const { promisify } = require('util');
const logger = require('./logger');

// Configure Cloudinary
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
};

// Log the configuration (without exposing the full secret)
logger.info('Initializing Cloudinary with configuration:', {
  cloud_name: cloudinaryConfig.cloud_name,
  api_key: cloudinaryConfig.api_key ? '***' + String(cloudinaryConfig.api_key).slice(-4) : 'undefined',
  api_secret: cloudinaryConfig.api_secret ? '***' + String(cloudinaryConfig.api_secret).slice(-4) : 'undefined'
});

// Verify configuration
if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
  const error = new Error('Cloudinary configuration is incomplete. Please check your environment variables.');
  logger.error('Cloudinary configuration error:', {
    error: error.message,
    missing: {
      cloud_name: !cloudinaryConfig.cloud_name,
      api_key: !cloudinaryConfig.api_key,
      api_secret: !cloudinaryConfig.api_secret
    }
  });
  throw error;
}

cloudinary.config(cloudinaryConfig);

// Promisify the upload method
const uploadToCloudinary = promisify(cloudinary.uploader.upload);
const destroyFromCloudinary = promisify(cloudinary.uploader.destroy);

/**
 * Uploads a file to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} folder - The folder to upload to (e.g., 'avatars')
 * @param {string} publicId - Optional public ID for the file
 * @returns {Promise<Object>} - The upload result from Cloudinary
 */
const uploadFile = async (fileBuffer, folder = 'studybuddy', publicId = null) => {
  try {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      throw new Error('Invalid file buffer provided');
    }

    const uploadOptions = {
      folder: folder || 'studybuddy',
      resource_type: 'auto', // Automatically detect the resource type
      use_filename: true, // Use the original filename
      unique_filename: false, // Don't make the filename unique
      overwrite: true, // Overwrite existing files with the same name
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    // Verify Cloudinary configuration
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary configuration is missing. Please check your environment variables.');
    }

    // Log the start of the upload
    logger.info('Starting Cloudinary upload with options:', {
      folder: uploadOptions.folder,
      publicId: uploadOptions.public_id || 'none',
      bufferSize: fileBuffer.length
    });

    // Convert buffer to base64
    const base64Data = fileBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Data}`;

    const result = await uploadToCloudinary(dataUri, uploadOptions);
    
    if (!result || !result.secure_url) {
      throw new Error('Invalid response from Cloudinary');
    }
    
    logger.info(`File uploaded to Cloudinary: ${result.secure_url}`);
    return result;
  } catch (error) {
    const errorDetails = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: error.code,
      http_code: error.http_code,
      folder,
      publicId: publicId || 'none',
      bufferType: fileBuffer ? typeof fileBuffer : 'undefined',
      bufferLength: fileBuffer ? fileBuffer.length : 0
    };
    
    logger.error('Error uploading to Cloudinary:', errorDetails);
    throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
  }
};

/**
 * Deletes a file from Cloudinary
 * @param {string} publicId - The public ID of the file to delete
 * @returns {Promise<Object>} - The deletion result from Cloudinary
 */
const deleteFile = async (publicId) => {
  try {
    if (!publicId) return { result: 'ok' }; // Nothing to delete
    
    const result = await destroyFromCloudinary(publicId);
    logger.info(`File deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    logger.error('Error deleting from Cloudinary:', error);
    throw new Error('Failed to delete file from Cloudinary');
  }
};

/**
 * Extracts public ID from Cloudinary URL
 * @param {string} url - The Cloudinary URL
 * @returns {string|null} - The public ID or null if not a Cloudinary URL
 */
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  // Match the public ID pattern in Cloudinary URLs
  const matches = url.match(/upload\/v\d+\/([^\/]+\/[^\/\.]+)/);
  return matches ? matches[1] : null;
};

module.exports = {
  uploadFile,
  deleteFile,
  getPublicIdFromUrl
};
