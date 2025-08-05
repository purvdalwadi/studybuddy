import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { toast } from 'sonner';

export function useGroupMembers(groupId) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Helper to safely extract user ID from member object
  const getUserId = (member) => {
    if (!member) return null;
    return member.user?._id || member.user || member._id;
  };

  // Get group members
  const { 
    data: groupMembers = [],
    isLoading: isLoadingMembers,
    error: membersError,
    refetch: refetchMembers
  } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      
      try {
        const { data } = await api.get(`/groups/${groupId}`, { baseURL: '/api/v1' });
        return data?.members || [];
      } catch (error) {
        console.error('Error fetching group members:', error);
        toast.error('Failed to load group members');
        return [];
      }
    },
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  // Get users that can be added to the group
  const { 
    data: users = [], 
    isLoading: isLoadingUsers, 
    error: usersError,
    refetch: refetchUsers
  } = useQuery({
    queryKey: ['group-available-users', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      
      try {
        // Get users that can be added to the group
        const response = await api.get('/users', {
          baseURL: '/api/v1',
          params: { 
            groupId,
            excludeMembers: true // Let the backend handle the filtering
          }
        });
        
        // Handle different response formats
        let usersList = [];
        if (Array.isArray(response.data)) {
          usersList = response.data;
        } else if (response.data && Array.isArray(response.data.data)) {
          usersList = response.data.data;
        } else if (response.data && response.data.users) {
          usersList = response.data.users;
        }
        
        console.log('Fetched available users:', usersList);
        
        // Filter out the current user
        return usersList.filter(user => 
          user && 
          user._id && 
          user._id !== currentUser?.id
        );
      } catch (error) {
        console.error('Error in available users query:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
        
        if (error.response?.status === 403) {
          console.log('User does not have permission to view all users');
          return [];
        }
        
        // Don't show error toast here, let the component handle it
        throw error;
      }
    },
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on 403 (forbidden) errors
      if (error.response?.status === 403) return false;
      return failureCount < 2; // Retry up to 2 times for other errors
    },
    suspense: false,
    useErrorBoundary: false
  });

  // Remove member from group
  const removeMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId }) => {
      if (!groupId || !userId) {
        const error = new Error('Missing groupId or userId');
        error.userMessage = 'Invalid group or user';
        throw error;
      }

      try {
        // Use path parameters as per the original implementation
        const url = `/groups/${groupId}/members/${userId}`;
        console.log('Sending DELETE request to:', `/api/v1${url}`);
        console.log('Request details:', { groupId, userId });
        
        const response = await api.delete(url, { 
          baseURL: '/api/v1',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          validateStatus: (status) => status < 500, // Don't throw for 4xx errors
        });
        
        console.log('Raw response:', {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          headers: response.headers
        });
        
        console.log('Remove member response:', {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          headers: response.headers
        });
        
        if (response.status >= 400) {
          const error = new Error(response.statusText || 'Failed to remove member');
          error.status = response.status;
          error.response = response;
          error.userMessage = response.data?.message || `Failed to remove member (${response.status})`;
          throw error;
        }
        
        return { success: true, ...(response.data || {}) };
      } catch (error) {
        console.error('Error in removeMemberMutation:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            data: error.config?.data
          }
        });
        
        const errorMsg = error.response?.data?.message || error.userMessage || 'Failed to remove member';
        error.userMessage = errorMsg;
        throw error;
      }
    },
    onMutate: async ({ groupId, userId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['group-members', groupId] });
      await queryClient.cancelQueries({ queryKey: ['groups'] });
      
      // Snapshot the previous values
      const previousMembers = queryClient.getQueryData(['group-members', groupId]) || [];
      const previousGroups = queryClient.getQueryData(['groups']);
      
      // Optimistically update the members list
      queryClient.setQueryData(
        ['group-members', groupId],
        previousMembers.filter(member => getUserId(member) !== userId)
      );
      
      // Also update the groups list if it exists
      if (previousGroups) {
        const updatedGroups = previousGroups.map(group => {
          if (group._id === groupId) {
            return {
              ...group,
              members: group.members.filter(member => getUserId(member) !== userId)
            };
          }
          return group;
        });
        queryClient.setQueryData(['groups'], updatedGroups);
      }
      
      return { previousMembers, previousGroups };
    },
    onSuccess: (data, { groupId }) => {
      // Invalidate and refetch to ensure we have fresh data
      queryClient.invalidateQueries({ 
        queryKey: ['group-members', groupId],
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ 
        queryKey: ['group-available-users', groupId],
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ 
        queryKey: ['groups'],
        refetchType: 'active'
      });
      
      toast.success('Member removed successfully');
    },
    onError: (error, { groupId }, context) => {
      console.error('Error removing member:', {
        message: error.message,
        status: error.status,
        response: error.response?.data,
        stack: error.stack
      });
      
      // Rollback on error
      if (context?.previousMembers) {
        queryClient.setQueryData(['group-members', groupId], context.previousMembers);
      }
      
      let errorMessage = 'Failed to remove member';
      if (error.status === 400) {
        errorMessage = 'Invalid request. Please try again.';
      } else if (error.status === 404) {
        errorMessage = 'Member or group not found';
      } else if (error.status === 403) {
        errorMessage = 'You do not have permission to remove this member';
      }
      
      toast.error(error.userMessage || errorMessage);
    },
    retry: 1
  });



  return {
    // Members
    members: groupMembers,
    isLoadingMembers,
    membersError,
    refetchMembers,
    
    // Available users to add
   
    // Member actions
    removeMember: removeMemberMutation.mutateAsync,
    isRemovingMember: removeMemberMutation.isPending,
    
    
  };
}
