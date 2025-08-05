import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup
} from '@/services/api';

export function useGroups(filters = {}) {
  return useQuery({
    queryKey: ['groups', filters],
    queryFn: async () => {
      try {
        const res = await getGroups(filters);
        return res.data || [];
      } catch (err) {
        console.error('Error fetching groups:', err);
        throw err;
      }
    },
    select: (data) => {
      // Handle both direct array response and { data: [...] } response
      if (Array.isArray(data)) {
        return data;
      } else if (data && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    }
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupData) => {
      // Create a deep clone to prevent any accidental mutations
      const requestData = JSON.parse(JSON.stringify(groupData));
      
      console.log('[useCreateGroup] Creating group with data:', {
        ...requestData,
        difficulty: requestData.difficulty,
        difficultyType: typeof requestData.difficulty
      });
      
      try {
        console.log('[useCreateGroup] Sending request to server...');
        const response = await createGroup(requestData);
        
        // Extract the response data
        const responseData = response.data?.data || response.data;
        const finalData = {
          ...responseData,
          // Ensure we have a difficulty field, fallback to level if needed
          difficulty: responseData.difficulty || responseData.level
        };

        console.log('[useCreateGroup] Server response received:', {
          status: response.status,
          statusText: response.statusText,
          data: {
            ...finalData,
            difficulty: finalData.difficulty,
            difficultyType: typeof finalData.difficulty
          },
          rawResponse: response.data
        });
        
        // Check for difficulty mismatch
        const normalizedSent = requestData.difficulty?.toLowerCase();
        const normalizedReceived = finalData.difficulty?.toLowerCase();
        
        if (normalizedSent !== normalizedReceived) {
          console.warn('[useCreateGroup] Difficulty mismatch!', {
            sent: requestData.difficulty,
            received: finalData.difficulty,
            normalizedSent,
            normalizedReceived,
            rawResponse: response.data
          });
        }
        
        return finalData;
      } catch (error) {
        const errorInfo = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: error.code,
          response: {
            status: error.response?.status,
            statusText: error.response?.statusText,
            headers: error.response?.headers,
            data: error.response?.data
          },
          config: error.config ? {
            url: error.config.url,
            method: error.config.method,
            data: error.config.data,
            headers: error.config.headers
          } : undefined
        };
        
        console.error('[useCreateGroup] Error creating group:', errorInfo);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Ensure we have the final data with difficulty properly set
      const finalData = {
        ...data,
        difficulty: data.difficulty || data.level
      };
      
      console.log('[useCreateGroup] Mutation successful, invalidating queries. Received data:', {
        ...finalData,
        difficulty: finalData.difficulty,
        difficultyType: typeof finalData.difficulty
      });
      
      // Invalidate and refetch
      return Promise.all([
        queryClient.invalidateQueries(['groups']),
        queryClient.invalidateQueries(['user', 'groups'])
      ]).then(() => {
        console.log('[useCreateGroup] Cache invalidated successfully');
        return finalData;
      });
    },
    onError: (error) => {
      console.error('[useCreateGroup] Mutation error:', error);
    },
    onSettled: () => {
      console.log('[useCreateGroup] Mutation settled');
    }
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      console.log('[useUpdateGroup] Updating group with ID:', id, 'Data:', data);
      try {
        const response = await updateGroup(id, data);
        console.log('[useUpdateGroup] Update response:', {
          status: response.status,
          data: response.data,
          hasId: !!(response.data?._id || response.data?.id)
        });
        return response;
      } catch (error) {
        console.error('[useUpdateGroup] Error updating group:', {
          error: error.message,
          response: error.response?.data
        });
        throw error;
      }
    },
    onSuccess: (response) => {
      console.log('[useUpdateGroup] Mutation successful, invalidating queries');
      // Invalidate the groups query to refetch fresh data
      queryClient.invalidateQueries(['groups']);
      // Also invalidate the specific group query if we have an ID
      const groupId = response?.data?._id || response?.data?.id;
      if (groupId) {
        queryClient.invalidateQueries(['group', groupId]);
      }
      return response;
    },
    onError: (error) => {
      console.error('[useUpdateGroup] Mutation error:', error);
      throw error;
    }
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries(['groups']);
    }
  });
}

const inFlightJoins = new Set();

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId) => {
      if (inFlightJoins.has(groupId)) {
        throw new Error('Already joining this group');
      }
      inFlightJoins.add(groupId);
      try {
        return await joinGroup(groupId);
      } finally {
        inFlightJoins.delete(groupId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['groups']);
      import('sonner').then(({ toast }) => 
        toast.success('Successfully joined the group!')
      );
    },
    onError: (error) => {
      import('sonner').then(({ toast }) =>
        toast.error(error?.response?.data?.message || 'Failed to join group')
      );
    }
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId) => leaveGroup(groupId),
    onMutate: async (groupId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries(['groups']);
      
      // Snapshot the previous value
      const previousGroups = queryClient.getQueryData(['groups']);
      
      // Optimistically update the cache
      queryClient.setQueryData(['groups'], (oldData) => {
        if (!oldData) return oldData;
        
        // Handle both direct array and { data: [...] } formats
        if (Array.isArray(oldData)) {
          return oldData.filter(group => group._id !== groupId);
        } else if (oldData.data && Array.isArray(oldData.data)) {
          return {
            ...oldData,
            data: oldData.data.filter(group => group._id !== groupId)
          };
        }
        
        return oldData;
      });
      
      return { previousGroups };
    },
    onSuccess: () => {
      // Invalidate and refetch to ensure our data is fresh
      queryClient.invalidateQueries(['groups']);
      import('sonner').then(({ toast }) => 
        toast.success('Successfully left the group')
      );
    },
    onError: (error, groupId, context) => {
      console.error('Error leaving group:', error);
      
      // Rollback to the previous value on error
      if (context?.previousGroups) {
        queryClient.setQueryData(['groups'], context.previousGroups);
      }
      
      import('sonner').then(({ toast }) =>
        toast.error(error?.response?.data?.message || 'Failed to leave group')
      );
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries(['groups']);
    }
  });
}
