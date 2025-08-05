import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupMembers } from '@/hooks/useGroupMembers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Loader2, 
  Search, 
  UserPlus, 
  X, 
  UserX, 
  Shield, 
  Crown, 
  User,
  Users,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';

// Helper function to get member display info
const getMemberInfo = (member) => {
  if (!member) return null;
  
  const user = member.user || {};
  const userId = member.user?._id || member.user || member._id || member.id;
  
  // Log for debugging
  console.log('getMemberInfo - Processing member:', {
    member,
    userId,
    user,
    memberId: member._id,
    memberUserId: member.user,
    memberUser: member.user
  });
  
  return {
    id: userId, // Use the user ID as the main ID
    userId: userId, // Also store it as userId for consistency
    name: user.name || member.name || 'Unknown User',
    email: user.email || member.email || '',
    avatar: user.avatar || member.avatar,
    role: (member.role || 'member').toLowerCase(),
    isCreator: member.isCreator || false,
    // Store the original member object for debugging
    _original: member
  };
};

function MemberManagement({ 
  group, 
  currentUserId,
  currentUserRole = 'member',
  isAdmin = false,
  isCreator = false,
  onMemberRemoved 
}) {
  // Log when component renders or re-renders
  console.log('[MemberManagement] Rendering with props:', {
    groupId: group?._id || group?.id,
    memberCount: group?.members?.length,
    currentUserId,
    currentUserRole,
    isAdmin,
    isCreator
  });
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [showMembers, setShowMembers] = useState(true);
  
  // Use passed props for current user info and permissions
  const isOwner = isCreator; // isCreator prop indicates if current user is the group owner
  const groupMembers = group?.members || [];
  
  // For backward compatibility, we'll still use the hook but prioritize props
  const {
    members: fetchedMembers = [],
    isLoadingMembers,
    membersError,
    refetchMembers,
    removeMember: removeMemberMutation,
  } = useGroupMembers(group?._id || group?.id);
  
  // Use members from props if available, otherwise fall back to fetched members
  const effectiveMembers = groupMembers.length > 0 ? groupMembers : fetchedMembers;
  
  // Process members with additional info
  const processedMembers = useMemo(() => {
    if (!effectiveMembers || !Array.isArray(effectiveMembers)) return [];
    
    return effectiveMembers.map(member => {
      const memberInfo = getMemberInfo(member);
      const memberId = memberInfo?.id;
      const isCurrentUser = memberId === currentUserId;
      
      return {
        ...memberInfo,
        isCurrentUser,
        // Can remove any member except self
        canRemove: !isCurrentUser
      };
    });
  }, [effectiveMembers, currentUserId]);
  
  // Filter and group members by role
  const { owners, admins, members } = useMemo(() => {
    const result = { owners: [], admins: [], members: [] };
    
    if (!searchQuery.trim()) {
      processedMembers.forEach(member => {
        if (member.isCreator || member.role === 'owner') {
          result.owners.push(member);
        } else if (member.role === 'admin') {
          result.admins.push(member);
        } else {
          result.members.push(member);
        }
      });
      return result;
    }
    
    // Apply search filter
    const query = searchQuery.toLowerCase();
    const filtered = processedMembers.filter(member => {
      return (
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query)
      );
    });
    
    filtered.forEach(member => {
      if (member.isCreator || member.role === 'owner') {
        result.owners.push(member);
      } else if (member.role === 'admin') {
        result.admins.push(member);
      } else {
        result.members.push(member);
      }
    });
    
    return result;
  }, [processedMembers, searchQuery]);
  
  // Handle member removal
  const handleRemoveMember = useCallback(async (memberId) => {
    if (!memberId || !group?._id) {
      console.error('Cannot remove member: Missing memberId or group._id');
      return;
    }

    setRemovingMemberId(memberId);
    console.log('Attempting to remove member:', memberId, 'from group:', group._id);
    console.log('Current group members before removal:', group.members.map(m => ({
      id: m._id || m.id,
      userId: m.user?._id || m.user,
      name: m.user?.name || m.name
    })));

    const member = processedMembers.find(m => m.id === memberId);
    if (!member) {
      toast.error('Member not found');
      return;
    }
    
    // Log the member being removed for debugging
    console.log('Removing member:', {
      memberId,
      member,
      groupId: group?._id || group?.id,
      currentUserId
    });
    
    // Prevent removing self
    if (member.isCurrentUser) {
      toast.error('You cannot remove yourself');
      return;
    }
    
    // Prevent removing owners (only owners can remove other owners)
    if ((member.isCreator || member.role === 'owner') && !isOwner) {
      toast.error('Only the group owner can remove other owners');
      return;
    }
    
    // Prevent removing admins if not owner
    if (member.role === 'admin' && !isOwner) {
      toast.error('Only the group owner can remove admins');
      return;
    }
    
    // Show confirmation dialog
    const confirmed = await new Promise((resolve) => {
      const confirmed = window.confirm(`Are you sure you want to remove ${member.name} from the group?`);
      resolve(confirmed);
    });
    
    if (!confirmed) return;
    
    try {
      setRemovingMemberId(memberId);
      
      // Get the group ID and user ID in the correct format
      const groupId = group?._id || group?.id;
      
      // Get the user ID from the member object in the correct format
      const userIdToRemove = member._original?.user?._id || 
                           member._original?.user ||
                           member.userId || 
                           memberId;
      
      console.log('Attempting to remove member with:', { 
        groupId, 
        userId: userIdToRemove,
        memberId,
        memberData: {
          id: member.id,
          userId: member.userId,
          name: member.name,
          role: member.role,
          isCurrentUser: member.isCurrentUser,
          _original: member._original
        }
      });
      
      // Optimistically update the UI
      const previousMembers = [...(group.members || [])];
      
      // Update the local state immediately
      if (onMemberRemoved) {
        onMemberRemoved({
          ...group,
          members: (group.members || []).filter(m => {
            const id = m.user?._id || m.user || m._id || m.id;
            return id !== userIdToRemove;
          })
        });
      }
      
      // If we have a removeMemberMutation function, use it
      if (removeMemberMutation) {
        try {
          await removeMemberMutation(
            { 
              groupId, 
              userId: userIdToRemove 
            },
            {
              onSuccess: () => {
                toast.success(`${member.name} has been removed from the group`);
              },
              onError: (error) => {
                console.error('Failed to remove member:', {
                  error,
                  response: error.response?.data,
                  status: error.response?.status,
                  statusText: error.response?.statusText
                });
                
                // Revert the optimistic update on error
                if (onMemberRemoved) {
                  onMemberRemoved({
                    ...group,
                    members: previousMembers
                  });
                }
                
                toast.error(error.response?.data?.message || 'Failed to remove member. Please try again.');
              },
              onSettled: () => {
                setRemovingMemberId(null);
                if (refetchMembers) refetchMembers();
              }
            }
          );
        } catch (error) {
          console.error('Error in removeMemberMutation:', error);
          // Revert the optimistic update on error
          if (onMemberRemoved) {
            onMemberRemoved({
              ...group,
              members: previousMembers
            });
          }
          toast.error('An error occurred while removing the member');
        }
      } else if (onMemberRemoved) {
        // If no mutation function, just call onMemberRemoved with the updated group
        const updatedGroup = {
          ...group,
          members: (group.members || []).filter(m => {
            const id = m.user?._id || m.user || m._id || m.id;
            return id !== memberId;
          })
        };
        
        onMemberRemoved(updatedGroup);
        toast.success(`${member.name} has been removed from the group`);
        setRemovingMemberId(null);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('An unexpected error occurred while removing the member');
      setRemovingMemberId(null);
      
      // Re-fetch members to ensure UI is in sync
      if (refetchMembers) {
        refetchMembers();
      }
    }
  }, [removeMemberMutation, group, onMemberRemoved, processedMembers, refetchMembers, isOwner]);
  
  // Render role badge
  const renderRoleBadge = (role, isCreator) => {
    if (isCreator) {
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200">
          <Crown className="h-3 w-3 mr-1" />
          Owner
        </Badge>
      );
    }
    
    switch (role) {
      case 'admin':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">
            <Shield className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 hover:bg-gray-50 border-gray-200">
            <User className="h-3 w-3 mr-1" />
            Member
          </Badge>
        );
    }
  };
  
  // Render member list section
  const renderMemberList = (members, title, icon) => {
    if (members.length === 0) return null;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm font-medium text-muted-foreground">
            {icon}
            <span className="ml-2">{title} • {members.length}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          {members.map((member) => (
            <div 
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3 w-full">
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarImage src={member.avatar} alt={member.name} />
                    <AvatarFallback>
                      {member.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="font-medium truncate">{member.name}</span>
                      {member.isCurrentUser && (
                        <Badge variant="secondary" className="text-xs flex-shrink-0">You</Badge>
                      )}
                      {!member.isCurrentUser && member.canRemove && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10 ml-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMember(member.id);
                          }}
                          disabled={removingMemberId === member.id}
                          title={`Remove ${member.name}`}
                        >
                          {removingMemberId === member.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserX className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground ml-2 flex-shrink-0">
                      {renderRoleBadge(member.role, member.isCreator)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Loading state
  if (isLoadingMembers && effectiveMembers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading members...</p>
      </div>
    );
  }
  
  // Error state (only show if we don't have any members from props)
  if (membersError && effectiveMembers.length === 0) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
        <p className="font-medium text-destructive">Failed to load members</p>
        <p className="text-sm text-muted-foreground mt-1">
          {membersError.message || 'Please try again later'}
        </p>
        {refetchMembers && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={() => refetchMembers()}
          >
            Retry
          </Button>
        )}
      </div>
    );
  }
  
  // Empty state
  const totalMembers = owners.length + admins.length + members.length;
  if (totalMembers === 0 && !isLoadingMembers) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
        <h3 className="text-lg font-medium">No members yet</h3>
        <p className="text-muted-foreground mt-1">
          {searchQuery ? 'No members match your search.' : 'Invite members to get started.'}
        </p>
        {isOwner && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-4"
            onClick={() => {
              // TODO: Implement invite functionality
              toast.info('Invite functionality coming soon');
            }}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Members
          </Button>
        )}
      </div>
    );
  }
  
  // Main render
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-medium">Members</h3>
          <p className="text-sm text-muted-foreground">
            {totalMembers} member{totalMembers !== 1 ? 's' : ''} in this group
          </p>
        </div>
        
        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search members..."
            className="pl-9 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
      </div>
      
      <div className="space-y-6">
        {renderMemberList(owners, 'Owners', <Crown className="h-4 w-4 text-amber-500" />)}
        {renderMemberList(admins, 'Admins', <Shield className="h-4 w-4 text-blue-500" />)}
        {renderMemberList(members, 'Members', <Users className="h-4 w-4" />)}
      </div>
      
      {isOwner && (
        <div className="pt-4 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full sm:w-auto"
            onClick={() => {
              // TODO: Implement invite functionality
              toast.info('Invite functionality coming soon');
            }}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Members
          </Button>
        </div>
      )}
    </div>
  );
}

const areEqual = (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  const prevMembers = prevProps.group?.members || [];
  const nextMembers = nextProps.group?.members || [];
  
  const membersEqual = prevMembers.length === nextMembers.length &&
    prevMembers.every((member, i) => {
      const nextMember = nextMembers[i];
      if (!nextMember) return false;
      
      const prevId = member._id || member.id;
      const nextId = nextMember._id || nextMember.id;
      
      return prevId === nextId && 
             member.role === nextMember.role;
    });
  
  const propsEqual = (
    prevProps.group?._id === nextProps.group?._id &&
    membersEqual &&
    prevProps.currentUserId === nextProps.currentUserId &&
    prevProps.currentUserRole === nextProps.currentUserRole &&
    prevProps.isAdmin === nextProps.isAdmin &&
    prevProps.isCreator === nextProps.isCreator
  );
  
  if (!propsEqual) {
    console.log('[MemberManagement] Props changed, will re-render', {
      groupIdChanged: prevProps.group?._id !== nextProps.group?._id,
      membersChanged: !membersEqual,
      currentUserChanged: prevProps.currentUserId !== nextProps.currentUserId,
      roleChanged: prevProps.currentUserRole !== nextProps.currentUserRole,
      isAdminChanged: prevProps.isAdmin !== nextProps.isAdmin,
      isCreatorChanged: prevProps.isCreator !== nextProps.isCreator
    });
  }
  
  return propsEqual;
};

export default React.memo(MemberManagement, areEqual);