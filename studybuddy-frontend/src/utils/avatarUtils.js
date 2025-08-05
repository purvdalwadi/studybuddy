// Default avatar URLs
const DEFAULT_AVATARS = {
  user: {
    placeholder: '/images/default-avatar.png',
    fallback: 'https://ui-avatars.com/api/?name=U&background=random&color=fff',
    dicebear: 'https://api.dicebear.com/7.x/initials/svg?seed=User'
  },
  group: {
    placeholder: '/images/group-avatar-placeholder.png',
    fallback: 'https://ui-avatars.com/api/?name=G&background=random&color=fff',
    dicebear: 'https://api.dicebear.com/7.x/initials/svg?seed=Group'
  }
};

/**
 * Get a default avatar URL based on type
 * @param {'user'|'group'} type - Type of avatar (user or group)
 * @returns {string} Default avatar URL
 */
const getDefaultAvatar = (type = 'user') => {
  const defaults = DEFAULT_AVATARS[type] || DEFAULT_AVATARS.user;
  return defaults.placeholder || defaults.fallback;
};

/**
 * Process avatar object or string to get URL
 * @param {string|object} avatar - Avatar data
 * @param {string} type - Type of avatar (user or group)
 * @returns {string} Processed avatar URL
 */
const processAvatar = (avatar, type = 'user') => {
  // Handle null/undefined/empty
  if (!avatar || (typeof avatar === 'string' && avatar.trim() === '') || 
      (typeof avatar === 'object' && Object.keys(avatar).length === 0)) {
    return getDefaultAvatar(type);
  }

  // Handle File objects (from file inputs)
  if (avatar instanceof File) {
    return URL.createObjectURL(avatar);
  }

  // Handle object format
  if (typeof avatar === 'object' && avatar !== null) {
    // Cloudinary object format
    if (avatar.secure_url || avatar.url) {
      return avatar.secure_url || avatar.url;
    }
    // Nested avatar property
    if (avatar.avatar) {
      return processAvatar(avatar.avatar, type);
    }
    return getDefaultAvatar(type);
  }

  // Handle string URLs
  if (typeof avatar === 'string') {
    // Already a full URL or blob URL
    if (avatar.startsWith('http') || avatar.startsWith('blob:')) {
      return avatar;
    }

    // Skip default avatar filenames
    const defaultPatterns = [
      'default.jpg', 'default.png', 'default-avatar.jpg', 'default-avatar.png',
      'group-default.jpg', 'group-default.png', 'group-avatar.jpg', 'group-avatar.png'
    ];
    
    const filename = avatar.split('/').pop();
    if (defaultPatterns.includes(filename)) {
      return getDefaultAvatar(type);
    }

    // Handle relative paths
    if (avatar.startsWith('/')) {
      return `${import.meta.env.VITE_API_URL || 'http://localhost:5050'}${avatar}`;
    }

    // Handle just the filename
    const folder = type === 'user' ? 'avatars' : 'groups';
    return `${import.meta.env.VITE_API_URL || 'http://localhost:5050'}/uploads/${folder}/${avatar}`;
  }

  return getDefaultAvatar(type);
};

/**
 * Get user avatar URL with fallback
 * @param {string|object} avatar - User avatar data
 * @returns {string} Avatar URL
 */
export const getUserAvatarUrl = (avatar) => {
  try {
    return processAvatar(avatar, 'user');
  } catch (error) {
    console.error('Error getting user avatar URL:', error);
    return getDefaultAvatar('user');
  }
};

/**
 * Get group avatar URL with fallback
 * @param {string|object} avatar - Group avatar data
 * @returns {string} Avatar URL
 */
export const getGroupAvatarUrl = (avatar) => {
  if (!avatar) return getDefaultAvatar('group');
  
  // Check if avatar is a base64 string
  if (typeof avatar === 'string' && avatar.startsWith('data:image/')) {
    return avatar;
  }
  
  try {
    return processAvatar(avatar, 'group');
  } catch (error) {
    console.error('Error getting group avatar URL:', error);
    return getDefaultAvatar('group');
  }
};

// For backward compatibility
export const getAvatarUrl = (avatar) => {
  console.warn('getAvatarUrl is deprecated. Use getUserAvatarUrl or getGroupAvatarUrl instead.');
  return getUserAvatarUrl(avatar);
};

/**
 * Get the initials from a user's name
 * @param {string} name - The user's full name
 * @param {number} [maxLength=2] - Maximum number of initials to return
 * @returns {string} The user's initials
 */
export const getUserInitials = (name, maxLength = 2) => {
  if (!name || typeof name !== 'string') return 'U';
  
  const names = name.trim().split(/\s+/).filter(Boolean);
  if (names.length === 0) return 'U';
  
  // For single name, return first character
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  
  // For multiple names, return first letter of first and last name
  const first = names[0].charAt(0);
  const last = names[names.length - 1].charAt(0);
  return `${first}${last}`.toUpperCase().substring(0, maxLength);
};

/**
 * Get the initials from a group name
 * @param {string} name - The group name
 * @param {number} [maxLength=2] - Maximum number of initials to return
 * @returns {string} The group's initials
 */
export const getGroupInitials = (name, maxLength = 2) => {
  if (!name || typeof name !== 'string') return 'G';
  
  // Try to extract meaningful parts from common group name patterns
  const cleanName = name.trim();
  if (cleanName.length === 0) return 'G';
  
  // For very short names, just return them in uppercase
  if (cleanName.length <= maxLength) return cleanName.toUpperCase();
  
  // For names with common separators, take first letter of each part
  const separators = /[\s\-\._]+/;
  if (separators.test(cleanName)) {
    const parts = cleanName.split(separators).filter(Boolean);
    if (parts.length > 1) {
      return parts
        .map(part => part.charAt(0).toUpperCase())
        .join('')
        .substring(0, maxLength);
    }
  }
  
  // Otherwise, take first letters up to maxLength
  return cleanName
    .split('')
    .filter((char, i) => i === 0 || char === char.toUpperCase())
    .join('')
    .toUpperCase()
    .substring(0, maxLength) || 'G';
};

// For backward compatibility
export const getInitials = (name) => {
  console.warn('getInitials is deprecated. Use getUserInitials or getGroupInitials instead.');
  return getUserInitials(name);
};

/**
 * Extracts user avatar URL from a user object
 * @param {object} user - User object with avatar property
 * @returns {string} Avatar URL or default user avatar
 */
export const extractUserAvatar = (user) => {
  if (!user) return getDefaultAvatar('user');
  
  // Handle different user object structures
  if (user.avatar) return getUserAvatarUrl(user.avatar);
  if (user.data?.avatar) return getUserAvatarUrl(user.data.avatar);
  if (user.avatarUrl) return getUserAvatarUrl(user.avatarUrl);
  
  return getDefaultAvatar('user');
};

/**
 * Extracts group avatar URL from a group object
 * @param {object} group - Group object with avatar property
 * @returns {string} Avatar URL or default group avatar
 */
export const extractGroupAvatar = (group) => {
  if (!group) return getDefaultAvatar('group');
  
  // Log the group object for debugging
  console.log('extractGroupAvatar - group object:', {
    id: group.id,
    title: group.title,
    avatar: group.avatar,
    avatarType: typeof group.avatar,
    isBase64: group.avatar?.startsWith?.('data:image/')
  });
  
  // Handle base64 encoded avatar
  if (group.avatar?.startsWith?.('data:image/')) {
    return group.avatar;
  }
  
  // Handle different group object structures
  if (group.avatar) return getGroupAvatarUrl(group.avatar);
  if (group.data?.avatar) return getGroupAvatarUrl(group.data.avatar);
  if (group.avatarUrl) return getGroupAvatarUrl(group.avatarUrl);
  if (group.image) return getGroupAvatarUrl(group.image);
  
  return getDefaultAvatar('group');
};

// For backward compatibility
export const extractAvatarUrl = (obj, type = 'user') => {
  console.warn('extractAvatarUrl is deprecated. Use extractUserAvatar or extractGroupAvatar instead.');
  return type === 'group' 
    ? extractGroupAvatar(obj)
    : extractUserAvatar(obj);
};
