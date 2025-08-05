import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useGroups } from "@/hooks/useGroups";
import { 
  useMessages, 
  useSendMessage, 
  useUpdateMessage, 
  useDeleteMessage,
  useReactToMessage,
  useTogglePinMessage,
  useReplyToMessage
} from "@/hooks/useMessages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";

import { 
  Paperclip, 
  Smile, 
  Send, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  Reply, 
  Pin, 
  PinOff 
} from "lucide-react";
import { toast } from "sonner";
import { SUPPORTED_REACTIONS, REACTION_EMOJIS, REACTION_DESCRIPTIONS } from "@/constants/emojis";

// Use the supported reactions from our constants
const REACTIONS = SUPPORTED_REACTIONS;

function getInitials(name = "?") {
  return name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function Messages() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { groupId: urlGroupId } = useParams();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Check for session expiration on component mount
  useEffect(() => {
    const showToast = sessionStorage.getItem('showSessionExpiredToast');
    if (showToast === 'true') {
      toast.error('Your session has expired. Please sign in again.');
      sessionStorage.removeItem('showSessionExpiredToast');
    }
    
    // Listen for auth toast events
    const handleAuthToast = (event) => {
      const { message, type = 'info' } = event.detail || {};
      if (message) {
        toast[type](message);
      }
    };
    
    window.addEventListener('show-auth-toast', handleAuthToast);
    
    return () => {
      window.removeEventListener('show-auth-toast', handleAuthToast);
    };
  }, []);

  // Debug token and auth state
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    console.log('[Messages] Current auth state:', { 
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? `${token.substring(0, 10)}...` : 'none',
      loading: loading ?? false, 
      user: user ? 'Authenticated' : 'Not authenticated',
      currentPath: window.location.pathname 
    });
    
    // Verify token format
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiry = new Date(payload.exp * 1000);
        console.log('[Messages] Token details:', {
          issuedTo: payload.id || payload.sub,
          expiresAt: expiry.toString(),
          isExpired: expiry < new Date(),
          roles: payload.roles || []
        });
      } catch (e) {
        console.error('[Messages] Error parsing token:', e);
      }
    }

    // Only redirect if we're not loading and there's no user
    
  }, [user, loading, navigate]);

  // Show loading state while checking auth
  if (loading) {
    console.log('[Messages] Showing loading state while checking auth');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Checking authentication...</p>
      </div>
    );
  }

  // If we're not loading but there's no user, show a message (will redirect in useEffect)
  if (!user) {
    console.log('[Messages] No user found, showing loading state (will redirect)');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse rounded-full h-12 w-12 bg-gray-200 dark:bg-gray-700 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Redirecting to sign in...</p>
      </div>
    );
  }
  
  // State
  const [activeGroupId, setActiveGroupId] = useState(urlGroupId || null);
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(null);



  // Fetch groups with enhanced logging
  const { 
    data: groups = [], 
    isLoading: groupsLoading, 
    error: groupsError 
  } = useGroups({
    onSuccess: (data) => {
      console.log('[Messages] Groups API response:', data);
      if (!data) {
        console.warn('[Messages] No groups data received');
        return;
      }
      
      const groupsData = Array.isArray(data) ? data : (data?.data || []);
      console.log(`[Messages] Processed ${groupsData.length} groups:`, groupsData.map(g => ({
        id: g.id || g._id,
        name: g.name,
        members: g.members?.length || 0,
        creator: g.creator
      })));
      
      // Log if our target group is in the list
      const targetGroup = groupsData.find(g => (g.id === '685825b7dd9997a31b410b00') || (g._id === '685825b7dd9997a31b410b00'));
      if (targetGroup) {
        console.log('[Messages] Found target group in response:', targetGroup);
      } else {
        console.warn('[Messages] Target group 685825b7dd9997a31b410b00 not found in groups');
      }
    },
    select: (data) => {
      try {
        const groupsData = Array.isArray(data) ? data : (data?.data || []);
        console.log(`[Messages] Selecting ${groupsData.length} groups`);
        
        const processedGroups = groupsData.map(group => {
          const groupWithId = {
            ...group,
            // Ensure we have a consistent id field
            id: group.id || group._id,
            unreadCount: 0
          };
          console.log(`[Messages] Processed group:`, {
            id: groupWithId.id,
            name: groupWithId.name,
            hasMembers: !!groupWithId.members,
            memberCount: groupWithId.members?.length || 0
          });
          return groupWithId;
        });
        
        return processedGroups;
      } catch (error) {
        console.error('[Messages] Error in groups select:', error);
        return [];
      }
    }
  });

  // Handle group selection
  const handleGroupClick = useCallback((e, groupId) => {
    try {
      // Safely handle the event object if it exists
      const event = e && typeof e === 'object' && 'preventDefault' in e ? e : null;
      
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      
      // If groupId is not provided as second argument, try to get it from event target
      if (typeof groupId !== 'string' && event?.currentTarget?.dataset?.groupId) {
        groupId = event.currentTarget.dataset.groupId;
        console.log('[Messages] Extracted groupId from dataset:', groupId);
      } else if (typeof groupId === 'string') {
        console.log('[Messages] Received groupId directly:', groupId);
      } else {
        console.warn('[Messages] No valid groupId provided to handleGroupClick');
        return;
      }
      
      // Only update if different from current active group
      if (groupId && groupId !== activeGroupId) {
        console.log('[Messages] Setting active group:', groupId);
        // Use React Router's navigate to update the URL
        navigate(`/messages/${groupId}`, { replace: true });
        setActiveGroupId(groupId);
      } else {
        console.log('[Messages] Group already active or invalid groupId:', groupId);
      }
    } catch (error) {
      console.error('[Messages] Error in handleGroupClick:', error);
    }
  }, [activeGroupId, navigate]);

  // Set active group from URL or first group
  useEffect(() => {
    if (!user) {
      console.log('[Messages] User not authenticated, cannot set active group');
      return;
    }
    
    if (safeGroups.length > 0) {
      // Try to find the group by URL parameter first
      let groupToSet = null;
      
      if (urlGroupId) {
        // Check if the URL group exists in our groups list
        const urlGroup = safeGroups.find(g => g.id === urlGroupId || g._id === urlGroupId);
        if (urlGroup) {
          groupToSet = urlGroup.id || urlGroup._id;
          console.log(`[Messages] Found URL group in groups list:`, { 
            groupId: groupToSet, 
            name: urlGroup.name 
          });
        } else {
          console.warn(`[Messages] URL group ${urlGroupId} not found in groups list`);
        }
      }
      
      // If no valid group from URL, use the first group
      if (!groupToSet && safeGroups.length > 0) {
        groupToSet = safeGroups[0].id || safeGroups[0]._id;
        console.log(`[Messages] Using first group as active:`, { 
          groupId: groupToSet, 
          name: groups[0].name 
        });
      }
      
      // Only update if we have a valid group and it's different from current
      if (groupToSet && groupToSet !== activeGroupId) {
        console.log('[Messages] Updating active group to:', groupToSet);
        setActiveGroupId(groupToSet);
      }
    } else {
      console.log('[Messages] No groups available to set as active');
    }
  }, [groups, urlGroupId, user, activeGroupId]);

  // Update URL when active group changes
  useEffect(() => {
    if (activeGroupId && activeGroupId !== urlGroupId) {
      console.log('[Messages] Updating URL to reflect active group:', activeGroupId);
      // Use replace: true to avoid adding to browser history
      window.history.replaceState({}, '', `/messages/${activeGroupId}`);
      
      // Force a re-render to ensure the URL is reflected in the UI
      // without triggering a full page reload
      window.dispatchEvent(new Event('popstate'));
    }
  }, [activeGroupId, urlGroupId]);

  // Fetch messages for the active group using the custom useMessages hook
  const { 
    data: messages = [], 
    isLoading: isLoadingMessages, 
    error: messagesError,
    refetch: refetchMessages,
    isError: hasMessagesError
  } = useMessages(activeGroupId, {
    enabled: !!activeGroupId,
    onSuccess: (data) => {
      console.log('[Messages] Messages API response:', data);
    },
    onError: (error) => {
      if (error?.response?.status === 401) {
        console.log('[Messages] Authentication required');
        toast.error('Your session has expired. Please sign in again.');
      } else {
        console.error('[Messages] Error fetching messages:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers
          }
        });
        toast.error('Failed to load messages. Please try again.');
      }
    },
    select: (data) => {
      if (!data) {
        console.warn('[Messages] No messages data received');
        return [];
      }
      try {
        console.log('[Messages] Raw messages data:', data);
        const messagesData = Array.isArray(data) ? data : (data?.data || []);
        console.log(`[Messages] Processed ${messagesData.length} messages`);
        
        const processedMessages = messagesData.map((msg, index) => {
          const processedMsg = {
            ...msg,
            id: msg.id || msg._id,
            isPinned: msg.isPinned || false,
            reactions: msg.reactions || [],
            sender: msg.sender || {},
            createdAt: msg.createdAt || new Date().toISOString()
          };
          
          if (index < 3) { // Log first 3 messages for debugging
            console.log(`[Messages] Message ${index + 1}:`, {
              id: processedMsg.id,
              content: processedMsg.content?.substring(0, 30) + (processedMsg.content?.length > 30 ? '...' : ''),
              sender: processedMsg.sender?.name || 'Unknown',
              createdAt: processedMsg.createdAt,
              hasAttachment: !!processedMsg.attachment
            });
          }
          
          return processedMsg;
        });
        
        return processedMessages;
      } catch (error) {
        console.error('[Messages] Error processing messages:', {
          error: error.message,
          stack: error.stack,
          data: data
        });
        return [];
      }
    },
    onError: (error) => {
      console.error('[Messages] Error fetching messages:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
      toast.error('Failed to load messages. Please try again.');
    },
    retry: 1,
    retryDelay: 1000
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Initialize mutations
  const sendMessageMutation = useSendMessage();
  const updateMessageMutation = useUpdateMessage();
  const deleteMessageMutation = useDeleteMessage();
  const reactToMessageMutation = useReactToMessage();
  const togglePinMessageMutation = useTogglePinMessage();
  const replyToMessageMutation = useReplyToMessage();

  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!message.trim() && !selectedFile) || !activeGroupId) return;

    const formData = new FormData();
    if (message.trim()) formData.append('content', message);
    if (selectedFile) formData.append('attachment', selectedFile);
    if (replyToMessage) formData.append('replyTo', replyToMessage._id || replyToMessage.id);

    try {
      await sendMessageMutation.mutateAsync({
        groupId: activeGroupId,
        formData
      });
      
      setMessage('');
      setSelectedFile(null);
      setPreviewUrl('');
      setReplyToMessage(null);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // Handle removing the selected attachment
  const removeAttachment = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    // Clear the file input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle message update
  const handleUpdateMessage = async (messageId, newContent) => {
    if (!newContent.trim()) return;
    
    try {
      await updateMessageMutation.mutateAsync({
        messageId,
        content: newContent
      });
      setEditingMessageId(null);
    } catch (error) {
      console.error('Error updating message:', error);
      toast.error('Failed to update message');
    }
  };

  // Handle message deletion
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    
    try {
      await deleteMessageMutation.mutateAsync(messageId);
      toast.success('Message deleted');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  // Debug log for message data
  useEffect(() => {
    if (messages?.length > 0) {
      console.log('Sample message with reactions:', 
        JSON.stringify(
          messages
            .filter(msg => msg.reactions?.length > 0)
            .map(msg => ({
              id: msg._id || msg.id,
              content: msg.content || msg.text,
              reactions: msg.reactions.map(r => ({
                emoji: r.emoji || r.reaction,
                count: r.count,
                users: r.users || []
              }))
            }))
            .slice(0, 3), // Only show first 3 messages with reactions
          null, 2
        )
      );
    }
  }, [messages]);

  // Handle reaction to message
  const handleReaction = async (messageId, emoji) => {
    console.log('handleReaction called with:', { messageId, emoji });
    
    if (!messageId) {
      const error = new Error('Message ID is required');
      console.error(error.message, { messageId });
      toast.error('Failed to add reaction: Message ID is missing');
      return;
    }
    
    if (!emoji) {
      const error = new Error('Emoji is required');
      console.error(error.message, { emoji });
      toast.error('Failed to add reaction: Emoji is missing');
      return;
    }
    
    try {
      console.log('Calling reactToMessageMutation with:', { 
        messageId: messageId.toString(),
        reaction: emoji 
      });
      
      const result = await reactToMessageMutation.mutateAsync({
        messageId: messageId.toString(),
        reaction: emoji
      });
      
      console.log('Reaction successful, result:', result);
      toast.success('Reaction added!');
      
      // Invalidate messages query to refresh the UI
      queryClient.invalidateQueries(['messages', activeGroupId]);
      
    } catch (error) {
      console.error('Error in handleReaction:', {
        name: error.name,
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data
        }
      });
      
      const errorMessage = error.response?.data?.message || 'Failed to add reaction';
      console.error('Error details:', errorMessage);
      toast.error(errorMessage);
    }
  };

  // Toggle message pin
  const handleTogglePin = async (messageId, currentState) => {
    try {
      await togglePinMessageMutation.mutateAsync(messageId);
      toast.success(`Message ${currentState ? 'unpinned' : 'pinned'}`);
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast.error('Failed to update pin status');
    }
  };

  // Handle reply
  const handleReply = (message) => {
    setReplyToMessage(message);
    // Focus the message input
    document.getElementById('message-input')?.focus();
  };

  // Handle sending a reply
  const handleSendReply = async (messageId, content) => {
    if (!content.trim()) return;
    
    try {
      await replyToMessageMutation.mutateAsync({
        messageId,
        content
      });
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    }
  };

  // Get user initials for avatar
  const getUserInitials = (name) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Format message timestamp
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return format(date, 'h:mm a');
    } else if (diffInDays < 7) {
      return format(date, 'EEE h:mm a');
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };

  // Ensure groups is always an array and handle API response structure
  const safeGroups = React.useMemo(() => {
    if (!groups) return [];
    try {
      // Handle both array response and object with data property
      const groupsData = Array.isArray(groups) ? groups : (groups.data || []);
      console.log('[Messages] Processed groups:', groupsData);
      
      return groupsData.map(group => {
        // Check for both name and title fields, with fallback to 'Unnamed Group'
        const groupName = group.name || group.title || 'Unnamed Group';
        const memberCount = Array.isArray(group.members) ? group.members.length : 0;
        
        console.log(`[Messages] Processing group:`, {
          id: group.id || group._id,
          name: group.name,
          title: group.title,
          finalName: groupName,
          memberCount: memberCount
        });
        
        return {
          ...group,
          id: group.id || group._id, // Ensure consistent id field
          unreadCount: group.unreadCount || 0,
          name: groupName,
          title: groupName, // Ensure title is also set for consistency
          memberCount: memberCount
        };
      });
    } catch (error) {
      console.error('Error processing groups:', error);
      return [];
    }
  }, [groups]);
  
  // Get active group from safeGroups
  const activeGroup = React.useMemo(() => {
    if (!activeGroupId || !Array.isArray(safeGroups)) return null;
    return safeGroups.find(group => group.id === activeGroupId) || null;
  }, [activeGroupId, safeGroups]);
  
  // Debug logs
  React.useEffect(() => {
    console.log('[Messages] Raw groups:', groups);
    console.log('[Messages] Processed safeGroups:', safeGroups);
    console.log('[Messages] Active group:', activeGroup);
    console.log('[Messages] Loading state:', groupsLoading);
    
    // Log detailed group information
    if (safeGroups && safeGroups.length > 0) {
      console.log('[Messages] Group details:');
      safeGroups.forEach((group, index) => {
        console.log(`[Messages] Group ${index + 1}:`, {
          id: group.id,
          _id: group._id,
          name: group.name,
          title: group.title,
          memberCount: group.memberCount,
          displayName: group.name || group.title || 'Unnamed Group',
          rawData: group
        });
      });
    }
    
    if (groupsError) {
      console.error('[Messages] Error:', groupsError);
    }
  }, [groups, safeGroups, activeGroup, groupsLoading, groupsError]);

  return (
    <div className="flex h-full min-h-[calc(100vh-64px)] bg-white dark:bg-gray-950" aria-label="Messages Page">
      {/* Sidebar */}
      <aside className="w-80 flex-shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col" aria-label="Groups List">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
              Messages
            </h1>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {safeGroups.length} {safeGroups.length === 1 ? 'group' : 'groups'}
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <svg
              className="absolute right-3 top-2.5 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Your Groups">
          {groupsLoading && (
            <div className="px-4 py-3 text-gray-400 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          )}
          {groupsError && (
            <div className="mx-3 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">
              Failed to load groups. <button onClick={() => refetch()} className="text-primary-600 dark:text-primary-400 hover:underline">Retry</button>
            </div>
          )}
          {!groupsLoading && safeGroups.length === 0 && (
            <div className="px-4 py-6 text-center">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400">No groups yet</p>
              <p className="text-sm text-gray-400 mt-1">Create or join a group to start messaging</p>
            </div>
          )}
          {safeGroups.map((group) => {
            const groupId = group.id || group._id;
            return (
              <div
                key={groupId}
                data-group-id={groupId}
                className={`w-full flex items-center gap-3 px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 hover:bg-primary-50 dark:hover:bg-gray-900 transition rounded-lg mb-1 cursor-pointer select-none ${
                  activeGroupId === groupId 
                    ? "bg-gradient-to-r from-primary-100 via-purple-100 to-blue-100 dark:from-primary-900 dark:via-purple-900 dark:to-blue-900 font-bold shadow" 
                    : ""
                }`}
                onClick={(e) => handleGroupClick(e, groupId)}
                onKeyDown={(e) => {
                  // Handle keyboard navigation (Enter/Space)
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleGroupClick(e, groupId);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-current={activeGroupId === groupId ? "page" : undefined}
              >
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary-200 text-primary-700 font-bold">
                  {(group.name || group.title || 'G')[0].toUpperCase()}
                </span>
                <span className="flex-1 truncate">{group.name || group.title || 'Unnamed Group'}</span>
                {group.unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2 text-xs px-2 py-0.5">
                    {group.unreadCount}
                  </Badge>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        {activeGroupId ? (
          <>
            {/* Chat Header */}
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-md">
                    {getInitials(activeGroup?.title || 'GC')}
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {activeGroup?.title || 'Group Chat'}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center">
                        <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
                        {activeGroup?.memberCount === 1 
                          ? '1 member' 
                          : `${activeGroup?.memberCount || 0} members`}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900" ref={messagesEndRef}>
              <div className="max-w-4xl mx-auto w-full p-4 space-y-4">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-100 border-t-primary-500"></div>
                      <p className="text-sm text-gray-500">Loading messages...</p>
                    </div>
                  </div>
                ) : messagesError ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-3">
                      <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Failed to load messages</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">We couldn't load the messages. Please try again.</p>
                    <Button onClick={refetchMessages} variant="outline">
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Retry
                    </Button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
                    <div className="bg-primary-50 dark:bg-primary-900/20 p-5 rounded-full mb-4">
                      <svg className="h-12 w-12 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50" ref={messagesEndRef}>
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-64">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-100 border-t-primary-500"></div>
                    <p className="text-sm text-gray-500">Loading messages...</p>
                  </div>
                </div>
              ) : messagesError ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-3">
                    <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Failed to load messages</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">We couldn't load the messages. Please try again.</p>
                  <Button onClick={refetchMessages} variant="outline">
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry
                  </Button>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
                  <div className="bg-primary-50 dark:bg-primary-900/20 p-5 rounded-full mb-4">
                    <svg className="h-12 w-12 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No messages yet</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-md">
                    Send a message to start the conversation in {activeGroup?.name || 'this group'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isMe = user && (msg.sender?._id === user.id || msg.senderId === user.id);
                    const isEditing = editingMessageId === (msg._id || msg.id);
                    const isHovered = hoveredMessageId === (msg._id || msg.id);
                    const hasReactions = msg.reactions && msg.reactions.length > 0;

                    return (
                      <div 
                        key={msg._id || msg.id}
                        className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        onMouseEnter={() => setHoveredMessageId(msg._id || msg.id)}
                        onMouseLeave={() => setHoveredMessageId(null)}
                      >
                        {/* Sender Avatar (left side) */}
                        {!isMe && (
                          <div className="flex-shrink-0 mr-3">
                            <Avatar 
                              className="h-10 w-10"
                              fallback={
                                <span className="bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 h-full w-full flex items-center justify-center">
                                  {getUserInitials(msg.sender?.name || msg.senderName || '?')}
                                </span>
                              }
                            />
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div className="relative max-w-[75%] md:max-w-[60%] lg:max-w-[50%]">
                          {/* Message Header */}
                          <div className={`flex items-center mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {!isMe && (
                              <span className="text-sm font-medium text-gray-900 dark:text-white mr-2">
                                {msg.sender?.name || msg.senderName || 'User'}
                              </span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatMessageTime(msg.createdAt || msg.timestamp)}
                            </span>
                          </div>

                          {/* Message Content */}
                          <div 
                            className={`relative rounded-2xl px-4 py-2 ${
                              isMe 
                                ? 'bg-blue-500 text-white rounded-tr-none' 
                                : 'bg-white text-gray-900 rounded-tl-none shadow-sm border border-gray-100'
                            }`}
                          >
                            {/* Reply Preview */}
                            {msg.replyTo && (
                              <div className={`text-xs p-2 mb-2 rounded-lg ${
                                isMe ? 'bg-primary-700/50' : 'bg-gray-200/50 dark:bg-gray-700/50'
                              }`}>
                                <div className="font-medium truncate">
                                  {msg.replyTo.sender?._id === user.id ? 'You' : msg.replyTo.sender?.name || 'User'}
                                </div>
                                <div className="truncate opacity-80">
                                  {msg.replyTo.content || msg.replyTo.text || 'Message'}
                                </div>
                              </div>
                            )}

                            {/* Message Text */}
                            <div className="whitespace-pre-wrap break-words">
                              {msg.content || msg.text}
                            </div>

                            {/* Reactions */}
                            {msg.reactions?.length > 0 && (
                              <div className="flex items-center gap-1 mt-1.5">
                                {msg.reactions
                              // Filter out unsupported reaction types
                              ?.filter(reaction => 
                                SUPPORTED_REACTIONS.includes(reaction.reaction || '')
                              )
                              // Group by reaction type to show count
                              .reduce((acc, reaction) => {
                                const reactionType = reaction.reaction;
                                const existing = acc.find(r => r.reaction === reactionType);
                                if (existing) {
                                  existing.count++;
                                  existing.hasReacted = existing.hasReacted || 
                                    (reaction.users?.some(u => u._id === user.id || u === user.id));
                                } else {
                                  acc.push({
                                    reaction: reactionType,
                                    count: 1,
                                    hasReacted: reaction.users?.some(u => u._id === user.id || u === user.id) || false
                                  });
                                }
                                return acc;
                              }, [])
                              // Sort by count (descending)
                              .sort((a, b) => b.count - a.count)
                              // Render the reaction buttons
                              .map(({ reaction, count, hasReacted }) => (
                                <Button
                                  key={reaction}
                                  variant="ghost"
                                  size="sm"
                                  className={`h-6 px-1.5 text-xs ${
                                    hasReacted
                                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200' 
                                      : 'bg-gray-100 dark:bg-gray-700'
                                  }`}
                                  onClick={() => handleReaction(msg._id || msg.id, reaction)}
                                  aria-label={`${REACTION_DESCRIPTIONS[reaction] || reaction} (${count} reaction${count > 1 ? 's' : ''})`}
                                  title={`${REACTION_DESCRIPTIONS[reaction] || reaction} (${count} reaction${count > 1 ? 's' : ''})`}
                                >
                                  {REACTION_EMOJIS[reaction] || reaction} {count > 1 ? count : ''}
                                </Button>
                              ))
                            }
                              </div>
                            )}

                            {/* Message Actions (shown on hover) */}
                            <div 
                              className={`absolute -right-2 -top-2 flex space-x-1 bg-white dark:bg-gray-800 rounded-full shadow-md p-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                                isHovered ? 'opacity-100' : ''
                              }`}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full"
                                onClick={() => handleReply(msg)}
                              >
                                <Reply className="h-3.5 w-3.5" />
                              </Button>
                              {isMe && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-full"
                                    onClick={() => {
                                      setMessage(msg.content || msg.text);
                                      setEditingMessageId(msg._id || msg.id);
                                    }}
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"
                                    onClick={() => handleDeleteMessage(msg._id || msg.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowReactionPicker(prev => prev === (msg._id || msg.id) ? null : (msg._id || msg.id));
                                }}
                                aria-label="Add reaction"
                              >
                                <Smile className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full"
                                onClick={() => handleTogglePin(msg._id || msg.id, msg.isPinned)}
                              >
                                {msg.isPinned ? (
                                  <PinOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Pin className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                            
                            {/* Reaction Picker (shown on click) */}
                            {showReactionPicker === (msg._id || msg.id) && (
                              <div className="absolute bottom-full left-0 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-1 p-1">
                                  {REACTIONS.map((reaction) => (
                                    <Button
                                      key={reaction}
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                                      onClick={() => {
                                        handleReaction(msg._id || msg.id, reaction);
                                        setShowReactionPicker(null);
                                      }}
                                      aria-label={`React with ${REACTION_DESCRIPTIONS[reaction] || reaction}`}
                                      title={`React with ${REACTION_DESCRIPTIONS[reaction] || reaction}`}
                                    >
                                      {REACTION_EMOJIS[reaction]}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Sender Avatar (right side) */}
                        {isMe && (
                          <div className="flex-shrink-0 ml-3">
                            <Avatar 
                              className="h-10 w-10"
                              fallback={
                                <span className="bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 h-full w-full flex items-center justify-center">
                                  {getUserInitials(user?.name || user?.email || 'Me')}
                                </span>
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>
            
            {/* Message Input */}
            <div className="sticky bottom-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800 p-4 shadow-lg">
              {replyToMessage && (
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-t-lg px-4 py-2 border border-gray-100 dark:border-gray-700">
                  <div className="flex-1 truncate text-sm text-gray-600 dark:text-gray-300">
                    Replying to <span className="font-medium">{replyToMessage.sender?.name || 'Unknown'}</span>: {replyToMessage.content?.substring(0, 30)}{replyToMessage.content?.length > 30 ? '...' : ''}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    onClick={() => setReplyToMessage(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-gray-500 hover:bg-gray-100"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-5 w-5" />
                  <span className="sr-only">Attach file</span>
                </Button>
                <div className="relative flex-1">
                  <Input
                    id="message-input"
                    type="text"
                    placeholder="Type a message..."
                    className="rounded-full border-gray-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 pr-12"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    disabled={sendMessageMutation.isLoading}
                  />
                </div>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full bg-blue-500 text-white hover:bg-blue-600"
                  disabled={!message.trim() || sendMessageMutation.isLoading}
                  onClick={handleSendMessage}
                >
                  {sendMessageMutation.isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                  <span className="sr-only">Send message</span>
                </Button>
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                onChange={handleFileChange}
                accept="image/*,.pdf,.doc,.docx"
              />
            </div>
            {previewUrl && (
              <div className="mt-2 relative inline-block">
                <div className="relative group">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="h-20 w-20 object-cover rounded-md border border-gray-200 dark:border-gray-700"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -right-2 -top-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={removeAttachment}
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove attachment</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center p-8 max-w-md">
              <div className="mx-auto h-16 w-16 text-gray-400 mb-4">
                <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No group selected</h3>
              <p className="text-gray-500 dark:text-gray-400">Select a group or create a new one to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
