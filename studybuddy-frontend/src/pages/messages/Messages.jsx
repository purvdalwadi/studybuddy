import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from "@/components/ErrorBoundary";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import MessageItem from "@/components/MessageItem";

// Import the avatar utilities
import { 
  getGroupAvatarUrl, 
  getGroupInitials,
  getAvatarUrl,
  extractGroupAvatar,
  extractUserAvatar,
  getUserInitials
} from '@/utils/avatarUtils';

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
  Trash2, 
  Edit2, 
  X, 
  Reply, 
  Pin, 
  PinOff,
  MoreVertical,
  Check,
  Plus,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { SUPPORTED_REACTIONS, REACTION_EMOJIS, REACTION_DESCRIPTIONS } from "@/constants/emojis";
import { groupMessagesByDate, formatMessageTime, formatDateHeader, DateSeparator } from "@/utils/groupMessages";

// Use the supported reactions from our constants
const REACTIONS = SUPPORTED_REACTIONS;

// Using getInitials from avatarUtils.js

// Custom hook for handling authentication toasts
function useAuthToast() {
  useEffect(() => {
    const showToast = sessionStorage.getItem('showSessionExpiredToast');
    if (showToast === 'true') {
      toast.error('Your session has expired. Please sign in again.');
      sessionStorage.removeItem('showSessionExpiredToast');
    }
  }, []);
}

// Helper function to process messages data
const processMessagesData = (data) => {
  if (!data) return [];
  try {
    const messagesData = Array.isArray(data) ? data : (data?.data || []);
    return messagesData;
  } catch (error) {
    console.error('[Messages] Error processing messages data:', error);
    return [];
  }
};

// Helper function to process groups data
const processGroupsData = (data, userId) => {
  if (!data) return [];
  try {
    const groups = Array.isArray(data) ? data : (data.data || []);
    
    // Filter groups where the current user is a member
    const userGroups = groups.filter(group => {
      // Check if group has members array and current user is a member
      const isMember = Array.isArray(group.members) && 
        group.members.some(member => {
          // Handle different member object structures
          const memberId = member?.user?._id || member?.user?.id || member?.user || member?._id || member?.id;
          return memberId && memberId.toString() === userId?.toString();
        });
      
      // Also include groups where user is the creator
      const isCreator = group.creator?._id?.toString() === userId?.toString() || 
                       group.creator?.toString() === userId?.toString();
      
      return isMember || isCreator;
    });
    
    console.log('[Messages] Filtered user groups:', {
      totalGroups: groups.length,
      userGroupsCount: userGroups.length,
      userId,
      sampleGroup: groups[0] ? {
        _id: groups[0]._id,
        name: groups[0].name,
        members: groups[0].members?.map(m => ({
          _id: m?._id,
          user: m?.user?._id || m?.user,
          role: m?.role
        })),
        creator: groups[0].creator
      } : null
    });
    
    return userGroups;
  } catch (error) {
    console.error('[Messages] Error processing groups data:', error);
    return [];
  }
};

// Custom hook for message state management
const useMessageState = (activeGroupId, authState) => {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(null);

  const mutationConfig = useMemo(() => ({
    onError: (error) => {
      console.error('Mutation error:', error);
      toast.error('An error occurred');
    }
  }), []);

  const sendMessageMutation = useSendMessage(mutationConfig);
  const updateMessageMutation = useUpdateMessage(mutationConfig);
  const deleteMessageMutation = useDeleteMessage(mutationConfig);
  const reactToMessageMutation = useReactToMessage(mutationConfig);
  const togglePinMessageMutation = useTogglePinMessage(mutationConfig);
  const replyToMessageMutation = useReplyToMessage(mutationConfig);

  const messagesConfig = useMemo(() => ({
    enabled: !!activeGroupId && authState.isAuthenticated,
    onError: (error) => {
      console.error('[Messages] Error fetching messages:', error);
      toast.error('Failed to load messages');
    },
    select: processMessagesData
  }), [activeGroupId, authState.isAuthenticated]);
  
  const { 
    data: messages = [], 
    isLoading: isLoadingMessages, 
    error: messagesError,
    refetch: refetchMessages,
    isError: hasMessagesError
  } = useMessages(activeGroupId, messagesConfig);

  return {
    message, setMessage,
    selectedFile, setSelectedFile,
    previewUrl, setPreviewUrl,
    editingMessageId, setEditingMessageId,
    replyToMessage, setReplyToMessage,
    showEmojiPicker, setShowEmojiPicker,
    hoveredMessageId, setHoveredMessageId,
    showReactionPicker, setShowReactionPicker,
    sendMessageMutation,
    updateMessageMutation,
    deleteMessageMutation,
    reactToMessageMutation,
    togglePinMessageMutation,
    replyToMessageMutation,
    messages,
    isLoadingMessages,
    messagesError,
    refetchMessages,
    hasMessagesError
  };
};

// Custom hook for group state management
const useGroupState = (authState) => {
  const [activeGroupId, setActiveGroupId] = useState(null);
  
  // Get user ID from auth state, handling different possible structures
  const getUserId = useCallback(() => {
    if (!authState.user) {
      console.log('[Messages] No user in authState');
      return null;
    }
    
    // Handle nested user object (common in some auth patterns)
    const userObj = authState.user.data || authState.user.user || authState.user;
    
    // Try to extract user ID from various possible locations
    const userId = userObj?._id || userObj?.id || 
                  authState.user._id || authState.user.id ||
                  authState.user.userId;
    
    console.log('[Messages] Extracted user ID:', userId, { 
      hasUser: !!authState.user,
      userKeys: authState.user ? Object.keys(authState.user) : []
    });
    
    return userId?.toString(); // Ensure consistent string format
  }, [authState.user]);
  
  const userId = getUserId();
  
  console.log('[Messages] useGroupState - User ID:', userId, {
    authUser: authState.user,
    hasUserId: !!userId
  });

  const groupsConfig = useMemo(() => ({
    enabled: authState.isAuthenticated && !!userId,
    onError: (error) => {
      console.error('[Messages] Error fetching groups:', error);
      if (error.response?.status === 401) {
        toast.error('Your session has expired. Please log in again.');
      }
    },
    select: (data) => {
      console.log('[Messages] Processing groups data with userId:', userId);
      return processGroupsData(data, userId);
    }
  }), [authState.isAuthenticated, userId]);
  
  const { 
    data: groups, 
    isLoading: isLoadingGroups, 
    error: groupsError,
    refetch: refetchGroups
  } = useGroups(groupsConfig);

  return {
    activeGroupId,
    setActiveGroupId,
    groups,
    isLoadingGroups,
    groupsError,
    refetchGroups
  };
};

export default function Messages() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { groupId: urlGroupId } = useParams();
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const { user, loading } = useAuth();
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [authState, setAuthState] = useState({
    isLoading: true,
    isAuthenticated: false
  });

  useAuthToast();

  const {
    activeGroupId,
    setActiveGroupId,
    groups,
    isLoadingGroups,
    groupsError,
    refetchGroups
  } = useGroupState(authState);

  const {
    message, setMessage,
    selectedFile, setSelectedFile,
    previewUrl, setPreviewUrl,
    editingMessageId, setEditingMessageId,
    replyToMessage, setReplyToMessage,
    showEmojiPicker, setShowEmojiPicker,
    hoveredMessageId, setHoveredMessageId,
    showReactionPicker, setShowReactionPicker,
    sendMessageMutation,
    updateMessageMutation,
    deleteMessageMutation,
    reactToMessageMutation,
    togglePinMessageMutation,
    replyToMessageMutation,
    messages,
    isLoadingMessages,
    messagesError,
    refetchMessages,
    hasMessagesError
  } = useMessageState(activeGroupId, authState);

  const safeGroups = useMemo(() => {
    if (!groups) return [];
    try {
      const groupsData = Array.isArray(groups) ? groups : (groups.data || []);
      return groupsData.map(group => ({
        ...group, // Spread the original group object first
        // Then apply our overrides
        id: group.id || group._id,
        _id: group._id || group.id,
        title: group.title || group.name,
        name: group.name || group.title,
        description: group.description || '',
        members: group.members || [],
        memberCount: group.memberCount || (group.members ? group.members.length : 0),
        creator: group.creator,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        isActive: group.isActive !== false
      }));
    } catch (error) {
      console.error('[Messages] Error processing groups data:', error);
      return [];
    }
  }, [groups]);
  
  const activeGroup = useMemo(() => {
    if (!activeGroupId || !Array.isArray(safeGroups)) return null;
    const group = safeGroups.find(group => group.id === activeGroupId) || null;
    if (group) {
      console.log('Active Group:', {
        id: group.id,
        title: group.title,
        avatar: group.avatar,
        hasAvatar: !!group.avatar,
        avatarType: typeof group.avatar,
        avatarUrl: extractGroupAvatar(group),
        avatarKeys: group.avatar ? Object.keys(group.avatar) : 'no avatar',
        fullGroup: JSON.stringify(group, null, 2)
      });
      
      // Debug: Check if avatar exists but isn't showing
      if (group.avatar) {
        console.log('Group Avatar Debug:', {
          avatarExists: !!group.avatar,
          avatarType: typeof group.avatar,
          isObject: group.avatar && typeof group.avatar === 'object',
          hasUrl: group.avatar?.url || group.avatar?.secure_url,
          extractResult: extractGroupAvatar(group)
        });
      }
    }
    return group;
  }, [activeGroupId, safeGroups]);
  
  // Set initial active group from URL params when groups are loaded
  useEffect(() => {
    if (urlGroupId && !activeGroupId && safeGroups.length > 0) {
      const groupExists = safeGroups.some(g => g.id === urlGroupId || g._id === urlGroupId);
      if (groupExists) {
        setActiveGroupId(urlGroupId);
      } else if (safeGroups.length > 0) {
        setActiveGroupId(safeGroups[0].id || safeGroups[0]._id);
      }
    } else if (!activeGroupId && safeGroups.length > 0) {
      setActiveGroupId(safeGroups[0].id || safeGroups[0]._id);
    }
  }, [urlGroupId, safeGroups, activeGroupId, setActiveGroupId]);
  
  // Handle authentication state
  useEffect(() => {
    if (loading) {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      return;
    }
    
    if (!user) {
      setAuthState({ isLoading: false, isAuthenticated: false });
      setIsAuthChecked(true);
      navigate('/login');
      return;
    }
    
    setAuthState({ isLoading: false, isAuthenticated: true });
    setIsAuthChecked(true);
  }, [user, loading, navigate]);
  
  // Update URL when active group changes
  useEffect(() => {
    if (activeGroupId) {
      refetchMessages();
    }
  }, [activeGroupId, refetchMessages]);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesEndRef]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle file selection
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }, []);

  // Remove attachment
  const removeAttachment = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Handle message deletion with optimistic updates
  const handleDeleteMessage = useCallback(async (messageId) => {
    if (!messageId || !activeGroupId || !window.confirm('Are you sure you want to delete this message?')) {
      return;
    }
    
    // Store the current messages for rollback in case of error
    const previousMessages = queryClient.getQueryData(['messages', activeGroupId]);
    
    try {
      // Optimistically update the UI by removing the message
      queryClient.setQueryData(['messages', activeGroupId], (old) => {
        if (!old) return old;
        const oldData = Array.isArray(old) ? old : (old.data || []);
        return oldData.filter(msg => msg.id !== messageId && msg._id !== messageId);
      });
      
      // Perform the actual deletion with the groupId
      await deleteMessageMutation.mutateAsync(
        { messageId, groupId: activeGroupId },
        {
          onSuccess: () => {
            toast.success('Message deleted');
            // No need to manually refetch as the query will be invalidated by the hook
          },
          onError: (error) => {
            console.error('Error deleting message:', error);
            // Revert to previous messages on error
            queryClient.setQueryData(['messages', activeGroupId], previousMessages);
            toast.error(error.response?.data?.message || 'Failed to delete message');
          }
        }
      );
      
    } catch (error) {
      console.error('Error in delete operation:', error);
      toast.error('An error occurred while deleting the message');
      // Revert to previous messages on error
      queryClient.setQueryData(['messages', activeGroupId], previousMessages);
    }
  }, [deleteMessageMutation, activeGroupId, queryClient]);

  // Handle message edit
  const handleEditMessage = useCallback(async (messageId, newContent) => {
    if (!messageId || !newContent?.trim()) return;
    
    try {
      await updateMessageMutation.mutateAsync({
        messageId,
        content: newContent.trim()
      });
      setEditingMessageId(null);
      refetchMessages();
    } catch (error) {
      console.error('Error updating message:', error);
      toast.error('Failed to update message');
    }
  }, [updateMessageMutation, refetchMessages]);

  // Group click handler
  const handleGroupClick = useCallback((e, groupId) => {
    try {
      if (e?.preventDefault) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      const targetGroupId = typeof groupId === 'string' 
        ? groupId 
        : e?.currentTarget?.dataset?.groupId;
      
      if (!targetGroupId) return;
      
      if (targetGroupId !== activeGroupId) {
        setActiveGroupId(targetGroupId);
      }
    } catch (error) {
      console.error('[Messages] Error in handleGroupClick:', error);
    }
  }, [activeGroupId, setActiveGroupId]);
  
  // Handle sending a new message
  const handleSendMessage = useCallback(async (e) => {
    e?.preventDefault();
    if ((!message.trim() && !selectedFile) || !activeGroupId) return;

    try {
      const formData = new FormData();
      if (message.trim()) formData.append('content', message);
      if (selectedFile) formData.append('attachment', selectedFile);
      if (replyToMessage) formData.append('replyTo', replyToMessage._id || replyToMessage.id);

      await sendMessageMutation.mutateAsync({
        groupId: activeGroupId,
        formData
      });

      setMessage('');
      setSelectedFile(null);
      setPreviewUrl('');
      setReplyToMessage(null);
      
      // Refetch messages and scroll to bottom
      await refetchMessages();
      scrollToBottom();
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    }
  }, [
    message, 
    activeGroupId, 
    selectedFile, 
    replyToMessage, 
    sendMessageMutation, 
    refetchMessages, 
    scrollToBottom,
    setMessage,
    setSelectedFile,
    setPreviewUrl,
    setReplyToMessage
  ]);

  // Handle reaction to message
  const handleReaction = useCallback(async (messageId, emoji) => {
    if (!messageId || !emoji) return { action: 'error', error: 'Invalid parameters' };

    try {
      const message = messages.find(m => m._id === messageId || m.id === messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      // Check if user already has a reaction on this message
      const userReaction = message.reactions?.find(
        r => {
          const userId = user?.id || user?.data?._id;
          return (
            (r.user?._id === userId) || 
            (r.user === userId) ||
            (r.userId === userId)
          );
        }
      );

      // Determine if this is the same reaction (toggle off) or a different one (replace)
      const isSameReaction = userReaction?.reaction === emoji;
      const shouldRemove = isSameReaction;
      
      // Prepare the reaction data for the API
      const reactionData = {
        messageId,
        reaction: shouldRemove ? null : emoji, // null to remove, emoji to add/update
        groupId: message.groupId // Add groupId for cache invalidation
      };

      const result = await new Promise((resolve, reject) => {
        reactToMessageMutation.mutate(reactionData, {
          onSuccess: (updatedMessage) => {
            // Update the local state with the server response
            refetchMessages().then(() => {
              // Determine the action type
              let action;
              if (shouldRemove) {
                action = 'removed';
              } else if (userReaction) {
                action = 'replaced';
              } else {
                action = 'added';
              }
              
              resolve({
                action,
                emoji: shouldRemove ? null : emoji,
                messageId,
                previousEmoji: userReaction?.reaction
              });
            }).catch(reject);
          },
          onError: (error) => {
            console.error('Error reacting to message:', error);
            reject(new Error(error.message || 'Failed to update reaction'));
          }
        });
      });

      setShowReactionPicker(null);
      return result;
    } catch (error) {
      console.error('Error in handleReaction:', error);
      throw error;
    }
  }, [messages, user?.id, reactToMessageMutation, refetchMessages]);

  // Toggle message pin
  const handleTogglePin = useCallback(async (messageId, currentState) => {
    if (!messageId) {
      console.error('No message ID provided for pin toggle');
      return;
    }
    
    console.log('Toggling pin for message:', { messageId, currentState });
    
    try {
      // Get current messages from cache
      const messagesQueryKey = ['messages', activeGroupId];
      const previousData = queryClient.getQueryData(messagesQueryKey);
      
      // Ensure we have an array to work with
      const previousMessages = Array.isArray(previousData) 
        ? previousData 
        : [];
      
      // Only proceed with optimistic update if we have messages
      if (previousMessages.length > 0) {
        const updatedMessages = previousMessages.map(msg => 
          (msg._id === messageId || msg.id === messageId) 
            ? { ...msg, isPinned: !currentState }
            : msg
        );
        
        // Update the query cache optimistically
        queryClient.setQueryData(messagesQueryKey, updatedMessages);
      }
      
      // Make the API call
      const result = await togglePinMessageMutation.mutateAsync(messageId);
      
      // Invalidate and refetch messages to ensure consistency
      await Promise.all([
        queryClient.invalidateQueries(['messages', activeGroupId]),
        refetchMessages()
      ]);
      
      toast.success(`Message ${currentState ? 'unpinned' : 'pinned'} successfully`);
      return result;
    } catch (error) {
      console.error('Error in handleTogglePin:', error);
      
      // Revert on error by invalidating the query
      queryClient.invalidateQueries(['messages', activeGroupId]);
      
      const errorMessage = error.response?.data?.message || 
                         error.message || 
                         'Failed to update pin status';
      
      toast.error(errorMessage);
      throw error; // Re-throw to allow error boundaries to catch it if needed
    }
  }, [togglePinMessageMutation, activeGroupId, queryClient, refetchMessages]);

  // Handle reply
  const handleReply = useCallback((message) => {
    setReplyToMessage(message);
    // Scroll to input and focus it
    document.getElementById('message-input')?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
      document.getElementById('message-input')?.focus();
    }, 100);
  }, [setReplyToMessage]);

  // Helper function to determine if a message is from the current user
  const isMessageFromUser = useCallback((messageUser) => {
    return user && (
      messageUser?._id === user.id || 
      messageUser?.id === user.id || 
      messageUser === user.id
    );
  }, [user]);

  // Group messages by date using the utility function and separate pinned messages
  const { pinnedMessages, regularMessages } = useMemo(() => {
    if (!messages || !messages.length) {
      return { pinnedMessages: [], regularMessages: [] };
    }
    
    // Create a fresh copy of messages and sort them by creation time
    const sortedMessages = [...messages]
      .filter(Boolean)
      .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
    
    // Separate pinned and regular messages
    const pinned = [];
    const regular = [];
    
    sortedMessages.forEach(message => {
      const processedMessage = {
        ...message,
        isMyMessage: isMessageFromUser(message.sender)
      };
      
      if (message.isPinned) {
        pinned.push(processedMessage);
      } else {
        regular.push(processedMessage);
      }
    });
    
    // Group pinned messages by date
    const groupedPinned = [];
    if (pinned.length > 0) {
      // Add pinned header
      groupedPinned.push({
        id: 'pinned-header',
        type: 'header',
        text: 'Pinned Messages',
        date: 'pinned',
        isPinnedHeader: true
      });
      
      // Group pinned messages by date and add to pinned section
      const pinnedByDate = groupMessagesByDate(pinned);
      groupedPinned.push(...pinnedByDate);
    }
    
    // Group messages by date with separator above the day's messages
    const groupedRegular = [];
    let currentDate = null;
    
    // First, group messages by date
    const messagesByDate = {};
    
    regular.forEach(message => {
      const messageDate = new Date(message.createdAt || message.timestamp);
      const dateStr = messageDate.toDateString();
      
      if (!messagesByDate[dateStr]) {
        messagesByDate[dateStr] = [];
      }
      
      messagesByDate[dateStr].push({
        ...message,
        type: 'message',
        dateStr: dateStr
      });
    });
    
    // Then, create the grouped array with date separators above each day's messages
    Object.entries(messagesByDate).forEach(([dateStr, dateMessages]) => {
      // Add date separator
      groupedRegular.push({
        type: 'date',
        date: new Date(dateStr),
        id: `date-${dateStr}`,
        header: formatDateHeader(dateStr),
        dateStr: dateStr
      });
      
      // Add all messages for this date
      groupedRegular.push(...dateMessages);
    });
    
    return {
      pinnedMessages: groupedPinned,
      regularMessages: groupedRegular
    };
  }, [messages, messages?.length, isMessageFromUser]);
  
  // Combine pinned and regular messages with pinned messages at the top
  const allMessages = useMemo(() => {
    return [...pinnedMessages, ...regularMessages];
  }, [pinnedMessages, regularMessages]);

  // Handle click outside reaction picker and scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showReactionPicker && !e.target.closest('.emoji-picker-container') && !e.target.closest('.emoji-trigger')) {
        setShowReactionPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showReactionPicker]);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages?.length > 0) {
      scrollToBottom();
    }
  }, [messages, activeGroupId]);

  // Render the main content or auth state
  if (!authState?.isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">Please sign in to continue</h3>
          <Button onClick={() => navigate('/login')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  // Render loading state if auth is still being checked
  if (!isAuthChecked) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Left sidebar - Groups list */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col" aria-label="Groups List">
        {/* Groups list header */}
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
          {isLoadingGroups && (
            <div className="px-4 py-3 text-gray-400 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            </div>
          )}
          {groupsError && (
            <div className="mx-3 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">
              Failed to load groups. <button type="button" onClick={() => refetchGroups()} className="text-primary-600 dark:text-primary-400 hover:underline">Retry</button>
            </div>
          )}
          {!isLoadingGroups && safeGroups.length === 0 && (
            <div className="px-4 py-6 text-center">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400">No groups yet</p>
              <p className="text-sm text-gray-400 mt-1">Create or join a group to start messaging</p>
            </div>
          )}
          {safeGroups.map((group) => {
            const groupId = group.id || group._id;
            return (
              <motion.div
                key={groupId}
                data-group-id={groupId}
                className={`relative w-full flex items-center gap-3 px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 hover:bg-primary-50/50 dark:hover:bg-gray-900/50 transition rounded-lg mb-1 cursor-pointer select-none ${
                  activeGroupId === groupId ? "font-medium" : ""
                }`}
                onClick={(e) => handleGroupClick(e, groupId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleGroupClick(e, groupId);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-current={activeGroupId === groupId ? "page" : undefined}
                initial={false}
              >
                {activeGroupId === groupId && (
                  <motion.div
                    layoutId="activeGroupBackground"
                    className="absolute inset-0 bg-gradient-to-r from-primary-100 via-purple-100 to-blue-100 dark:from-primary-900/30 dark:via-purple-900/30 dark:to-blue-900/30 rounded-lg"
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 25,
                      mass: 0.5
                    }}
                    style={{
                      zIndex: 0,
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
                    }}
                  />
                )}
                <div className="relative z-10 flex items-center w-full">
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
              </motion.div>
            );
          })}
        </nav>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        {activeGroupId ? (
          <>
            {/* Debug activeGroup data */}
            {console.log('activeGroup data:', {
              id: activeGroup?.id,
              title: activeGroup?.title,
              avatar: activeGroup?.avatar,
              avatarType: typeof activeGroup?.avatar,
              avatarKeys: activeGroup?.avatar ? Object.keys(activeGroup.avatar) : 'no avatar',
              extractResult: extractGroupAvatar(activeGroup),
              hasAvatar: !!activeGroup?.avatar,
              isBase64: activeGroup?.avatar?.startsWith?.('data:image/')
            })}
            
            {/* Chat Header */}
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative h-12 w-12 flex-shrink-0">
                    <Avatar className="h-full w-full">
                      {(() => {
                        // Match GroupCard's implementation exactly
                        const groupAvatar = getAvatarUrl(activeGroup?.avatar);
                        
                        // Use first letters of words in group title, or 'G' as fallback
                        const getInitials = (name) => {
                          if (!name) return 'G';
                          const words = name.trim().split(/\s+/);
                          if (words.length === 1) return words[0].charAt(0).toUpperCase();
                          return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
                        };
                        const groupAvatarPlaceholder = getInitials(activeGroup?.title);

                        return (
                          <>
                            {activeGroup?.avatar ? (
                              <>
                                <img
                                  src={groupAvatar}
                                  alt={activeGroup?.title ? `${activeGroup.title} group avatar` : 'Group avatar'}
                                  className="h-full w-full object-cover"
                                  style={{ display: 'none' }}
                                  onLoad={(e) => {
                                    setTimeout(() => {
                                      e.target.style.display = 'block';
                                    }, 0.001);
                                  }}

                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold">
                                  {groupAvatarPlaceholder}
                                </div>
                              </>
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold">
                                {groupAvatarPlaceholder}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </Avatar>
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {activeGroup?.title || 'Group Chat'}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center">
                        <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                        {activeGroup?.memberCount === 1 
                          ? '1 member' 
                          : `${activeGroup?.memberCount || 0} members`}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    aria-label="Group options"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
              <div className="w-full p-2 space-y-1">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-100 border-t-primary-500" />
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
                  <ErrorBoundary 
                    onReset={() => {
                      if (messagesError) {
                        refetchMessages();
                      }
                    }}
                  >
                    <div className="space-y-1">
                      {allMessages.map((item, index) => {
                        // Handle date separators
                        if (item.type === 'date') {
                          // Check if there are any messages for this date
                          const hasMessagesForThisDate = allMessages.some((msg, i) => 
                            i > index && 
                            msg.type === 'message' && 
                            new Date(msg.createdAt || msg.timestamp).toDateString() === item.dateStr
                          );
                          
                          if (!hasMessagesForThisDate) {
                            return null; // Skip date separator if no messages for this date
                          }
                          
                          return (
                            <DateSeparator 
                              key={`date-${item.dateStr}-${index}`}
                              date={item.header} 
                            />
                          );
                        }
                        
                        // Handle pinned header
                        if (item.isPinnedHeader) {
                          // Only show pinned header if there are pinned messages after it
                          const hasPinnedMessages = allMessages.some((msg, i) => 
                            i > index && msg.type === 'message' && msg.isPinned
                          );
                          
                          if (!hasPinnedMessages) {
                            return null; // Skip pinned header if no pinned messages
                          }
                          
                          return (
                            <DateSeparator 
                              key="pinned-header"
                              date="Pinned Messages"
                              className="text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
                            />
                          );
                        }
                        
                        const msg = item;
                        // Get all possible sender IDs from the message
                        const senderId = msg.sender?._id || msg.sender?.id || msg.senderId;
                        
                        // Get all possible current user IDs
                        const currentUserId = user?.id || user?.data?._id || user?.data?.id;
                        
                        // Check if message is from the current user by comparing sender ID with current user ID
                        const isMyMessage = Boolean(senderId && currentUserId && senderId === currentUserId);
                        
                        console.log('Message debug:', {
                          messageId: msg._id || msg.id,
                          sender: {
                            _id: msg.sender?._id,
                            id: msg.sender?.id,
                            name: msg.sender?.name,
                            allIds: [
                              msg.sender?._id,
                              msg.sender?.id,
                              msg.senderId
                            ].filter(Boolean)
                          },
                          currentUser: {
                            id: user?.id,
                            dataId: user?.data?._id,
                            dataUserId: user?.data?.id,
                            allIds: [
                              user?.id,
                              user?.data?._id,
                              user?.data?.id
                            ].filter(Boolean)
                          },
                          isMyMessage,
                          comparison: {
                            senderId,
                            currentUserId,
                            areEqual: senderId === currentUserId
                          }
                        });
                        
                        const isEditing = editingMessageId === (msg._id || msg.id);
                        const shouldGroupWithPrevious = msg.shouldGroupWithPrevious || 
                          (index > 0 && 
                           allMessages[index - 1]?.type === 'message' && 
                           allMessages[index - 1]?.sender?._id === msg.sender?._id);

                        return (
                          <MessageItem
                            key={`msg-${msg._id || msg.id}`}
                            message={msg}
                            isMyMessage={isMyMessage}
                            isEditing={isEditing}
                            onEdit={setEditingMessageId}
                            onDelete={handleDeleteMessage}
                            onReply={handleReply}
                            onReaction={handleReaction}
                            onTogglePin={handleTogglePin}
                            onEditComplete={handleEditMessage}
                            onEditCancel={() => setEditingMessageId(null)}
                            showAvatar={!shouldGroupWithPrevious}
                            showName={!shouldGroupWithPrevious}
                            user={user}
                            showReactionPicker={showReactionPicker}
                            setShowReactionPicker={setShowReactionPicker}
                            getAvatarUrl={extractUserAvatar}
                            getInitials={getUserInitials}
                            formatMessageTime={formatMessageTime}
                          />
                        );
                      })}
                    </div>
                    <div ref={messagesEndRef} />
                  </ErrorBoundary>
                )}
              </div>
            </div>
            
            {/* Message Input */}
            <div 
              className="sticky bottom-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800 p-4 shadow-lg"
              role="region"
              aria-label="Message input"
            >
              {replyToMessage && (
                <div 
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-t-lg px-4 py-2 border border-gray-100 dark:border-gray-700"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex-1 truncate text-sm text-gray-600 dark:text-gray-300">
                    Replying to <span className="font-medium">{replyToMessage.sender?.name || 'Unknown'}</span>: {replyToMessage.content?.substring(0, 30)}{replyToMessage.content?.length > 30 ? '...' : ''}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    onClick={() => setReplyToMessage(null)}
                    aria-label="Cancel reply"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center space-x-2"
              >
                <div className="flex-1 relative">
                  <label htmlFor="message-input" className="sr-only">Type your message</label>
                  <input
                    id="message-input"
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="w-full rounded-full border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent py-2 px-4 pr-12"
                    aria-label="Message input"
                    aria-required="true"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="icon"
                  className="h-10 w-10 rounded-full bg-blue-500 text-white hover:bg-blue-600"
                  disabled={!message.trim() && !selectedFile}
                  aria-label="Send message"
                >
                  <Send className="h-5 w-5" />
                </Button>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  className="hidden" 
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx"
                  aria-label="File upload"
                />
              </form>
              {previewUrl && (
                <div className="mt-2 relative inline-block">
                  <div className="relative group">
                    <img 
                      src={previewUrl} 
                      alt="Attachment preview" 
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
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center p-8 max-w-md">
              <div className="mx-auto h-16 w-16 text-gray-400 mb-4">
                <svg 
                  className="h-full w-full" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No group selected</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Select a group from the sidebar or create a new one to start messaging.
              </p>
              <Button onClick={() => navigate('/groups/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}