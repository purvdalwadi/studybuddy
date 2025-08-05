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
 * @returns {QueryResult} The query result object
 */
export function useSessions(filters = {}, enabled = true) {
  return useQuery({
    queryKey: sessionKeys.list(filters),
    queryFn: () => fetchSessions(filters).then(res => res.data),
    enabled,
    onError: (error) => {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions. Please try again.');
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
    queryFn: () => fetchSession(sessionId).then(res => res.data),
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
 * @returns {QueryResult} The query result object
 */
export function useUpcomingSessions(filters = {}) {
  return useQuery({
    queryKey: [...sessionKeys.upcoming(), filters],
    queryFn: () => getUpcomingSessions(filters).then(res => res.data),
    onError: (error) => {
      console.error('Error fetching upcoming sessions:', error);
      toast.error('Failed to load upcoming sessions.');
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
 * @param {string} start - Start date (ISO string)
 * @param {string} end - End date (ISO string)
 * @param {Object} [filters] - Additional filters for the query
 * @returns {QueryResult} The query result object
 */
export function useSessionsByDateRange(start, end, filters = {}) {
  return useQuery({
    queryKey: [...sessionKeys.dateRange(start, end), filters],
    queryFn: () => fetchSessionsByDateRange(start, end, filters).then(res => res.data),
    enabled: !!(start && end),
    onError: (error) => {
      console.error('Error fetching sessions by date range:', error);
      toast.error('Failed to load sessions for the selected date range.');
    },
  });
}

/**
 * Hook to create a new study session
 * @returns {MutationResult} The mutation result object
 */
export function useCreateSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => createSession(data).then(res => res.data),
    onSuccess: (newSession) => {
      // Invalidate all session queries to refetch data
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      toast.success('Session created successfully!');
    },
    onError: (error) => {
      console.error('Error creating session:', error);
      toast.error(error.response?.data?.message || 'Failed to create session. Please try again.');
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
    mutationFn: ({ id, ...data }) => updateSession(id, data).then(res => res.data),
    onSuccess: (updatedSession) => {
      // Update the session in the cache
      queryClient.setQueryData(sessionKeys.detail(updatedSession._id), updatedSession);
      // Invalidate all session lists
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      toast.success('Session updated successfully!');
    },
    onError: (error) => {
      console.error('Error updating session:', error);
      toast.error(error.response?.data?.message || 'Failed to update session. Please try again.');
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
    mutationFn: (sessionId) => deleteSession(sessionId).then(res => res.data),
    onSuccess: (_, sessionId) => {
      // Remove the session from the cache
      queryClient.removeQueries({ queryKey: sessionKeys.detail(sessionId) });
      // Invalidate all session lists
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      toast.success('Session deleted successfully!');
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
export function useSessionRSVP() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sessionId, attending }) => 
      rsvpToSession(sessionId, { attending }).then(res => res.data),
    onMutate: async ({ sessionId, attending }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: sessionKeys.detail(sessionId) });
      
      // Snapshot the previous value
      const previousSession = queryClient.getQueryData(sessionKeys.detail(sessionId));
      
      // Optimistically update the cache
      if (previousSession) {
        const updatedAttendees = [...(previousSession.attendees || [])];
        const userIndex = updatedAttendees.findIndex(a => a.user._id === queryClient.getQueryData(['user'])?.id);
        
        if (userIndex >= 0) {
          // Update existing RSVP
          updatedAttendees[userIndex] = { 
            ...updatedAttendees[userIndex], 
            status: attending ? 'attending' : 'declined' 
          };
        } else if (attending) {
          // Add new RSVP
          updatedAttendees.push({ 
            user: queryClient.getQueryData(['user']),
            status: 'attending'
          });
        }
        
        queryClient.setQueryData(sessionKeys.detail(sessionId), {
          ...previousSession,
          attendees: updatedAttendees
        });
      }
      
      return { previousSession };
    },
    onError: (error, { sessionId }, context) => {
      console.error('Error updating RSVP:', error);
      toast.error('Failed to update your RSVP. Please try again.');
      
      // Rollback on error
      if (context?.previousSession) {
        queryClient.setQueryData(sessionKeys.detail(sessionId), context.previousSession);
      }
    },
    onSettled: (data, error, { sessionId }) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    },
  });
}
