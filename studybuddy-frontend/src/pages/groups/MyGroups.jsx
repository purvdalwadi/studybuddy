import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import GroupSettingsDialog from "@/components/groups/GroupSettingsDialog";
import CreateGroupDialog from "@/components/groups/CreateGroupDialog";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useGroups, 
  useCreateGroup, 
  useUpdateGroup, 
  useJoinGroup, 
  useLeaveGroup, 
  useDeleteGroup 
} from "@/hooks/useGroups";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import JoinedGroupCard from "@/components/groups/cards/JoinedGroupCard";
import CreatedGroupCard from "@/components/groups/cards/CreatedGroupCard";
const DIFFICULTY_COLORS = {
  Beginner: "bg-green-100 text-green-700",
  Intermediate: "bg-yellow-100 text-yellow-800",
  Advanced: "bg-red-100 text-red-700"
};

export default function MyGroups() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  // Initialize mutations
  const { mutateAsync: updateGroup } = useUpdateGroup();
  
  // Handle opening settings dialog
  const handleOpenSettings = (group) => {
    console.log('Opening settings for group:', group);
    setSelectedGroup(group);
    setSettingsDialogOpen(true);
  };
  
  // Initialize mutations
  const createGroupMutation = useCreateGroup();
  const updateGroupMutation = useUpdateGroup();
  const leaveGroupMutation = useLeaveGroup();
  const joinGroupMutation = useJoinGroup();
  const deleteGroupMutation = useDeleteGroup();

  const { data: groups, isLoading, error } = useGroups({ 
    enabled: true,
    onSuccess: (data) => {
      console.log('[MyGroups] Groups data loaded successfully:', data);
      if (data && Array.isArray(data)) {
        data.forEach((group, index) => {
          console.log(`[MyGroups] Group ${index} ID check:`, {
            _id: group._id,
            id: group.id,
            hasMembers: Array.isArray(group.members),
            members: group.members?.map(m => ({
              _id: m?._id,
              id: m?.id,
              userId: m?.user?._id || m?.user?.id || m?.user || m?._id || m?.id,
              role: m?.role
            })),
            creator: group.creator,
            creatorId: group.creator?._id || group.creator
          });
        });
      }
    },
    onError: (err) => {
      console.error('[MyGroups] Error loading groups:', err);
      toast.error('Failed to load groups.');
    }
  });

  if (error) {
    toast.error('Failed to load groups.');
    console.error('[MyGroups] useGroups error:', error);
  }

  const userId = user?.data?.id || user?.data?._id;
  console.log('[MyGroups] Current user ID:', userId);
  console.log('[MyGroups] Raw groups data:', groups);

  // Helper to check if user is a member of a group and get their role
  const getUserRoleInGroup = (group, userId) => {
    if (!group.members || !Array.isArray(group.members)) return null;
    
    const member = group.members.find(member => {
      if (!member) return false;
      
      // Handle different member structures
      const memberId = member.user?._id || member.user?.id || member.user || member._id || member.id;
      return memberId && normalizeId(memberId) === normalizeId(userId);
    });
    
    if (!member) return null;
    
    // Return the member's role or default to 'member'
    return member.role || 'member';
  };
  
  // Helper to check if user is an admin of a group
  const isUserAdmin = (group, userId) => {
    const role = getUserRoleInGroup(group, userId);
    return role === 'admin' || role === 'owner';
  };
  
  // Helper to check if user is the creator of a group
  const isUserCreator = (group, userId) => {
    if (!group || !userId) return false;
    const creatorId = normalizeId(group.creator?._id || group.creator);
    return creatorId === normalizeId(userId);
  };

  // Process groups data with comprehensive error handling and logging
  const safeGroups = useMemo(() => {
    try {
      console.log('[safeGroups] Raw groups data:', groups);
      
      // Handle null/undefined
      if (!groups) {
        console.log('[safeGroups] No groups data');
        return [];
      }
      
      // Log detailed group information
      if (Array.isArray(groups)) {
        console.log(`[safeGroups] Processing ${groups.length} groups`);
        groups.forEach((group, idx) => {
          console.log(`[safeGroups] Group ${idx} ID:`, {
            _id: group._id,
            id: group.id,
            name: group.name,
            hasCreator: !!group.creator,
            creatorId: group.creator?._id || group.creator
          });
        });
      }

      // Handle direct array
      if (Array.isArray(groups)) {
        console.log('[safeGroups] Groups is an array, returning directly');
        return groups;
      }
      
      // Handle API response with data property
      if (groups && typeof groups === 'object' && 'data' in groups) {
        console.log('[safeGroups] Found data property in groups');
        const data = groups.data;
        
        // Handle paginated response
        if (data && typeof data === 'object' && 'docs' in data) {
          console.log('[safeGroups] Detected paginated response with docs');
          return Array.isArray(data.docs) ? data.docs : [];
        }
        
        // Handle direct data array
        if (Array.isArray(data)) {
          console.log('[safeGroups] Data is an array, returning it');
          return data;
        }
        
        // Handle single group object
        if (data && typeof data === 'object') {
          console.log('[safeGroups] Single group object found in data');
          return [data];
        }
        
        console.log('[safeGroups] Unhandled data format in groups.data:', data);
        return [];
      }
      
      // Handle plain object with groups
      if (groups && typeof groups === 'object' && !Array.isArray(groups)) {
        console.log('[safeGroups] Groups is an object, converting to array');
        const values = Object.values(groups);
        return Array.isArray(values) ? values : [];
      }
      
      console.log('[safeGroups] Unhandled groups format:', groups);
      return [];
    } catch (error) {
      console.error('[safeGroups] Error processing groups data:', error);
      return [];
    }
  }, [groups]);

  // Helper function to normalize ID for comparison
  const normalizeId = (id) => {
    if (!id) return null;
    if (typeof id === 'string') return id.trim();
    if (id._id) return id._id.toString().trim();
    if (id.id) return id.id.toString().trim();
    return id.toString().trim();
  };

  // Filter groups where current user is a member but not the creator
  const joinedGroups = useMemo(() => {
    try {
      if (!userId) {
        console.log('[joinedGroups] No current user, cannot filter');
        return [];
      }
      
      console.log('[joinedGroups] Filtering for user:', userId);
      
      return safeGroups
        .filter(group => {
          if (!group) {
            console.log('[joinedGroups] Skipping null/undefined group');
            return false;
          }
          
          const groupId = group._id || group.id;
          if (!groupId) {
            console.log('[joinedGroups] Group has no ID:', group);
            return false;
          }
          
          // Check if user is the creator (should be in createdGroups, not joinedGroups)
          if (isUserCreator(group, userId)) {
            console.log(`[joinedGroups] User is creator of group ${groupId}, skipping`);
            return false;
          }
          
          // Check if user is a member
          const isMember = getUserRoleInGroup(group, userId) !== null;
          
          console.log(`[joinedGroups] Group ${groupId}:`, { 
            groupTitle: group.title,
            isMember,
            memberCount: group.members?.length || 0
          });
          
          return isMember;
        })
        .map(group => ({
          ...group,
          currentUserRole: getUserRoleInGroup(group, userId),
          isAdmin: isUserAdmin(group, userId),
          isCreator: isUserCreator(group, userId)
        }));
    } catch (error) {
      console.error('[joinedGroups] Error filtering groups:', error);
      return [];
    }
  }, [safeGroups, userId]);

  // Filter groups created by the current user
  const createdGroups = useMemo(() => {
    try {
      if (!userId) {
        console.log('[createdGroups] No current user, cannot filter');
        return [];
      }
      
      console.log('[createdGroups] Filtering for user:', userId);
      
      return safeGroups
        .filter(group => {
          if (!group) {
            console.log('[createdGroups] Skipping null/undefined group');
            return false;
          }
          
          const groupId = group._id || group.id;
          if (!groupId) {
            console.log('[createdGroups] Group has no ID:', group);
            return false;
          }
          
          const isCreator = isUserCreator(group, userId);
          
          console.log(`[createdGroups] Group ${groupId} (${group.title}):`, { 
            creatorId: group.creator?._id || group.creator,
            isCreator,
            members: (group.members || []).length
          });
          
          return isCreator;
        })
        .map(group => ({
          ...group,
          currentUserRole: 'owner', // Creator is always owner
          isAdmin: true, // Creator is always admin
          isCreator: true
        }));
    } catch (error) {
      console.error('[createdGroups] Error filtering groups:', error);
      return [];
    }
  }, [safeGroups, userId]);

  console.log('[MyGroups] safeGroups:', safeGroups);
  console.log('[MyGroups] joinedGroups:', joinedGroups);
  console.log('[MyGroups] createdGroups:', createdGroups);
  console.log('[MyGroups] settingsDialogOpen:', settingsDialogOpen, typeof settingsDialogOpen);

  const [tab, setTab] = useState("joined");

  // Handle group creation
  const handleCreateGroup = async (formData) => {
    console.log('[handleCreateGroup] Raw form data:', formData);
    
    try {
      // Ensure required fields are present
      if (!formData.title || !formData.subject) {
        throw new Error('Title and subject are required');
      }

      // Create a clean data object with only the fields we want to send
      const dataToSend = {
        title: formData.title.trim(),
        subject: formData.subject.trim(),
        university: formData.university?.trim() || '',
        description: formData.description?.trim() || '',
        difficulty: formData.difficulty || 'Beginner',
        tags: Array.isArray(formData.tags) ? formData.tags : [],
        maxMembers: Number(formData.maxMembers) || 10,
        meetingSchedule: formData.meetingSchedule?.trim() || '',
        isActive: formData.isActive !== undefined ? formData.isActive : true
      };
      
      // Log the data being sent
      console.log('[handleCreateGroup] Sending to server:', dataToSend);
      
      // Use mutateAsync to properly handle the Promise
      const result = await createGroupMutation.mutateAsync(dataToSend);
      console.log('[handleCreateGroup] Server response:', result);
      
      // Invalidate the groups query to refetch the updated list
      await queryClient.invalidateQueries('groups');
      
      // Close the dialog and show success message
      setCreateDialogOpen(false);
      toast.success('Group created successfully!');
      
      // Log the updated groups list
      const groupsData = queryClient.getQueryData('groups');
      if (groupsData) {
        console.log('Updated groups list after creation:', groupsData);
      } else {
        console.log('No groups data in cache after creation');
        // Force refetch to ensure we have the latest data
        await queryClient.invalidateQueries('groups');
      }
    } catch (error) {
      console.error('[handleCreateGroup] Error creating group:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create group';
      console.error('Error details:', errorMessage);
      toast.error(errorMessage);
      
      // Rethrow the error to be caught by the form's error boundary if needed
      throw error;
    }
  };

  const handleSaveSettings = async (formData, shouldClose = true, options = {}) => {
    // Validate input
    if (!formData) {
      console.error('[handleSaveSettings] No form data provided');
      toast.error('No data provided for update');
      return;
    }
    
    console.log('[handleSaveSettings] Starting update with form data');
    
    // Get group ID from the selected group (if we have it) or from form data
    const groupId = selectedGroup?._id || selectedGroup?.id || 
                   formData.get('_id') || formData.get('id') ||
                   (formData.get('group') && JSON.parse(formData.get('group'))?._id);
    
    if (!groupId) {
      console.error('[handleSaveSettings] No group ID found in form data or selected group');
      toast.error('Cannot update group: Missing group ID');
      return;
    }
    
    console.log('[handleSaveSettings] Updating group with ID:', groupId);
    
    // Ensure the form data has the group ID
    if (!formData.has('_id') && !formData.has('id')) {
      formData.append('_id', groupId);
    }
    
    try {
      console.log('[handleSaveSettings] Calling updateGroup mutation with groupId:', groupId);
      
      // Call the API to update the group with FormData
      const response = await updateGroup({
        id: groupId, // The hook expects 'id' as the parameter name
        data: formData // Pass the FormData as 'data'
      });
      
      console.log('[handleSaveSettings] Update response:', response);
      
      if (response?.data) {
        // Invalidate and refetch groups to ensure we have the latest data
        await queryClient.invalidateQueries(['groups']);
        
        // Update the selectedGroup if it's the one being updated
        if (selectedGroup && (selectedGroup._id === groupId || selectedGroup.id === groupId)) {
          console.log('Updating selectedGroup with new data');
          setSelectedGroup(prev => ({
            ...prev,
            ...response.data,
            _id: prev._id || groupId,
            id: prev.id || groupId
          }));
          
          // Update the cache with the server response
          console.log('[handleSaveSettings] Updating cache with:', response.data);
          queryClient.setQueryData(['groups'], (oldData) => {
            if (!oldData) return [response.data];
            
            const updated = oldData.map(group => {
              const currentGroupId = group._id || group.id;
              return (currentGroupId === response.data._id || currentGroupId === response.data.id) 
                ? response.data 
                : group;
            });
            
            console.log('[handleSaveSettings] Cache updated. New groups:', updated);
            return updated;
          });
          
          // Invalidate and refetch to ensure consistency
          const invalidateQueries = async () => {
            try {
              await Promise.all([
                queryClient.invalidateQueries({
                  queryKey: ['groups'],
                  refetchType: 'active',
                }),
                queryClient.invalidateQueries({
                  queryKey: ['group', groupId],
                  refetchType: 'active',
                })
              ]);
            } catch (error) {
              console.error('Error invalidating queries:', error);
            }
          };
          
          await invalidateQueries();
          
          if (shouldClose) {
            setSettingsDialogOpen(false);
            setSelectedGroup(null);
          }
          
          toast.success('Group updated successfully');
          return response.data;
        }
      } else {
        throw new Error('No data returned from update');
      }
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error(error.response?.data?.message || 'Failed to update group');
      
      // Revert optimistic updates on error
      if (options.removedMemberId) {
        queryClient.invalidateQueries(['groups']);
      }
      throw error;
    }
  };
  
  const handleCloseSettings = () => {
    setSettingsDialogOpen(false);
    setSelectedGroup(null);
  };

  const handleDeleteGroup = (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;
    
    // Optimistically remove the group from the cache
    queryClient.setQueryData(['groups'], (oldData) => {
      if (!oldData) return oldData;
      return oldData.filter(group => 
        group._id !== groupId && group.id !== groupId
      );
    });
    
    deleteGroupMutation.mutate(groupId, {
      onSuccess: () => {
        // Invalidate and refetch to ensure consistency
        queryClient.invalidateQueries({
          queryKey: ['groups'],
          refetchType: 'active',
        });
        
        toast.success('Group deleted successfully');
      },
      onError: (error) => {
        console.error('Error in handleDeleteGroup:', error);
        // Revert optimistic update on error
        queryClient.invalidateQueries(['groups']);
        
        toast.error(error?.response?.data?.message || 'Failed to delete group');
      }
    });
  };

  const handleLeaveGroup = (groupId) => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    
    // Optimistically update the UI
    queryClient.setQueryData(['groups'], (oldData) => {
      if (!oldData) return oldData;
      return oldData.map(group => {
        if (group._id === groupId || group.id === groupId) {
          return {
            ...group,
            members: group.members.filter(member => {
              const memberId = member.user?._id || member.user || member._id;
              return memberId !== userId;
            })
          };
        }
        return group;
      });
    });
    
    leaveGroupMutation.mutate(groupId, {
      onSuccess: () => {
        // Invalidate and refetch to ensure consistency
        queryClient.invalidateQueries({
          queryKey: ['groups'],
          refetchType: 'active',
        });
        
        // Show success message
        toast.success('Successfully left the group');
      },
      onError: (error) => {
        console.error('Error in handleLeaveGroup:', error);
        // Revert optimistic update on error
        queryClient.invalidateQueries(['groups']);
        
        // Show error toast
        toast.error(error?.response?.data?.message || 'Failed to leave group');
      }
    });
  };
  // Optionally, you can add joinGroup handler if needed
  const handleJoinGroup = (groupId) => {
    joinGroupMutation.mutate(groupId);
  };


  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-extrabold text-primary-700 dark:text-primary-100 tracking-tight">
          My Study Groups
        </h1>
        <Button 
          size="sm" 
          variant="primary" 
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Group
        </Button>
      </div>
      
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-4 sm:p-6 mb-8 w-full">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList>
            <TabsTrigger value="joined">
              Joined Groups
            </TabsTrigger>
            <TabsTrigger value="created">
              Created Groups
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="joined">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            )}
            {error && (
              <div className="text-red-600 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                Failed to load groups. Please try again later.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 w-full max-w-5xl mx-auto">
              {isLoading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
              ) : joinedGroups.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
                  <p className="text-lg font-medium mb-2">No joined groups yet</p>
                  <p className="text-sm">Join a group to start studying together!</p>
                </div>
              ) : (
                joinedGroups.map((group) => {
                  const groupId = group._id || group.id;
                  return groupId ? (
                    <JoinedGroupCard
                      key={groupId}
                      group={group}
                      currentUserId={userId}
                      currentUserRole={group.currentUserRole}
                      isAdmin={group.isAdmin}
                      isCreator={group.isCreator}
                      onLeave={handleLeaveGroup}
                      isLeaving={leaveGroupMutation.isLoading && leaveGroupMutation.variables === groupId}
                      onMemberRemoved={(memberId) => {
                        // Update the local state to reflect the member removal
                        const updatedGroup = {
                          ...group,
                          members: group.members.filter(m => {
                            const id = m.user?._id || m.user || m._id || m.id;
                            return id !== memberId;
                          })
                        };
                        handleSaveSettings(updatedGroup, false, { removedMemberId: memberId });
                      }}
                    />
                  ) : null;
                })
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="created">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            )}
            {error && (
              <div className="text-red-600 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                Failed to load groups. Please try again later.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 w-full max-w-5xl mx-auto">
              {isLoading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
              ) : createdGroups.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
                  <p className="text-lg font-medium mb-2">No created groups yet</p>
                  <p className="text-sm">Create your first group to get started!</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    Create Group
                  </Button>
                </div>
              ) : (
                createdGroups.map((group) => {
                  const groupId = group._id || group.id;
                  return groupId ? (
                    <CreatedGroupCard
                      key={groupId}
                      group={group}
                      currentUserId={userId}
                      currentUserRole={group.currentUserRole}
                      isAdmin={group.isAdmin}
                      isCreator={group.isCreator}
                      onSettings={handleOpenSettings}
                      onDelete={handleDeleteGroup}
                      isDeleting={deleteGroupMutation.isLoading && deleteGroupMutation.variables === groupId}
                      onMemberRemoved={(memberId) => {
                        // Update the local state to reflect the member removal
                        const updatedGroup = {
                          ...group,
                          members: group.members.filter(m => {
                            const id = m.user?._id || m.user || m._id || m.id;
                            return id !== memberId;
                          })
                        };
                        handleSaveSettings(updatedGroup, false, { removedMemberId: memberId });
                      }}
                    />
                  ) : null;
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Dialogs */}
      <CreateGroupDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateGroup}
      />
      
      <GroupSettingsDialog
        group={selectedGroup}
        onSave={handleSaveSettings}
        open={settingsDialogOpen}
        onOpenChange={(open) => {
          console.log('Dialog open state changed:', open);
          setSettingsDialogOpen(open);
          if (!open) {
            setSelectedGroup(null);
          }
        }}
        onClose={() => {
          console.log('Dialog closed');
          setSettingsDialogOpen(false);
          setSelectedGroup(null);
        }}
      />
    </div>
  );
}
