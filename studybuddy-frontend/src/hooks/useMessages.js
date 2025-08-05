import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getMessages, 
  sendMessage, 
  updateMessage, 
  deleteMessage, 
  reactToMessage, 
  togglePinMessage, 
  replyToMessage, 
  getMessageThread 
} from '@/services/api';

export function useMessages(groupId, options = {}) {
  return useQuery({
    queryKey: ['messages', groupId],
    queryFn: async () => {
      try {
        const response = await getMessages(groupId);
        return response.data;
      } catch (error) {
        console.error('[useMessages] Error fetching messages:', error);
        
        // Re-throw the error to be handled by the component
        // This allows the component to handle 401 errors appropriately
        throw error;
      }
    },
    enabled: !!groupId,
    retry: (failureCount, error) => {
      // Don't retry on 401 errors
      if (error?.response?.status === 401) {
        return false;
      }
      // Retry once for other errors
      return failureCount < 1;
    },
    ...options
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, formData }) => {
      return sendMessage(groupId, formData);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['messages', variables.groupId]);
    },
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, content }) => {
      return updateMessage(messageId, { content });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['messages', data.groupId]);
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, groupId }) => {
      // Store groupId in the context for onSuccess
      return deleteMessage(messageId).then(response => ({
        ...response,
        groupId // Include groupId in the response
      }));
    },
    onSuccess: (data) => {
      // Use the groupId from the response
      if (data?.groupId) {
        queryClient.invalidateQueries(['messages', data.groupId]);
      }
    },
    onError: (error) => {
      console.error('Error in useDeleteMessage:', error);
      throw error; // Re-throw to be handled by the component
    }
  });
}

export function useReactToMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, reaction, groupId }) => {
      if (!messageId) {
        const error = new Error('Missing required parameter: messageId');
        error.details = { messageId, reaction, groupId };
        throw error;
      }
      
      try {
        console.log('Adding reaction:', { messageId, reaction, groupId });
        // If reaction is null, it means we're removing the reaction
        const response = await reactToMessage(
          messageId, 
          reaction === null ? null : reaction
        );
        console.log('Reaction response:', response);
        // Include groupId in the response for cache invalidation
        return { ...response.data, groupId };
      } catch (error) {
        console.error('Error in reactToMessage mutation:', {
          error: error.message,
          details: error.details,
          stack: error.stack
        });
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      console.log('Reaction successful, invalidating queries');
      queryClient.invalidateQueries(['messages', data?.groupId || variables.groupId]);
    },
    onError: (error) => {
      console.error('Error in useReactToMessage:', {
        message: error.message,
        details: error.details,
        response: error.response?.data
      });
      toast.error(error.response?.data?.message || 'Failed to add reaction');
    }
  });
}

export function useTogglePinMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId) => {
      if (!messageId) {
        throw new Error('Message ID is required');
      }
      return togglePinMessage(messageId);
    },
    onSuccess: (data, variables) => {
      // Invalidate both the messages query and any related queries
      queryClient.invalidateQueries(['messages']);
      queryClient.invalidateQueries(['messages', data?.groupId]);
    },
    onError: (error) => {
      console.error('Error in useTogglePinMessage:', error);
      throw error; // Re-throw to be caught by the component
    }
  });
}

export function useReplyToMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, content }) => {
      return replyToMessage(messageId, { content });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['messages', data.groupId]);
    },
  });
}

export function useMessageThread(threadId) {
  return useQuery({
    queryKey: ['messageThread', threadId],
    queryFn: () => getMessageThread(threadId).then(res => res.data),
    enabled: !!threadId,
  });
}
