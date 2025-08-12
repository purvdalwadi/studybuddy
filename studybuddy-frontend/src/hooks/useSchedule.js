import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchSessions, 
  fetchGroupSessions, 
  fetchSession, 
  getUpcomingSessions, 
  fetchSessionsByDateRange,
  createSession,
  updateSession,
  deleteSession,
  rsvpToSession
} from '@/services/api';
import { toast } from 'sonner';
import * as z from 'zod';

// Session validation schema
const sessionSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long'),
  description: z.string().optional(),
  groupId: z.string().min(1, 'Group is required'),
  sessionType: z.enum(['lecture', 'discussion', 'qna', 'workshop', 'review', 'other']).default('discussion'),
  scheduledDate: z.string().min(1, 'Date is required'),
  scheduledTime: z.string().min(1, 'Time is required'),
  duration: z.coerce.number().min(15, 'Duration must be at least 15 minutes'),
  maxAttendees: z.coerce.number().min(2, 'Minimum of 2 attendees required').optional(),
  isOnline: z.boolean().default(false),
  location: z.string().optional(),
  meetingLink: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  tags: z.string().optional()
}).refine(data => data.isOnline ? !!data.meetingLink : !!data.location, {
  message: 'Location or meeting link is required',
  path: ['location']
});

// Helper function to transform form data to API format
const transformSessionData = (data) => {
  const [hours, minutes] = data.scheduledTime.split(':').map(Number);
  const startTime = new Date(data.scheduledDate);
  startTime.setHours(hours, minutes, 0, 0);
  
  const endTime = new Date(startTime.getTime() + data.duration * 60 * 1000);
  
  return {
    title: data.title,
    description: data.description,
    groupId: data.groupId,
    sessionType: data.sessionType,
    scheduledDate: startTime.toISOString(),
    duration: data.duration,
    maxAttendees: data.maxAttendees,
    isOnline: data.isOnline,
    location: data.isOnline ? undefined : data.location,
    meetingLink: data.isOnline ? data.meetingLink : undefined,
    tags: data.tags ? data.tags.split(',').map(tag => tag.trim()) : []
  };
};

// Query keys
const sessionKeys = {
  all: ['sessions'],
  lists: () => [...sessionKeys.all, 'list'],
  list: (filters) => [...sessionKeys.lists(), { ...filters }],
  details: () => [...sessionKeys.all, 'detail'],
  detail: (id) => [...sessionKeys.details(), id],
  upcoming: () => [...sessionKeys.all, 'upcoming'],
  group: (groupId) => [...sessionKeys.all, 'group', groupId],
  dateRange: (start, end) => [...sessionKeys.all, 'dateRange', start, end],
};

/**
 * Hook to fetch all study sessions with optional filters
 * @param {Object} [filters] - Optional filters for the query
 * @param {string} [filters.search] - Search query string
 * @param {string} [filters.type] - Filter by session type
 * @param {boolean} [enabled=true] - Whether the query should be enabled
 * @param {number} [staleTime=30000] - Time in ms to consider the data fresh
 * @returns {QueryResult} The query result object
 */
export function useSessions(filters = {}, { enabled = true, staleTime = 30000 } = {}) {
  return useQuery({
    queryKey: sessionKeys.list(filters),
    queryFn: async () => {
      try {
        const response = await fetchSessions(filters);
        // The API returns { success: true, data: [...] }
        if (response?.data?.success && Array.isArray(response.data.data)) {
          return response.data.data;
        }
        throw new Error('Invalid response format');
      } catch (error) {
        console.error('Error in useSessions queryFn:', error);
        throw error; // Let React Query handle the error
      }
    },
    enabled,
    staleTime,
    retry: 2, // Retry failed requests up to 2 times
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    onError: (error) => {
      console.error('Error fetching sessions:', error);
      if (error.response?.status !== 401) { // Don't show toast for auth errors
        toast.error(error.response?.data?.message || 'Failed to load sessions. Please try again.');
      }
    },
  });
}

/**
 * Hook to fetch a single session by ID
 * @param {string} sessionId - The ID of the session to fetch
 * @param {Object} [options] - Additional query options
 * @returns {QueryResult} The query result object
 */
export function useSession(sessionId, options = {}) {
  return useQuery({
    queryKey: sessionKeys.detail(sessionId),
    queryFn: () => fetchSession(sessionId).then(res => {
      console.log('[Debug] Single session data from API:', res.data);
      return res.data;
    }),
    ...options,
    onError: (error) => {
      console.error(`Error fetching session ${sessionId}:`, error);
      toast.error('Failed to load session details. Please try again.');
    },
  });
}

/**
 * Hook to fetch upcoming study sessions
 * @param {Object} [filters] - Optional filters for the query
 * @param {number} [filters.limit] - Maximum number of sessions to return
 * @param {boolean} [enabled=true] - Whether the query should be enabled
 * @param {number} [staleTime=30000] - Time in ms to consider the data fresh
 * @returns {QueryResult} The query result object
 */
export function useUpcomingSessions(filters = {}, { enabled = true, staleTime = 30000 } = {}) {
  return useQuery({
    queryKey: [...sessionKeys.upcoming(), filters],
    queryFn: async () => {
      try {
        const response = await getUpcomingSessions(filters);
        // The API returns { success: true, data: [...] }
        if (response?.data?.success && Array.isArray(response.data.data)) {
          return response.data.data;
        }
        throw new Error('Invalid response format');
      } catch (error) {
        console.error('Error in useUpcomingSessions queryFn:', error);
        throw error; // Let React Query handle the error
      }
    },
    enabled,
    staleTime,
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      console.error('Error fetching upcoming sessions:', error);
      if (error.response?.status !== 401) {
        toast.error(error.response?.data?.message || 'Failed to load upcoming sessions.');
      }
    },
  });
}

/**
 * Hook to fetch sessions for a specific group
 * @param {string} groupId - The ID of the group
 * @param {Object} [filters] - Optional filters for the query
 * @returns {QueryResult} The query result object
 */
export function useGroupSessions(groupId, filters = {}) {
  return useQuery({
    queryKey: [...sessionKeys.group(groupId), filters],
    queryFn: () => fetchGroupSessions(groupId, filters).then(res => res.data),
    enabled: !!groupId,
    onError: (error) => {
      console.error(`Error fetching sessions for group ${groupId}:`, error);
      toast.error('Failed to load group sessions.');
    },
  });
}

/**
 * Hook to fetch sessions within a date range
 * @param {string|Date} start - Start date (ISO string or Date object)
 * @param {string|Date} end - End date (ISO string or Date object)
 * @param {Object} [filters] - Additional filters for the query
 * @param {boolean} [enabled=true] - Whether the query should be enabled
 * @param {number} [staleTime=30000] - Time in ms to consider the data fresh
 * @returns {QueryResult} The query result object
 */
export function useSessionsByDateRange(start, end, filters = {}, { 
  enabled = true, 
  // Reduced stale time for more frequent updates
  staleTime = 5000,
  // Enable background refresh when window regains focus
  refetchOnWindowFocus = true,
  // Enable background refresh when network reconnects
  refetchOnReconnect = true,
  // Don't retry failed requests to prevent UI flicker
  retry = 0
} = {}) {
  // Format dates to ensure they're in the correct format for the API
  const formatDate = (date) => {
    if (!date) return null;
    try {
      const d = new Date(date);
      return isNaN(d.getTime()) ? null : d.toISOString().split('.')[0] + 'Z'; // Format: YYYY-MM-DDTHH:mm:ssZ
    } catch (error) {
      console.error('Error formatting date:', { date, error });
      return null;
    }
  };

  const formattedStart = formatDate(start);
  const formattedEnd = formatDate(end);
  const isEnabled = enabled && !!formattedStart && !!formattedEnd;

  return useQuery({
    queryKey: sessionKeys.dateRange(formattedStart, formattedEnd, filters),
    queryFn: async ({ signal }) => {
      try {
        const response = await fetchSessionsByDateRange(formattedStart, formattedEnd, filters, { signal });
        // The API returns { success: true, data: [...] }
        if (response?.data?.success && Array.isArray(response.data.data)) {
          return response.data.data;
        }
        throw new Error('Invalid response format');
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error in useSessionsByDateRange queryFn:', {
            error,
            formattedStart,
            formattedEnd,
            filters
          });
          throw error; // Let React Query handle the error
        }
      }
    },
    enabled: isEnabled,
    staleTime,
    refetchOnWindowFocus,
    refetchOnReconnect,
    retry,
    // Keep previous data while refetching to prevent UI flicker
    keepPreviousData: true,
    // Don't show loading state during background refreshes
    notifyOnChangeProps: ['data', 'error'],
    onError: (error) => {
      if (error.response?.status !== 401) {
        toast.error(error.response?.data?.message || 'Failed to load sessions for the selected date range.');
      }
    },
  });
}

/**
 * Formats a date to a readable time string (e.g., "2:30 PM")
 * @param {Date} date - The date to format
 * @returns {string} Formatted time string
 */
const formatTime = (date) => {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
};

/**
 * Checks for scheduling conflicts before creating a session
 * @param {Object} sessionData - The session data to check
 * @returns {Promise<{hasConflict: boolean, conflicts: Array}>}
 */
const checkForConflicts = async (sessionData) => {
  try {
    // Only check for conflicts if we have required fields
    if (!sessionData.scheduledDate || !sessionData.duration) {
      return { hasConflict: false, conflicts: [] };
    }

    // Parse the proposed session times
    const proposedStart = new Date(sessionData.scheduledDate);
    const proposedEnd = new Date(proposedStart.getTime() + (sessionData.duration * 60000));
    
    // Format the proposed time range for display
    const proposedDateStr = proposedStart.toLocaleDateString();
    const proposedTimeStr = `${formatTime(proposedStart)} - ${formatTime(proposedEnd)}`;
    
    // Add buffer time (15 minutes before and after)
    const buffer = 15 * 60 * 1000; // 15 minutes in ms
    const startWithBuffer = new Date(proposedStart.getTime() - buffer);
    const endWithBuffer = new Date(proposedEnd.getTime() + buffer);

    // Fetch sessions in the time range
    const response = await fetchSessionsByDateRange(
      startWithBuffer.toISOString(),
      endWithBuffer.toISOString()
    );

    // Check if any sessions overlap with the proposed time
    const existingSessions = response.data?.data || [];
    const conflicts = [];
    
    existingSessions.forEach(session => {
      const sessionStart = new Date(session.scheduledDate);
      const sessionEnd = new Date(session.endTime);
      
      // Skip if it's the same session (for updates)
      if (session._id === sessionData.id) return;
      
      // Check for exact time overlaps
      if (
        // Session starts during the proposed session
        (sessionStart >= proposedStart && sessionStart < proposedEnd) ||
        // Session ends during the proposed session
        (sessionEnd > proposedStart && sessionEnd <= proposedEnd) ||
        // Session completely contains the proposed session
        (sessionStart <= proposedStart && sessionEnd >= proposedEnd)
      ) {
        const conflictType = (
          sessionStart.getTime() === proposedStart.getTime() && 
          sessionEnd.getTime() === proposedEnd.getTime()
        ) ? 'Exact time match' : 'Time overlap';
        
        conflicts.push({
          id: session._id,
          title: session.title,
          startTime: sessionStart,
          endTime: sessionEnd,
          group: session.groupId?.title || 'Unknown Group',
          conflictType,
          conflictDetails: getConflictDetails(proposedStart, proposedEnd, sessionStart, sessionEnd)
        });
      }
    });

    return {
      hasConflict: conflicts.length > 0,
      conflicts: conflicts
    };
  } catch (error) {
    console.error('Error checking for conflicts:', error);
    // If there's an error checking conflicts, let the backend handle it
    return { hasConflict: false, conflicts: [] };
  }
};

/**
 * Generates detailed conflict information
 * @param {Date} proposedStart - Proposed session start time
 * @param {Date} proposedEnd - Proposed session end time
 * @param {Date} existingStart - Existing session start time
 * @param {Date} existingEnd - Existing session end time
 * @returns {string} Detailed conflict description
 */
const getConflictDetails = (proposedStart, proposedEnd, existingStart, existingEnd) => {
  const format = 'h:mm a';
  
  // Check for exact match
  if (proposedStart.getTime() === existingStart.getTime() && 
      proposedEnd.getTime() === existingEnd.getTime()) {
    return 'Exact time match with an existing session';
  }
  
  // Check if existing session is within proposed session
  if (existingStart >= proposedStart && existingEnd <= proposedEnd) {
    return `Completely overlaps with an existing session (${formatTime(existingStart)} - ${formatTime(existingEnd)})`;
  }
  
  // Check if proposed session is within existing session
  if (proposedStart >= existingStart && proposedEnd <= existingEnd) {
    return 'Completely within an existing session';
  }
  
  // Check for partial overlap at start
  if (existingStart < proposedStart && existingEnd > proposedStart) {
    return `Overlaps with a session ending at ${formatTime(existingEnd)}`;
  }
  
  // Check for partial overlap at end
  if (existingStart < proposedEnd && existingEnd > proposedEnd) {
    return `Overlaps with a session starting at ${formatTime(existingStart)}`;
  }
  
  return 'Scheduling conflict detected';
};

/**
 * Hook to create a new study session
 * @returns {MutationResult} The mutation result object
 */
export function useCreateSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sessionData) => {
      // First check for conflicts
      const { hasConflict, conflicts } = await checkForConflicts(sessionData);
      
      if (hasConflict) {
        throw new Error('SCHEDULING_CONFLICT', { 
          cause: { 
            conflicts,
            message: 'Scheduling conflict detected with existing sessions.'
          } 
        });
      }
      
      // If no conflicts, proceed with creating the session
      const response = await createSession(sessionData);
      return response.data;
    },
    onSuccess: (newSession) => {
      // Invalidate all session queries to refetch data
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      toast.success('Session created successfully!');
      return newSession;
    },
    onError: (error) => {
      console.error('Detailed error creating session:', error);
      
      if (error.message === 'SCHEDULING_CONFLICT') {
        const conflicts = error.cause?.conflicts || [];
        
        if (conflicts.length === 0) {
          toast.error('Scheduling conflict detected. Please choose a different time.');
          return;
        }
        
        // Group conflicts by date for better organization
        const conflictsByDate = conflicts.reduce((acc, conflict) => {
          const dateStr = new Date(conflict.startTime).toLocaleDateString();
          if (!acc[dateStr]) acc[dateStr] = [];
          acc[dateStr].push(conflict);
          return acc;
        }, {});
        
        // Create a more detailed message
        let message = 'Scheduling conflict detected with the following session(s):\n\n';
        
        Object.entries(conflictsByDate).forEach(([date, dateConflicts]) => {
          message += `📅 ${date}:\n`;
          dateConflicts.forEach(conflict => {
            const startTime = formatTime(conflict.startTime);
            const endTime = formatTime(conflict.endTime);
            message += `• ${conflict.title} (${startTime} - ${endTime})`;
            if (conflict.conflictDetails) {
              message += `\n  ⚠️ ${conflict.conflictDetails}`;
            }
            message += '\n\n';
          });
        });
        
        message += 'Please choose a different time or adjust the session duration.';
        
        toast.error(message, { 
          duration: 15000, // Longer duration for detailed message
          style: { whiteSpace: 'pre-line' } // Preserve line breaks
        });
      } else {
        toast.error(
          error.response?.data?.message || 'Failed to create session. Please try again.'
        );
      }
    },
  });
}

/**
 * Hook to update an existing study session
 * @returns {MutationResult} The mutation result object
 */
export function useUpdateSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      try {
        return await updateSession(id, data).then(res => res.data);
      } catch (error) {
        // Handle scheduling conflicts with a user-friendly message
        if (error.response?.data?.code === 'SCHEDULING_CONFLICT') {
          const conflicts = error.response.data.conflicts || [];
          
          // Group conflicts by date for better organization
          const conflictsByDate = conflicts.reduce((acc, conflict) => {
            const dateStr = new Date(conflict.startTime).toDateString();
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(conflict);
            return acc;
          }, {});
          
          // Create a more detailed error message
          let message = 'Cannot update session due to scheduling conflicts:\n\n';
          
          Object.entries(conflictsByDate).forEach(([date, dateConflicts]) => {
            message += `📅 ${new Date(date).toLocaleDateString()}:\n`;
            dateConflicts.forEach(conflict => {
              message += `• ${conflict.title} (${formatTime(conflict.startTime)} - ${formatTime(conflict.endTime)})`;
              if (conflict.conflictType) {
                message += `\n  ⚠️ Conflict type: ${conflict.conflictType}`;
              }
              if (conflict.overlapMinutes > 0) {
                message += `\n  ⏱️ Overlap: ${conflict.overlapMinutes} minutes`;
              }
              message += '\n\n';
            });
          });
          
          message += 'Please choose a different time or adjust the session duration.';
          
          // Create a new error with the formatted message
          const formattedError = new Error('SCHEDULING_CONFLICT');
          formattedError.cause = {
            conflicts,
            message: 'Scheduling conflict detected with existing sessions.'
          };
          
          // Add the formatted message to the error
          formattedError.message = message;
          throw formattedError;
        }
        
        // Re-throw other errors
        throw error;
      }
    },
    onSuccess: (updatedSession) => {
      // Invalidate all session-related queries
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      // Update the session in the cache
      queryClient.setQueryData(sessionKeys.detail(updatedSession._id), updatedSession);
      toast.success('Session updated successfully!');
      return updatedSession;
    },
    onError: (error) => {
      console.error('Error updating session:', error);
      
      if (error.message === 'SCHEDULING_CONFLICT') {
        toast.error(error.message, { 
          duration: 15000, // Longer duration for detailed message
          style: { whiteSpace: 'pre-line' } // Preserve line breaks
        });
      } else {
        toast.error(error.response?.data?.message || 'Failed to update session. Please try again.');
      }
    },
  });
}

/**
 * Hook to delete a study session
 * @returns {MutationResult} The mutation result object
 */
export function useDeleteSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sessionId) => {
      await deleteSession(sessionId);
      return sessionId;
    },
    onSuccess: (sessionId) => {
      // Invalidate all session-related queries
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      // Remove the session from the cache if it exists
      queryClient.removeQueries({ queryKey: sessionKeys.detail(sessionId) });
      toast.success('Session deleted successfully');
      return sessionId;
    },
    onError: (error) => {
      console.error('Error deleting session:', error);
      toast.error(error.response?.data?.message || 'Failed to delete session. Please try again.');
    },
  });
}

/**
 * Hook to handle RSVP to a study session
 * @returns {MutationResult} The mutation result object
 */
// Custom hook to manage optimistic updates for session RSVPs
export function useSessionRSVP() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sessionId, status }) => {
      return rsvpToSession(sessionId, { status });
    },
    onMutate: async ({ sessionId, status, optimisticData }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await Promise.all([
        queryClient.cancelQueries({ queryKey: sessionKeys.detail(sessionId) }),
        queryClient.cancelQueries({ queryKey: sessionKeys.lists() })
      ]);
      
      // Snapshot the previous values
      const [previousSession, previousSessionsList] = await Promise.all([
        queryClient.getQueryData(sessionKeys.detail(sessionId)),
        queryClient.getQueryData(sessionKeys.lists())
      ]);
      
      const currentUser = queryClient.getQueryData(['user']);
      
      // If we have optimistic data, use it directly
      if (optimisticData) {
        queryClient.setQueryData(sessionKeys.detail(sessionId), optimisticData.session);
        if (optimisticData.sessions) {
          queryClient.setQueryData(sessionKeys.lists(), optimisticData.sessions);
        }
        return { previousSession, previousSessionsList };
      }

      // Create optimistic session with updated RSVP status
      const createOptimisticSession = (session) => {
        if (!session) return null;
        
        const updatedSession = { ...session };
        
        // Ensure attendees array exists
        if (!updatedSession.attendees) {
          updatedSession.attendees = [];
        }
        
        // Find the current user's attendance record
        const userIndex = updatedSession.attendees.findIndex(a => {
          const userId = a.user?._id || a.user;
          return userId === currentUser.data._id;
        });
        
        // Create the new attendee object with proper structure
        const newAttendee = {
          user: currentUser.data._id,
          rsvpStatus: status,
          joinedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Update or add the attendee
        if (userIndex >= 0) {
          updatedSession.attendees[userIndex] = {
            ...updatedSession.attendees[userIndex],
            rsvpStatus: status,
            updatedAt: new Date().toISOString()
          };
        } else {
          updatedSession.attendees = [...updatedSession.attendees, newAttendee];
        }
        
        return updatedSession;
      };
      
      // Update the session detail cache
      const updatedSession = createOptimisticSession(previousSession);
      if (updatedSession) {
        queryClient.setQueryData(sessionKeys.detail(sessionId), updatedSession);
      }
      
      // Update the sessions list cache
      if (previousSessionsList) {
        const updateSessionsList = (oldData) => {
          if (!oldData) return oldData;
          
          // Handle both array and paginated data structures
          if (Array.isArray(oldData)) {
            return oldData.map(session => 
              session._id === sessionId ? createOptimisticSession(session) || session : session
            );
          }
          
          // Handle paginated data
          if (oldData.pages) {
            return {
              ...oldData,
              pages: oldData.pages.map(page => ({
                ...page,
                sessions: Array.isArray(page.sessions) ? page.sessions.map(session => 
                  session._id === sessionId ? createOptimisticSession(session) || session : session
                ) : []
              }))
            };
          }
          
          return oldData;
        };
        
        queryClient.setQueryData(sessionKeys.lists(), updateSessionsList);
      }
      
      // Return context for potential rollback
      return { previousSession, previousSessionsList };
    },
    
    // On error, roll back to the previous state
    onError: (err, variables, context) => {
      console.error('RSVP mutation error:', err);
      
      // Rollback session detail
      if (context?.previousSession) {
        queryClient.setQueryData(
          sessionKeys.detail(variables.sessionId),
          context.previousSession
        );
      }
      
      // Rollback sessions list
      if (context?.previousSessionsList) {
        queryClient.setQueryData(
          sessionKeys.lists(),
          context.previousSessionsList
        );
      }
      
      // Show error toast
      toast.error(err.response?.data?.message || 'Failed to update RSVP status');
    },
    
    // On success, we don't need to do anything as the optimistic update is already in place
    // and we'll get the latest data from the server on the next refetch
    onSuccess: () => {
      // Silently update the cache with server data in the background
      queryClient.invalidateQueries({ 
        queryKey: sessionKeys.all,
        refetchType: 'active',
        // Don't show loading states during background updates
        onSettled: () => {}
      });
    },
    
    // On error or success, ensure we have the latest data
    onSettled: (data, error, variables) => {
      // Silently refetch the session data to ensure consistency
      queryClient.invalidateQueries({
        queryKey: sessionKeys.detail(variables.sessionId),
        refetchType: 'active',
        onSettled: () => {}
      });
    }
  });
}
