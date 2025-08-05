import React, { useState, useMemo, useEffect } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { useGroups, useJoinGroup, useLeaveGroup, useCreateGroup } from "@/hooks/useGroups";
import { Button } from "@/components/ui/button";
import CreateGroupDialog from "@/components/groups/CreateGroupDialog";
import GroupCard from "@/components/groups/GroupCard";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Search, Filter, AlertCircle, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Available" },
  { value: "almost_full", label: "Almost Full" },
  { value: "full", label: "Full" },
];

const DIFFICULTY_COLORS = {
  Beginner: "bg-green-100 text-green-700",
  Intermediate: "bg-yellow-100 text-yellow-800",
  Advanced: "bg-red-100 text-red-700"
};

// Debounce hook for search input
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function FindGroups() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedDifficulties, setSelectedDifficulties] = useState([]);
  const { user, isLoading: isAuthLoading } = useAuth();
  const currentUserId = user?.data?.id || user?.data?._id;
  const debouncedSearch = useDebounce(search, 300);
  
  // Fetch groups with refetch every 10 seconds for real-time updates
  const { 
    data: groups, 
    isLoading, 
    error, 
    refetch: refetchGroups 
  } = useGroups({
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
    staleTime: 5000, // Consider data fresh for 5 seconds
  });

  if (error) {
    console.error('[FindGroups] useGroups error:', error);
  }

  // Safely extract groups array from response
  const safeGroups = useMemo(() => {
    if (!groups) return [];
    return Array.isArray(groups) ? groups : (groups.data || []);
  }, [groups]);

  // Log group data for debugging
  useEffect(() => {
    console.log('[FindGroups] Groups data updated:', {
      rawGroups: groups,
      safeGroups,
      timestamp: new Date().toISOString()
    });
  }, [groups, safeGroups]);

  const queryClient = useQueryClient();
  
  const joinGroupMutation = useJoinGroup({
    onSuccess: () => {
      // Invalidate and refetch groups after successful join
      refetchGroups();
      // Also invalidate any other related queries if needed
      queryClient.invalidateQueries(['user-groups']);
    },
  });

  const leaveGroupMutation = useLeaveGroup({
    onSuccess: () => {
      // Invalidate and refetch groups after successful leave
      refetchGroups();
      // Also invalidate any other related queries if needed
      queryClient.invalidateQueries(['user-groups']);
    },
  });

  const handleJoin = (groupId) => {
    joinGroupMutation.mutate(groupId);
  };

  const handleLeave = (groupId) => {
    leaveGroupMutation.mutate(groupId);
  };

  // Filter groups based on all criteria
  const filteredGroups = useMemo(() => {
    if (!safeGroups) return [];
    
    return safeGroups.filter((group) => {
      // Search filter
      const searchLower = debouncedSearch.toLowerCase();
      const matchesSearch = 
        !searchLower || 
        (group.title || '').toLowerCase().includes(searchLower) ||
        (group.description || '').toLowerCase().includes(searchLower) ||
        (group.subject || '').toLowerCase().includes(searchLower) ||
        (group.tags || []).some(tag => 
          typeof tag === 'string' ? 
          tag.toLowerCase().includes(searchLower) : 
          tag.name?.toLowerCase().includes(searchLower)
        );
      
      // Calculate group status based on member count
      const memberCount = group.members?.length || 0;
      const maxMembers = group.maxMembers || 10; // Default to 10 if not specified
      
      let groupStatus = 'open'; // Default status
      const memberPercentage = (memberCount / maxMembers) * 100;
      
      if (memberCount >= maxMembers) {
        groupStatus = 'full';
      } else if (memberPercentage >= 80) {
        groupStatus = 'almost_full';
      } else {
        groupStatus = 'open';
      }
      
      // Apply status filter
      const matchesStatus = status === "all" || groupStatus === status;
      
      // Difficulty filter
      const matchesDifficulty = selectedDifficulties.length === 0 || 
        (group.difficulty && selectedDifficulties.includes(group.difficulty));
      
      // Add the calculated status to the group object for use in the UI
      group.calculatedStatus = groupStatus;
      group.memberCount = memberCount;
      group.maxMembers = maxMembers;
      
      return matchesSearch && matchesStatus && matchesDifficulty;
    });
  }, [safeGroups, debouncedSearch, status, selectedDifficulties]);
  
  // Toggle difficulty filter
  const toggleDifficulty = (difficulty) => {
    setSelectedDifficulties(prev => 
      prev.includes(difficulty)
        ? prev.filter(d => d !== difficulty)
        : [...prev, difficulty]
    );
  };
  
  // Clear all filters
  const clearAllFilters = () => {
    setSearch('');
    setStatus('all');
    setSelectedDifficulties([]);
  };

  // Create group mutation
  const createGroupMutation = useCreateGroup();

  // Handle group creation
  const handleCreateGroup = async (groupData) => {
    try {
      await createGroupMutation.mutateAsync(groupData);
      setCreateDialogOpen(false);
      alert('Group created successfully!');
    } catch (error) {
      console.error('Error creating group:', error);
      alert(error.response?.data?.message || 'Failed to create group. Please try again.');
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-extrabold text-primary-700 dark:text-primary-100">
            Find Your Perfect <span className="bg-gradient-to-r from-primary-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">Study Group</span>
          </h1>
          <p className="text-sm md:text-base text-gray-500 max-w-2xl">
            Connect with fellow students, share knowledge, and achieve academic success together.
          </p>
        </div>
        <div className="flex-shrink-0">
          <Button
            className="rounded-full px-4 md:px-6 py-2 text-sm md:text-base font-bold bg-gradient-to-r from-primary-500 via-purple-500 to-blue-500 text-white shadow-lg hover:opacity-90 transition"
            onClick={() => setCreateDialogOpen(true)}
            aria-label="Create a new group"
          >
            + Create Group
          </Button>
          <CreateGroupDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Groups List */}
        <div className="flex-1 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <div className="flex-1 max-w-2xl">
              <Input
                placeholder="Search by subject, topic, or keywords..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full"
                aria-label="Search groups"
                starticon={<Search className="h-4 w-4 text-gray-400" />}
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-500 whitespace-nowrap">
                {filteredGroups.length} {filteredGroups.length === 1 ? 'group' : 'groups'} found
              </span>
            </div>
          </div>
          {/* Groups Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 bg-white dark:bg-gray-800 rounded-lg shadow-sm animate-pulse" />
              ))
            ) : error ? (
              <div className="col-span-full p-6 text-center bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="h-6 w-6 mx-auto text-red-500 mb-2" />
                <p className="text-red-600 dark:text-red-400">Failed to load groups. Please try again.</p>
                <Button 
                  variant="outline" 
                  className="mt-3"
                  onClick={() => refetchGroups()}
                >
                  Retry
                </Button>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <Users className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">No groups found</h3>
                <p className="mt-1 text-gray-500 dark:text-gray-400">
                  {search || status !== 'all' ? 'Try adjusting your search or filters' : 'Be the first to create a group'}
                </p>
                {(!search && status === 'all') && (
                  <Button 
                    className="mt-4"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    Create Group
                  </Button>
                )}
              </div>
            ) : filteredGroups.map((group) => {
              // Log group data for debugging
              console.log('Group data:', group);
              
              // Check if user is a member
              let isMember = false;
              
              // Only check membership if we have a current user ID
              if (currentUserId && Array.isArray(group.members)) {
                isMember = group.members.some(member => {
                  if (!member) return false;
                  
                  // Case 1: Direct user ID string in members array
                  if (typeof member === 'string') {
                    return member === currentUserId;
                  }
                  
                  // Case 2: Member object with user field
                  const memberUser = member.user || member;
                  if (!memberUser) return false;
                  
                  // Handle both string and object memberUser
                  const memberId = typeof memberUser === 'string' 
                    ? memberUser 
                    : memberUser._id || memberUser.id;
                  
                  const isMatch = memberId === currentUserId;
                  
                  if (isMatch) {
                    console.log('User is a member of group:', {
                      groupId: group._id || group.id,
                      groupTitle: group.title,
                      memberId,
                      currentUserId
                    });
                  }
                  
                  return isMatch;
                });
              }

              console.log('Group membership check:', { 
                groupId: group._id || group.id, 
                groupTitle: group.title,
                isMember, 
                members: group.members,
                currentUserId,
                user: { id: user?.id, _id: user?._id }
              });

              const isCurrentUserCreator = group.creator === user?.id || 
                                        group.creator?._id === user?.id ||
                                        group.creator?.id === user?.id;

              // Calculate member count
              const memberCount = group.members?.length || 0;

              // Prepare group data with normalized structure
              const normalizedGroup = {
                ...group,
                memberCount,
                isMember,
                isCreator: isCurrentUserCreator,
                // Ensure members is always an array
                members: Array.isArray(group.members) ? group.members : []
              };

              // Always pass handleJoin and let GroupCard handle the display logic
              return (
                <GroupCard
                  key={group._id || group.id}
                  group={normalizedGroup}
                  onJoin={handleJoin}
                  isMember={isMember}
                  joinLoading={joinGroupMutation.isLoading && joinGroupMutation.variables === (group._id || group.id)}
                  className="h-full"
                />
              );
            })}
          </div>
        </div>
        {/* Filters Sidebar */}
        <div className="lg:w-80 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center">
              <Filter className="h-4 w-4 mr-2 text-gray-400" />
              Filters
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Status
                </label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem 
                        key={option.value} 
                        value={option.value}
                        className="flex items-center"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Difficulty
                </label>
                <div className="space-y-2">
                  {Object.entries(DIFFICULTY_COLORS).map(([level, classes]) => {
                    const isSelected = selectedDifficulties.includes(level);
                    return (
                      <div key={level} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`difficulty-${level}`}
                          checked={isSelected}
                          onChange={() => toggleDifficulty(level)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <label 
                          htmlFor={`difficulty-${level}`}
                          className={`ml-2 text-sm ${isSelected ? 'font-medium text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}
                        >
                          {level}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={clearAllFilters}
              >
                Clear all filters
              </Button>
            </div>
          </div>
          
          {/* Help Section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              Can't find a group?
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
              Create your own study group and invite classmates to join you.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Group
            </Button>
          </div>
        </div>
      </div>

      {/* Create Group Dialog */}
      <CreateGroupDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
        onCreate={handleCreateGroup}
      />
    </div>
  );
}
