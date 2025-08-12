import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  createSession as createSessionApi,
  updateSession as updateSessionApi,
  deleteSession as deleteSessionApi,
  rsvpToSession as rsvpToSessionApi
} from '@/services/api';

// Create a new session
export const useCreateSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createSessionApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session created successfully');
    },
    onError: (error) => {
      console.error('Error creating session:', error);
      toast.error(error.response?.data?.message || 'Failed to create session');
    },
  });
};

// Update an existing session
export const useUpdateSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, ...sessionData }) => updateSessionApi(id, sessionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session updated successfully');
    },
    onError: (error) => {
      console.error('Error updating session:', error);
      toast.error(error.response?.data?.message || 'Failed to update session');
    },
  });
};

// Delete a session
export const useDeleteSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (sessionId) => deleteSessionApi(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting session:', error);
      toast.error(error.response?.data?.message || 'Failed to delete session');
    },
  });
};

// Handle RSVP to a session
export const useSessionRSVP = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sessionId, attending }) => rsvpToSessionApi(sessionId, { attending }),
    onSuccess: (data, variables) => {
      const { attending } = variables;
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success(attending ? 'Successfully joined the session' : 'Successfully left the session');
    },
    onError: (error, variables) => {
      const { attending } = variables;
      console.error(`Error ${attending ? 'joining' : 'leaving'} session:`, error);
      toast.error(error.response?.data?.message || `Failed to ${attending ? 'join' : 'leave'} session`);
    },
  });
};
