import axios from "axios";

const API_BASE_URL = "/api/v1";

// Create axios instance with default config
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: 10000, // 10 seconds
});

// Track last request time to prevent rate limiting
let lastRequestTime = 0;
const REQUEST_DELAY = 300; // 300ms between requests

// Add request interceptor for rate limiting
api.interceptors.request.use(async (config) => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  // If less than REQUEST_DELAY ms has passed since last request, delay this request
  if (timeSinceLastRequest < REQUEST_DELAY) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  return config;
});

// Attach Authorization header with JWT from localStorage if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    console.log('[API] Adding Authorization header with token');
    config.headers['Authorization'] = `Bearer ${token}`;
  } else {
    console.warn('[API] No access token found in localStorage');
  }
  
  // Debug log for all outgoing requests
  console.log('[API] Outgoing Request:', {
    method: config.method?.toUpperCase(),
    url: config.baseURL + config.url,
    headers: config.headers,
    data: config.data,
    params: config.params
  });
  
  return config;
}, (error) => {
  console.error('[API] Request Error:', error);
  return Promise.reject(error);
});

// Handle responses and errors
api.interceptors.response.use(
  (response) => {
    console.log('[API] Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('[API] Response Error:', {
      status: error.response?.status,
      message: error.message,
      url: error.config?.url,
      response: error.response?.data
    });
    
    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'] || 5;
      console.warn(`[API] Rate limited. Retrying after ${retryAfter} seconds...`);
      
      // Return a promise that will retry the request after the delay
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(api(error.config));
        }, retryAfter * 1000);
      });
    }
    
    if (error.response?.status === 401) {
      console.log('[API] 401 Unauthorized - Invalid or expired token');
      // Clear invalid token
      localStorage.removeItem('accessToken');
      
      // Don't redirect automatically - let the component handle this
      console.log('[API] Authentication required - token cleared');
    }
    
    return Promise.reject(error);
  }
);

// AUTH
export const login = (data) => api.post("/auth/login", data);
export const register = (data) => api.post("/auth/register", data);
export const getMe = () => api.get("/auth/me");
export const forgotPassword = (email) => api.post("/auth/forgot-password", { email });
export const resetPassword = (token, password) => api.put(`/auth/reset-password/${token}`, { password });
/**
 * Updates user profile with the provided data
 * @param {Object|FormData} data - The data to update (can be FormData for file uploads)
 * @param {Object} options - Additional options for the request
 * @returns {Promise<Object>} The API response
 */
export const updateProfile = async (data, options = {}) => {
  const isFileUpload = options.headers?.['Content-Type'] === 'multipart/form-data';
  
  // Log the request details
  console.log(`[API] ${isFileUpload ? 'File upload' : 'Profile update'} requested`, {
    hasFile: data instanceof FormData ? 'Yes' : 'No',
    options: { ...options, headers: { ...options.headers, Authorization: 'Bearer [REDACTED]' } }
  });
  
  // Handle file uploads (avatar)
  if (isFileUpload) {
    try {
      const response = await api.put('/auth/profile', data, {
        ...options,
        headers: {
          ...options.headers,
          'Content-Type': 'multipart/form-data',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 30000 // 30 second timeout for file uploads
      });
      
      console.log('[API] File upload successful:', {
        status: response.status,
        data: response.data
      });
      
      return response;
    } catch (error) {
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: { ...error.config?.headers, Authorization: 'Bearer [REDACTED]' }
        }
      };
      
      console.error('[API] File upload failed:', errorDetails);
      throw error;
    }
  }
  
  // Handle regular profile updates
  const cleanData = {};
  const allowedFields = ['name', 'email', 'university', 'major', 'year', 'bio', 'avatar'];
  
  // Process each field in the data
  Object.entries(data).forEach(([key, value]) => {
    // Skip if not in allowed fields
    if (!allowedFields.includes(key)) {
      console.log(`[API] Skipping disallowed field: ${key}`);
      return;
    }
    
    // Handle empty strings (convert to null for consistency)
    if (value === '') {
      cleanData[key] = null;
    } 
    // Handle avatar removal
    else if (key === 'avatar' && (value === null || value === 'null')) {
      cleanData[key] = null;
    }
    // Include all other defined, non-null values
    else if (value !== undefined && value !== null) {
      cleanData[key] = value;
    }
  });
  
  console.log('[API] Sending profile update with data:', cleanData);
  
  try {
    const response = await api.put('/auth/profile', cleanData, {
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000 // 10 second timeout for regular updates
    });
    
    console.log('[API] Profile update successful:', {
      status: response.status,
      data: response.data
    });
    
    return response;
  } catch (error) {
    const errorInfo = {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      request: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data,
        headers: { ...error.config?.headers, Authorization: 'Bearer [REDACTED]' }
      }
    };
    
    console.error('[API] Profile update failed:', errorInfo);
    
    // Enhance the error with more context
    const enhancedError = new Error(
      error.response?.data?.message || 'Failed to update profile'
    );
    enhancedError.response = error.response;
    enhancedError.status = error.response?.status;
    enhancedError.data = error.response?.data;
    
    throw enhancedError;
  }
};

// GROUPS
export const getGroups = (params) => api.get("/groups", { params });
export const createGroup = (data) => {
  // Check if data is FormData (file upload)
  const isFormData = data instanceof FormData;
  
  // Log the request details
  console.log('[API] Sending createGroup request:', {
    isFormData,
    hasFile: isFormData ? data.has('avatar') : !!data.avatar,
    data: isFormData ? Object.fromEntries(data.entries()) : data,
    difficulty: isFormData ? data.get('difficulty') : data.difficulty,
    difficultyType: isFormData ? typeof data.get('difficulty') : typeof data.difficulty
  });
  
  // Prepare request config
  const config = {};
  
  if (isFormData) {
    // For FormData, let the browser set the Content-Type with boundary
    config.headers = {
      'Content-Type': 'multipart/form-data'
    };
  } else {
    // For JSON data, use transformRequest to ensure proper stringification
    config.transformRequest = [(data, headers) => {
      console.log('[API] Transform request - data:', data);
      return JSON.stringify(data);
    }];
  }
  
  return api.post("/groups", data, config)
  .then(response => {
    console.log('[API] createGroup response:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      difficulty: response.data?.difficulty,
      fullResponse: response
    });
    return response;
  })
  .catch(error => {
    console.error('[API] createGroup error:', {
      message: error.message,
      name: error.name,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    });
    throw error;
  });
};
export const updateGroup = (id, data) => {
  // Check if data is FormData (file upload)
  const isFormData = data instanceof FormData;
  
  // Log the request details
  console.log('[API] Sending updateGroup request:', {
    groupId: id,
    isFormData,
    hasFile: isFormData ? data.has('avatar') : !!data.avatar,
    data: isFormData ? Object.fromEntries(data.entries()) : data
  });
  
  // Prepare request config
  const config = {};
  
  if (isFormData) {
    // For FormData, let the browser set the Content-Type with boundary
    config.headers = {
      'Content-Type': 'multipart/form-data'
    };
  }
  
  return api.put(`/groups/${id}`, data, config);
};
export const deleteGroup = (id) => api.delete(`/groups/${id}`);
export const joinGroup = (id) => api.post(`/groups/${id}/join`);
export const leaveGroup = (id) => api.post(`/groups/${id}/leave`);

// MESSAGES
export const getMessages = (groupId) => {
  console.log(`[API] Fetching messages for group ${groupId}`);
  return api.get(`/messages/groups/${groupId}`)
    .then(response => {
      console.log(`[API] Successfully fetched messages for group ${groupId}`, {
        count: response.data?.data?.length || 0,
        status: response.status
      });
      return response;
    });
};

export const sendMessage = (groupId, data) => {
  console.log('[API] Sending message to group:', groupId, data);
  return api.post(`/messages/groups/${groupId}`, data);
};

export const updateMessage = (messageId, data) => {
  console.log('[API] Updating message:', messageId, data);
  return api.put(`/messages/${messageId}`, data);
};

export const deleteMessage = (messageId) => {
  console.log('[API] Deleting message:', messageId);
  return api.delete(`/messages/${messageId}`);
};

export const reactToMessage = (messageId, reaction) => {
  console.log('[API] Reacting to message:', messageId, reaction);
  return api.put(`/messages/${messageId}/react`, { reaction });
};

export const togglePinMessage = (messageId) => {
  console.log('[API] Toggling pin status for message:', messageId);
  return api.put(`/messages/${messageId}/pin`);
};

export const replyToMessage = (messageId, content) => {
  console.log('[API] Replying to message:', messageId, content);
  return api.post(`/messages/${messageId}/reply`, { content });
};

export const getMessageThread = (threadId) => {
  console.log('[API] Fetching message thread:', threadId);
  return api.get(`/messages/thread/${threadId}`);
};

// READ RECEIPTS
export const markMessagesAsRead = (data) => {
  console.log('[API] Marking messages as read:', data);
  return api.post('/messages/mark-read', data);
};

export const getMessageReadReceipts = (messageId) => {
  console.log('[API] Fetching read receipts for message:', messageId);
  return api.get(`/messages/${messageId}/read-receipts`);
};

// SESSIONS

/**
 * @typedef {Object} Session
 * @property {string} _id - Session ID
 * @property {string} title - Session title
 * @property {string} [description] - Session description
 * @property {'lecture'|'discussion'|'qna'|'workshop'|'review'|'other'} sessionType - Type of session
 * @property {string} scheduledDate - ISO date string
 * @property {number} duration - Duration in minutes
 * @property {string} [location] - Physical location (if applicable)
 * @property {boolean} [isOnline] - Whether the session is online
 * @property {string} [meetingLink] - Meeting link (for online sessions)
 * @property {number} [maxAttendees] - Maximum number of attendees
 * @property {string[]} [tags] - Session tags
 * @property {string} [notes] - Additional notes
 * @property {string} groupId - ID of the group this session belongs to
 * @property {Object[]} attendees - List of attendees
 * @property {string} createdBy - ID of the user who created the session
 */

/**
 * Fetch all study sessions
 * @param {Object} [params] - Query parameters
 * @returns {Promise<{data: Session[]}>}
 */
export const fetchSessions = (params = {}) => {
  console.log('[API] Fetching all sessions with params:', params);
  const populatedParams = {
    ...params,
    populate: 'createdBy,attendees.user,group',
  };
  return api.get('/study-sessions', { params: populatedParams });
};

/**
 * Fetch sessions for a specific group
 * @param {string} groupId - ID of the group
 * @param {Object} [params] - Additional query parameters
 * @returns {Promise<{data: Session[]}>}
 */
export const fetchGroupSessions = (groupId, params = {}) => {
  console.log(`[API] Fetching sessions for group ${groupId}`, { params });
  const populatedParams = { ...params, populate: 'createdBy,attendees.user,group' };
  return api.get(`/study-sessions/groups/${groupId}`, { params: populatedParams });
};

/**
 * Fetch a single session by ID
 * @param {string} id - Session ID
 * @returns {Promise<{data: Session}>}
 */
export const fetchSession = (id) => {
  console.log(`[API] Fetching session ${id}`);
  return api.get(`/study-sessions/${id}`, { params: { populate: 'createdBy,attendees.user,group' } });
};

/**
 * Fetch upcoming study sessions
 * @param {Object} [params] - Query parameters
 * @returns {Promise<{data: Session[]}>}
 */
export const getUpcomingSessions = (params = {}) => {
  console.log('[API] Fetching upcoming sessions', { params });
  const populatedParams = { ...params, populate: 'createdBy,attendees.user,group' };
  return api.get('/study-sessions/upcoming', { params: populatedParams });
};

/**
 * @param {Object} [params] - Additional query parameters
 * @returns {Promise<{data: Session[]}>}
 */
export const fetchSessionsByDateRange = (start, end, params = {}) => {
  console.log(`[API] Fetching sessions from ${start} to ${end}`, { params });
  return api.get('/study-sessions/range', { 
    params: { 
      ...params, 
      startDate: start,
      endDate: end 
    } 
  });
};

/**
 * Create a new study session
 * @param {Object} data - Session data
 * @param {string} data.groupId - ID of the group
 * @param {string} data.title - Session title
 * @param {string} [data.description] - Session description
 * @param {'lecture'|'discussion'|'qna'|'workshop'|'review'|'other'} [data.sessionType] - Type of session
 * @param {string} data.scheduledDate - ISO date string
 * @param {number} data.duration - Duration in minutes
 * @param {string} [data.location] - Physical location (if applicable)
 * @param {boolean} [data.isOnline=false] - Whether the session is online
 * @param {string} [data.meetingLink] - Meeting link (for online sessions)
 * @param {number} [data.maxAttendees] - Maximum number of attendees
 * @param {string[]} [data.tags] - Session tags
 * @param {string} [data.notes] - Additional notes
 * @param {File[]} [data.resources] - Session resources (files)
 * @returns {Promise<{data: Session}>}
 */
export const createSession = (data) => {
  console.log('[API] Creating study session', data);
  
  // Handle file uploads if resources are present
  if (data.resources && data.resources.length > 0) {
    const formData = new FormData();
    
    // Append all fields to formData
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'resources') {
        // Append each file
        value.forEach(file => formData.append('resources', file));
      } else if (Array.isArray(value)) {
        // Stringify arrays
        formData.append(key, JSON.stringify(value));
      } else if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });
    
    return api.post(`/study-sessions/groups/${data.groupId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
  
  // Remove the groupId from the data object before sending
  const { groupId, ...sessionData } = data;
  return api.post(`/study-sessions/groups/${groupId}`, sessionData);
};

/**
 * Update a study session
 * @param {string} id - Session ID
 * @param {Object} data - Updated session data
 * @returns {Promise<{data: Session}>}
 */
export const updateSession = (id, data) => {
  console.log(`[API] Updating session ${id}`, data);
  
  // Handle file uploads if resources are present
  if (data.resources && data.resources.length > 0) {
    const formData = new FormData();
    
    // Append all fields to formData
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'resources') {
        // Append each file
        value.forEach(file => formData.append('resources', file));
      } else if (Array.isArray(value)) {
        // Stringify arrays
        formData.append(key, JSON.stringify(value));
      } else if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });
    
    return api.put(`/study-sessions/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
  
  return api.put(`/study-sessions/${id}`, data);
};

/**
 * Delete a study session
 * @param {string} id - Session ID
 * @returns {Promise<{success: boolean}>}
 */
export const deleteSession = (id) => {
  console.log(`[API] Deleting session ${id}`);
  return api.delete(`/study-sessions/${id}`);
};

/**
 * RSVP to a study session
 * @param {string} id - Session ID
 * @param {Object} data - RSVP data
 * @param {boolean} data.attending - Whether the user is attending
 * @returns {Promise<{data: Session}>}
 */
export const rsvpToSession = (id, data) => {
  console.log(`[API] RSVP to session ${id}`, data);
  return api.put(`/study-sessions/${id}/rsvp`, data);
};

// RESOURCES
export const uploadResource = (data) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (key === "file" && value instanceof FileList && value.length > 0) {
      formData.append("file", value[0]);
    } else if (Array.isArray(value)) {
      value.forEach((v) => formData.append(key, v));
    } else if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  return api.post("/resources", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
