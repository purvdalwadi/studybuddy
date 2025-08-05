import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

// Helper function to get the full avatar URL
const getAvatarUrl = (avatarPath) => {
  if (!avatarPath) return null;
  if (avatarPath.startsWith('http')) return avatarPath;
  return `${import.meta.env.VITE_API_URL || 'http://localhost:5173'}/uploads/avatars/${avatarPath}`;
};

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
  Check
} from "lucide-react";
import { toast } from "sonner";
import { SUPPORTED_REACTIONS, REACTION_EMOJIS, REACTION_DESCRIPTIONS } from "@/constants/emojis";
import { groupMessagesByDate, formatMessageTime, formatDateHeader, DateSeparator } from "@/utils/groupMessages";

// Use the supported reactions from our constants
const REACTIONS = SUPPORTED_REACTIONS;

/**
 * Get user initials from a name string
 * @param {string} name - The full name of the user
 * @returns {string} Uppercase initials (1-2 characters)
 */
function getInitials(name) {
  if (!name || typeof name !== 'string' || name.trim() === '') return '??';
  const cleanName = name.trim();
  const nameToUse = cleanName.includes('@') 
    ? cleanName.split('@')[0].replace(/[^a-zA-Z]/g, ' ')
    : cleanName;
  const parts = nameToUse.split(/\s+/).filter(part => part.length > 0);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

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
const processGroupsData = (data) => {
  if (!data) return [];
  try {
    return Array.isArray(data) ? data : (data.data || []);
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

  const groupsConfig = useMemo(() => ({
    enabled: authState.isAuthenticated,
    onError: (error) => {
      console.error('[Messages] Error fetching groups:', error);
      if (error.response?.status === 401) {
        toast.error('Your session has expired. Please log in again.');
      }
    },
    select: processGroupsData
  }), [authState.isAuthenticated]);
  
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
  const navigate = useNavigate();
  const { groupId: urlGroupId } = useParams();
  
  const messagesEndRef = useRef(null);
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
        isActive: group.isActive !== false,
        ...group
      }));
    } catch (error) {
      console.error('[Messages] Error processing groups data:', error);
      return [];
    }
  }, [groups]);
  
  const activeGroup = useMemo(() => {
    if (!activeGroupId || !Array.isArray(safeGroups)) return null;
    return safeGroups.find(group => group.id === activeGroupId) || null;
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

  // Handle message deletion
  const handleDeleteMessage = useCallback(async (messageId) => {
    if (!messageId || !window.confirm('Are you sure you want to delete this message?')) return;
    
    try {
      await deleteMessageMutation.mutateAsync(messageId);
      toast.success('Message deleted');
      refetchMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  }, [deleteMessageMutation, refetchMessages]);

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
  const handleReaction = useCallback((messageId, emoji) => {
    if (!messageId || !emoji) return;

    const message = messages.find(m => m._id === messageId || m.id === messageId);
    const userReaction = message?.reactions?.find(
      r => (r.user?._id === user?.id || r.user === user?.id) && r.reaction === emoji
    );

    reactToMessageMutation.mutate({
      messageId,
      reaction: userReaction ? null : emoji
    }, {
      onSuccess: () => {
        refetchMessages();
      },
      onError: (error) => {
        console.error('Error reacting to message:', error);
        toast.error('Failed to react to message');
      }
    });

    setShowReactionPicker(null);
  }, [messages, user?.id, reactToMessageMutation, refetchMessages]);

  // Toggle message pin
  const handleTogglePin = useCallback((messageId, currentState) => {
    if (!messageId) return;
    
    togglePinMessageMutation.mutate({
      messageId,
      isPinned: !currentState
    }, {
      onSuccess: () => {
        refetchMessages();
      },
      onError: (error) => {
        console.error('Error toggling pin:', error);
        toast.error('Failed to update pin status');
      }
    });
  }, [togglePinMessageMutation, refetchMessages]);

  // Handle reply
  const handleReply = useCallback((message) => {
    setReplyToMessage(message);
    // Scroll to input and focus it
    document.getElementById('message-input')?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
      document.getElementById('message-input')?.focus();
    }, 100);
  }, [setReplyToMessage]);
  


  // Group messages by date
  const groupedMessages = useMemo(() => {
    if (!messages?.length) return [];
    
    // Sort messages by timestamp
    const sortedMessages = [...messages].sort((a, b) => 
      new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp)
    );
    
    const groups = [];
    let currentDate = null;
    
    sortedMessages.forEach((message, index) => {
      const messageDate = new Date(message.createdAt || message.timestamp);
      const dateStr = formatMessageTime(messageDate);
      
      // Add date header if this is the first message or date has changed
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        groups.push({
          type: 'date',
          id: `date-${dateStr}`,
          date: messageDate,
          header: formatDateHeader(messageDate)
        });
      }
      
      // Check if we should group with previous message from same sender
      const prevMessage = index > 0 ? sortedMessages[index - 1] : null;
      const isSameSender = prevMessage && 
        (prevMessage.sender?._id === message.sender?._id || 
         prevMessage.sender?.id === message.sender?.id);
      const timeDiff = prevMessage ? 
        (new Date(message.createdAt || message.timestamp) - new Date(prevMessage.createdAt || prevMessage.timestamp)) / 1000 / 60 : 
        Infinity; // in minutes
      
      groups.push({
        ...message,
        type: 'message',
        shouldGroupWithPrevious: isSameSender && timeDiff < 5 // Group if same sender and <5 minutes apart
      });
    });
    
    return groups;
  }, [messages]);

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

  // Render auth content if user is not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Sign In Required</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">Please sign in to access your messages.</p>
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

  // Render auth content if user is not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Sign In Required</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">Please sign in to access your messages.</p>
          <Button onClick={() => navigate('/login')}>
            Go to Login
          </Button>
        </div>
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
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        {activeGroupId ? (
          <>
            {/* Chat Header */}
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-md">
                    {getInitials(activeGroup?.title || 'Group Chat')}
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
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
              <div className="w-full p-4 space-y-4">
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
                    <div className="space-y-4">
                      {groupedMessages && Array.isArray(groupedMessages) && groupedMessages.length > 0 ? groupedMessages.map((item, index) => {
                        if (item.type === 'date') {
                          return (
                            <DateSeparator 
                              key={item.id} 
                              date={item.header} 
                            />
                          );
                        }
                        
                        const msg = item;
                        const isMyMessage = user && (msg.sender?._id === user.id || msg.sender?.id === user.id || msg.senderId === user.id);
                        const isEditing = editingMessageId === (msg._id || msg.id);
                        const isHovered = hoveredMessageId === (msg._id || msg.id);
                        const hasReactions = msg.reactions && msg.reactions.length > 0;

                        return (
                          <div 
                            key={msg._id || msg.id}
                            className={`group flex w-full mb-1 ${isMyMessage ? 'justify-end' : 'justify-start'} ${
                              index > 0 && 
                              groupedMessages[index - 1]?.type === 'message' && 
                              !groupedMessages[index - 1]?.shouldGroupWithPrevious
                                ? 'mt-3' : 'mt-1'
                            }`}
                            onMouseEnter={() => setHoveredMessageId(msg._id || msg.id)}
                            onMouseLeave={() => setHoveredMessageId(null)}
                          >
                            {/* Message Container */}
                            <div className={`flex w-full px-2 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                              <div className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'} max-w-[85%]`}>
                                {/* Sender's Avatar and Name - Only for received messages and first in group */}
                                {!isMyMessage && !msg.shouldGroupWithPrevious && (
                                  <div className="flex-shrink-0 mb-1">
                                    <div 
                                      className="h-9 w-9 rounded-full border-2 border-white dark:border-gray-800 shadow-sm bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold"
                                      title={msg.sender?.name || 'User'}
                                    >
                                      {msg.sender?.avatar ? (
                                        <img 
                                          src={getAvatarUrl(msg.sender.avatar)} 
                                          className="h-full w-full rounded-full object-cover"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                          alt={msg.sender?.name || 'User'}
                                        />
                                      ) : (
                                        <span>{getInitials(msg.sender?.name || 'U')}</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {/* Sender name for subsequent messages in a group */}
                                {!isMyMessage && msg.shouldGroupWithPrevious && (
                                  <div className="w-9 flex-shrink-0"></div> // Spacer to align with avatar
                                )}
                                {/* Message status and timestamp */}
                                <div className={`flex items-center mt-0.5 ${isMyMessage ? 'justify-end' : 'justify-start'} text-xs text-gray-400 dark:text-gray-500`}>
                                  {isMyMessage && (
                                    <span className="mr-1">
                                      {msg.read ? '✓✓' : '✓'}
                                    </span>
                                  )}
                                  <span>
                                    {format(new Date(msg.createdAt || msg.timestamp), 'h:mm a')}
                                  </span>
                                </div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white mb-0.5 ml-1">
                                  {msg.sender?.name || 'User'}
                                </div>
                                {/* Message Content */}
                                <div 
                                  className={`flex flex-col ${!isMyMessage && !msg.shouldGroupWithPrevious ? 'mt-1' : ''}`}
                                  onMouseEnter={() => setHoveredMessageId(msg._id || msg.id)}
                                  onMouseLeave={() => setHoveredMessageId(null)}
                                >
                                  <div className={`relative flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}>
                                    {/* Sender name for subsequent messages in a group */}
                                    {!isMyMessage && msg.shouldGroupWithPrevious && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 ml-1">
                                        {msg.sender?.name || 'User'}
                                      </div>
                                    )}
                                    <div className={`relative ${isMyMessage ? 'ml-auto' : ''}`}>
                                      <div 
                                        className={`relative px-4 py-2 ${
                                          isMyMessage 
                                            ? 'bg-blue-500 text-white rounded-tl-2xl rounded-br-sm rounded-tr-2xl' 
                                            : 'bg-white text-gray-900 rounded-tr-2xl rounded-bl-sm rounded-tl-2xl shadow-sm border border-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
                                        }`}
                                      >
                                        {/* Timestamp for my messages */}
                                        {isMyMessage && (
                                          <div className="text-xs opacity-80 mb-1 text-right">
                                            {formatMessageTime(msg.createdAt || msg.timestamp)}
                                          </div>
                                        )}
                                        
                                        {/* Reply Preview */}
                                        {msg.replyTo && (
                                          <div className={`text-xs p-2 mb-2 rounded-lg ${
                                            isMyMessage 
                                              ? 'bg-blue-600/70 backdrop-blur-sm' 
                                              : 'bg-gray-100/80 dark:bg-gray-700/60 backdrop-blur-sm'
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
                                        <div className="whitespace-pre-wrap break-words text-sm">
                                          {editingMessageId === (msg._id || msg.id) ? (
                                            <div className="flex flex-col gap-2">
                                              <textarea
                                                className="w-full p-2 border rounded-lg text-gray-900 dark:text-white bg-white/90 dark:bg-gray-800/90"
                                                defaultValue={msg.content || msg.text}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleEditMessage(msg._id || msg.id, e.target.value);
                                                  } else if (e.key === 'Escape') {
                                                    setEditingMessageId(null);
                                                  }
                                                }}
                                                autoFocus
                                              />
                                              <div className="flex gap-2 justify-end">
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => setEditingMessageId(null)}
                                                >
                                                  Cancel
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  onClick={(e) => {
                                                    const textarea = e.target.closest('.flex-col').querySelector('textarea');
                                                    if (textarea) {
                                                      handleEditMessage(msg._id || msg.id, textarea.value);
                                                    }
                                                  }}
                                                >
                                                  Save
                                                </Button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="whitespace-pre-wrap break-words">
                                              {msg.content || msg.text}
                                            </div>
                                          )}
                                        </div>

                                        {/* Timestamp for other's messages */}
                                        {!isMyMessage && (
                                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
                                            {formatMessageTime(msg.createdAt || msg.timestamp)}
                                          </div>
                                        )}

                                        {/* Reactions */}
                                        {hasReactions && (
                                          <div className={`flex flex-wrap gap-1 mt-1.5 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                                            {msg.reactions
                                              .filter(reaction => SUPPORTED_REACTIONS.includes(reaction.reaction || ''))
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
                                              .sort((a, b) => b.count - a.count)
                                              .map(({ reaction, count, hasReacted }) => (
                                                <Button
                                                  key={reaction}
                                                  variant="ghost"
                                                  size="sm"
                                                  className={`h-6 px-1.5 text-xs ${
                                                    hasReacted
                                                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800' 
                                                      : 'bg-white/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600/80'
                                                  } backdrop-blur-sm`}
                                                  onClick={() => handleReaction(msg._id || msg.id, reaction)}
                                                  aria-label={`${REACTION_DESCRIPTIONS[reaction] || reaction} (${count} reaction${count > 1 ? 's' : ''})`}
                                                  title={`${REACTION_DESCRIPTIONS[reaction] || reaction} (${count} reaction${count > 1 ? 's' : ''})`}
                                                >
                                                  {REACTION_EMOJIS[reaction]} {count > 1 ? count : ''}
                                                </Button>
                                              ))
                                            }
                                          </div>
                                        )}
                                      </div>
      
                                      {/* Message Actions */}
                                      <div 
                                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full mb-1 flex space-x-1 bg-white/95 dark:bg-gray-800/95 rounded-full shadow-lg p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 border border-gray-200 dark:border-gray-600 z-10 backdrop-blur-sm`}
                                      >
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-300"
                                          onClick={() => handleReply(msg)}
                                          title="Reply"
                                        >
                                          <Reply className="h-3.5 w-3.5" />
                                        </Button>
                                        
                                        {isMyMessage && (
                                          <>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-300"
                                              onClick={() => {
                                                setEditingMessageId(prev => prev === (msg._id || msg.id) ? null : (msg._id || msg.id));
                                              }}
                                              title={editingMessageId === (msg._id || msg.id) ? 'Cancel edit' : 'Edit'}
                                            >
                                              <Edit2 className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                              onClick={() => handleDeleteMessage(msg._id || msg.id)}
                                              title="Delete"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </>
                                        )}
                                        

                                        {isMyMessage && (
                                          <>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-300"
                                              onClick={() => {
                                                // Add functionality here
                                              }}
                                              title="Add functionality"
                                            >
                                              {/* Add icon here */}
                                            </Button>
                                          </>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className={`h-6 w-6 rounded-full ${showReactionPicker === (msg._id || msg.id) ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400'}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowReactionPicker(prev => prev === (msg._id || msg.id) ? null : (msg._id || msg.id));
                                          }}
                                          aria-label="Add reaction"
                                          title="Add reaction"
                                        >
                                          <Smile className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  
                                    {/* Emoji Picker Container */}
                                    <div className={`absolute w-max ${isMyMessage ? 'right-0' : 'left-0'} -top-2 z-22`}>
                                      {showReactionPicker === (msg._id || msg.id) && (
                                        <div 
                                          className="static z-22 bg-white left-1/2 -translate-x-1/2 dark:bg-gray-800 rounded-lg shadow-lg p-2 border border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out w-auto max-w-[300px]"
                                          style={{
                                            opacity: 1,
                                            transform: 'translateY(-100%)',
                                            left: '50%',
                                            transformOrigin: 'bottom center'
                                          }}
                                        >
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
                                  
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-7 w-7 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 ${
                                      msg.isPinned 
                                        ? 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300' 
                                        : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                                    }`}
                                    onClick={() => handlePinMessage(msg._id || msg.id, !msg.isPinned)}
                                    aria-label={msg.isPinned ? 'Unpin message' : 'Pin message'}
                                    title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                                  >
                                    <Pin className="h-3.5 w-3.5" />
                                    <span className="sr-only">{msg.isPinned ? 'Unpin message' : 'Pin message'}</span>
                                  </Button>
                                </div>
                              </div>
                            </div>
                            
                            {/* My Avatar */}
                            {isMyMessage && (
                              <div className="flex-shrink-0 self-end mb-1 ml-2">
                                <div className="relative h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                                  {user?.avatar ? (
                                    <img
                                      src={getAvatarUrl(user.avatar)}
                                      alt={user.name || 'User'}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        const target = e.target;
                                        if (target && target.nextSibling) {
                                          target.style.display = 'none';
                                          target.nextSibling.style.display = 'flex';
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <span className={user?.avatar ? 'hidden' : 'flex'}>
                                    {getInitials(user?.name || user?.email || 'Me')}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div ref={messagesEndRef} />
                
              </ErrorBoundary>
            </div>
                  )}
                  
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
                    <span className="sr-only">Remove attachment</span>
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
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Sending...</span>
                    </div>
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
                <svg 
                  className="h-full w-full" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="1.5" 
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span className="sr-only">Message icon</span>
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