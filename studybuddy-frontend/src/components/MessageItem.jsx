import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Smile, Reply, Edit2, Trash2, Check, X, AlertCircle, Loader2, Info, CheckCircle, XCircle, Pin, PinOff } from 'lucide-react';
import { toast } from 'sonner';

// Import avatar utilities
import { 
  extractUserAvatar,
  getUserInitials
} from '@/utils/avatarUtils';

// Import time formatting utility
import { formatMessageTime } from '@/utils/groupMessages';

// Import reaction constants from the central emojis file
import { 
  REACTION_EMOJIS, 
  REACTION_DESCRIPTIONS, 
  SUPPORTED_REACTIONS 
} from '@/constants/emojis';

const MessageItem = ({
  message: msg,
  isMyMessage,
  isEditing,
  onEdit,
  onDelete,
  onReply,
  onReaction,
  onTogglePin,
  onEditComplete,
  onEditCancel,
  showAvatar = true,
  showName = true,
  user,
}) => {
  // State for tracking loading reactions
  const [reacting, setReacting] = useState(false);
  const [reactingEmoji, setReactingEmoji] = useState(null);
  // Debug logs
  useEffect(() => {
    console.log('Message data:', {
      messageId: msg._id || msg.id,
      sender: msg.sender,
      content: msg.content || msg.text,
      isMyMessage,
      currentUser: user,
      senderAvatar: msg.sender?.avatar
    });
  }, [msg, isMyMessage, user]);
  
  // Get avatar URL using the utility function
  const avatarUrl = useMemo(() => {
    if (!msg.sender?.avatar) return null;
    return extractUserAvatar(msg.sender);
  }, [msg.sender?.avatar]);
  const [editContent, setEditContent] = useState(msg.content || msg.text || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const hasReactions = msg.reactions && msg.reactions.length > 0;

  // Debug log for message data
  useEffect(() => {
    console.log('Message data:', {
      messageId: msg._id || msg.id,
      sender: msg.sender,
      content: msg.content || msg.text,
      isMyMessage,
      user
    });
  }, [msg, isMyMessage, user]);

  // Helper function to determine if a message is from the current user
  const isMessageFromUser = (messageUser) => {
    if (!messageUser || !user?.data) return false;
    
    // Get the sender's ID from the message user
    const messageUserId = messageUser._id || messageUser.id;
    
    // Get the current user's ID from the user object
    const currentUserId = user.data._id || user.data.id;
    
    // Log the IDs for debugging
    console.log('Comparing IDs - Message User:', messageUserId, 'Current User:', currentUserId);
    
    // Compare the IDs
    return messageUserId && currentUserId && messageUserId.toString() === currentUserId.toString();
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleReactionClick = async (reaction) => {
    if (!onReaction || reacting) return;
    
    // Get the emoji character for display
    const emoji = REACTION_EMOJIS[reaction] || reaction;
    if (!emoji) return;
    
    // Use the reaction key consistently for the backend
    const reactionKey = Object.entries(REACTION_EMOJIS).find(
      ([key, value]) => value === emoji
    )?.[0] || reaction;

    setReacting(true);
    setReactingEmoji(reaction);
    
    let toastId;
    try {
      // Show loading state
      toastId = toast.custom((t) => (
        <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-blue-100 dark:border-blue-900">
          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Updating reaction...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Please wait</p>
          </div>
        </div>
      ), { duration: 5000 });

      // Pass the consistent reaction key to the backend
      const result = await onReaction(msg._id || msg.id, reactionKey);
      
      // Dismiss loading toast
      if (toastId) toast.dismiss(toastId);
      
      // Show success message based on action
      if (result.action === 'added') {
        showReactionToast('success', 'Reaction added', `You reacted with ${emoji}`, 'green');
      } else if (result.action === 'removed') {
        showReactionToast('info', 'Reaction removed', `Removed your ${emoji} reaction`, 'blue');
      } else if (result.action === 'replaced') {
        const previousEmoji = REACTION_EMOJIS[result.previousEmoji] || result.previousEmoji;
        showReactionToast(
          'info', 
          'Reaction updated', 
          `Changed your reaction from ${previousEmoji} to ${emoji}`,
          'blue'
        );
      }
      
    } catch (error) {
      // Dismiss any existing toasts
      if (toastId) toast.dismiss(toastId);
      
      // Handle specific error cases
      if (error.message?.includes('already reacted')) {
        showReactionToast('warning', 'Already reacted', `You've already reacted with ${emoji}`, 'yellow');
      } else if (error.message?.includes('Not authorized')) {
        showReactionToast('error', 'Not authorized', 'You need to be a group member to react', 'red');
      } else {
        // Generic error handling
        showReactionToast(
          'error', 
          'Failed to update reaction', 
          error.message || 'Please try again', 
          'red'
        );
      }
    } finally {
      setReacting(false);
      setReactingEmoji(null);
    }
  };
  
  // Helper function to show reaction toasts
  const showReactionToast = (type, title, description, color) => {
    const icons = {
      success: <CheckCircle className="h-5 w-5 text-green-500" />,
      info: <Info className="h-5 w-5 text-blue-500" />,
      warning: <AlertCircle className="h-5 w-5 text-yellow-500" />,
      error: <XCircle className="h-5 w-5 text-red-500" />
    };
    
    const colors = {
      green: 'border-green-100 dark:border-green-900',
      blue: 'border-blue-100 dark:border-blue-900',
      yellow: 'border-yellow-100 dark:border-yellow-900',
      red: 'border-red-100 dark:border-red-900'
    };
    
    toast.custom((t) => (
      <div className={`flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border ${colors[color]}`}>
        {icons[type]}
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        <button 
          onClick={() => toast.dismiss(t)} 
          className="ml-auto text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ), { duration: 3000 });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const toastId = toast.custom((t) => (
      <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-blue-100 dark:border-blue-900">
        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
        <div>
          <p className="font-medium text-gray-900 dark:text-white">Updating message...</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Please wait while we save your changes</p>
        </div>
      </div>
    ), { duration: Infinity });

    try {
      await onEditComplete(msg._id || msg.id, editContent);
      
      toast.dismiss(toastId);
      toast.custom((t) => (
        <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-green-100 dark:border-green-900">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Message updated</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your changes have been saved</p>
          </div>
          <button 
            onClick={() => toast.dismiss(t)} 
            className="ml-auto text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ), { duration: 3000 });
      
    } catch (error) {
      toast.dismiss(toastId);
      toast.custom((t) => (
        <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-red-100 dark:border-red-900">
          <XCircle className="h-5 w-5 text-red-500" />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Update failed</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {error.message || 'Could not update your message. Please try again.'}
            </p>
          </div>
          <button 
            onClick={() => toast.dismiss(t)} 
            className="ml-auto text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ), { duration: 5000 });
    }
  };

  const handleEditClick = () => {
    try {
      setEditContent(msg.content || msg.text || '');
      onEdit(msg._id || msg.id);
    } catch (error) {
      console.error('Error starting edit:', error);
    }
  };

  const [isPinning, setIsPinning] = useState(false);

  const handlePinClick = async () => {
    if (!onTogglePin || isPinning) return;
    
    const messageId = msg._id || msg.id;
    const currentState = msg.isPinned || false;
    
    try {
      setIsPinning(true);
      await onTogglePin(messageId, currentState);
    } catch (error) {
      console.error('Error toggling pin:', error);
      // The error will be handled by the parent component
    } finally {
      setIsPinning(false);
    }
  };

  const handleDeleteClick = async () => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await onDelete(msg._id || msg.id);
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }
  };

  const groupedReactions = useMemo(() => {
    if (!msg.reactions?.length) return [];
    
    const reactionMap = new Map();
    const currentUserId = user?.id || user?._id;
    
    // First pass: group reactions by emoji and count unique users
    msg.reactions.forEach((reactionData) => {
      if (!reactionData) return;
      
      // Extract and normalize reaction key
      let reactionKey = '';
      if (typeof reactionData === 'string') {
        reactionKey = reactionData.trim();
      } else if (typeof reactionData === 'object') {
        // Get the reaction key from the reaction data
        const rawReaction = reactionData.reaction || reactionData.type || reactionData.emoji || '';
        // Map to our supported reaction keys
        reactionKey = Object.entries(REACTION_EMOJIS).find(
          ([key, emoji]) => key === rawReaction || emoji === rawReaction
        )?.[0] || rawReaction.trim();
      }
      
      if (!reactionKey) return;
      
      // Normalize to use our standard keys
      const normalizedKey = Object.keys(REACTION_EMOJIS).includes(reactionKey) 
        ? reactionKey 
        : Object.entries(REACTION_EMOJIS).find(([_, emoji]) => emoji === reactionKey)?.[0] || reactionKey;
      
      // Extract user ID
      let userId = '';
      if (typeof reactionData === 'object') {
        if (reactionData.user) {
          userId = typeof reactionData.user === 'string' 
            ? reactionData.user 
            : (reactionData.user._id || reactionData.user.id || '');
        } else if (reactionData.userId) {
          userId = reactionData.userId;
        } else if (reactionData.author) {
          userId = typeof reactionData.author === 'string'
            ? reactionData.author
            : (reactionData.author._id || reactionData.author.id || '');
        }
      }
      
      // Initialize or update reaction in map
      if (!reactionMap.has(normalizedKey)) {
        reactionMap.set(normalizedKey, {
          reaction: normalizedKey,
          count: 0,
          userIds: new Set(),
          hasReacted: false,
          loading: reacting && reactingEmoji === normalizedKey
        });
      }
      
      const entry = reactionMap.get(normalizedKey);
      
      // Track unique users
      if (userId) {
        const userIdStr = userId.toString();
        if (!entry.userIds.has(userIdStr)) {
          entry.userIds.add(userIdStr);
          entry.count++;
          
          if (currentUserId && userIdStr === currentUserId.toString()) {
            entry.hasReacted = true;
          }
        }
      } else {
        entry.count++;
      }
    });
    
    // Handle loading state for current reaction
    if (reacting && reactingEmoji) {
      const emojiKey = Object.keys(REACTION_EMOJIS).includes(reactingEmoji.trim())
        ? reactingEmoji.trim()
        : Object.entries(REACTION_EMOJIS).find(([_, emoji]) => emoji === reactingEmoji.trim())?.at(0) || reactingEmoji.trim();
      
      let currentReaction = reactionMap.get(emojiKey);
      
      if (!currentReaction) {
        currentReaction = {
          reaction: emojiKey,
          count: 0,
          userIds: new Set(),
          hasReacted: false,
          loading: true
        };
        reactionMap.set(emojiKey, currentReaction);
      }
      
      currentReaction.loading = true;
      if (currentUserId) {
        const userIdStr = currentUserId.toString();
        if (!currentReaction.userIds.has(userIdStr)) {
          currentReaction.userIds.add(userIdStr);
          currentReaction.count++;
        }
        currentReaction.hasReacted = true;
      } else {
        currentReaction.count = Math.max(1, currentReaction.count);
      }
    }
    
    // Convert to array, filter and sort
    return Array.from(reactionMap.values())
      .filter(r => r.count > 0 && r.reaction in REACTION_EMOJIS)
      .sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return a.reaction.localeCompare(b.reaction);
      });
  }, [msg.reactions, user?.id, user?._id, reacting, reactingEmoji]);

  return (
    <div 
      className={`group w-full transition-colors duration-200 relative px-1`}
      data-message-id={msg._id || msg.id}
      style={{
        display: 'flex',
        justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
        width: '100%',
        maxWidth: '100%',
        padding: '1px 8px',
        margin: '1px 0',
        position: 'relative',
        alignItems: 'flex-end',
        minHeight: '40px',
      }}
    >
      {/* Avatar for received messages (left side) */}
      {!isMyMessage && showAvatar && (
        <div className="flex-shrink-0 self-end mr-2" style={{ marginBottom: '2px' }}>
          <div 
            className="h-10 w-10 rounded-full border-2 border-white dark:border-gray-800 shadow-sm bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold overflow-hidden"
            title={msg.sender?.name || msg.sender?.data?.name || 'User'}
            data-testid="sender-avatar"
          >
            {msg.sender?.avatar || msg.sender?.data?.avatar ? (
              <>
                <img
                  src={extractUserAvatar(msg.sender)}
                  className="h-full w-full object-cover"
                  alt={msg.sender?.name || msg.sender?.data?.name || 'User'}
                  onError={(e) => {
                    console.warn('Sender avatar failed to load, showing fallback', {
                      sender: msg.sender,
                      url: extractUserAvatar(msg.sender)
                    });
                    e.target.style.display = 'none';
                    const fallback = e.target.nextElementSibling;
                    if (fallback) {
                      fallback.style.display = 'flex';
                    }
                  }}
                />
                <div className="hidden h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
                  <span className="text-sm text-white">
                    {getUserInitials(msg.sender?.name || msg.sender?.data?.name || msg.sender?.data?.email || msg.sender?.email || 'U')}
                  </span>
                </div>
              </>
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
                <span className="text-sm text-white">
                  {getUserInitials(msg.sender?.name || msg.sender?.data?.name || msg.sender?.data?.email || msg.sender?.email || 'U')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message content */}
      <div 
        className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}
        style={{
          maxWidth: 'calc(100% - 56px)',
          width: 'fit-content',
          marginLeft: isMyMessage ? 'auto' : '0',
          marginRight: isMyMessage ? '8px' : '0',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Sender name for received messages */}
        {!isMyMessage && (
          <div 
            className="text-xs text-gray-600 dark:text-gray-400 mb-0.5 ml-1 px-2 font-medium" 
            data-testid="sender-name"
          >
            {msg.sender?.name || 'User'}
          </div>
        )}

        {/* Message bubble container */}
        <div 
          className={`relative flex ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}
          style={{
            maxWidth: '100%',
            position: 'relative',
            marginBottom: '2px',
          }}
        >
          {/* Bubble */}
          <div 
            className={`relative px-3 py-2 ${
              isMyMessage 
                ? 'bg-[#D9FDD3] dark:bg-[#005C4B] rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl' 
                : 'bg-white dark:bg-[#202C33] rounded-tl-none rounded-tr-2xl rounded-br-2xl rounded-bl-2xl shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] dark:shadow-none'
            }`}
            style={{
              maxWidth: '100%',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              lineHeight: '1.4',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Bubble tail for received messages */}
            {!isMyMessage && (
              <div 
                className="absolute -left-[7px] bottom-0 w-[9px] h-[13px] overflow-hidden"
                style={{
                  zIndex: 0
                }}
              >
                <div 
                  className="absolute w-[15px] h-[15px] bg-white dark:bg-[#202C33] -bottom-1.5 -left-1.5 rounded-br-[50%]"
                  style={{
                    boxShadow: '-2px 2px 2px 0 rgba(178,178,178,0.2)'
                  }}
                />
              </div>
            )}
            {/* Reply preview */}
            {msg.replyTo && (
              <div 
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2 mb-2 border border-gray-100 dark:border-gray-700"
                role="status"
                aria-live="polite"
              >
                <div className="flex-1 truncate text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium">{msg.replyTo.sender?.name || 'Unknown'}</span>: {msg.replyTo.content?.substring(0, 30)}{msg.replyTo.content?.length > 30 ? '...' : ''}
                </div>
              </div>
            )}

            {/* Pinned indicator */}
            {msg.isPinned && (
              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                <Pin className="h-3 w-3 mr-1" />
                <span>Pinned</span>
              </div>
            )}
            
            {/* Message text */}
            <div 
              className={`whitespace-pre-wrap break-words text-sm ${msg.isPinned ? 'bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-2 -mx-1' : ''}`}
              style={{
                wordBreak: 'break-word',
                overflowWrap: 'break-word'
              }}
            >
              {isEditing ? (
                <form onSubmit={handleEditSubmit} className="flex flex-col gap-2">
                  <textarea
                    className="w-full p-2 border rounded-lg text-gray-900 dark:text-white bg-white/90 dark:bg-gray-800/90"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleEditSubmit(e);
                      } else if (e.key === 'Escape') {
                        onEditCancel();
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onEditCancel}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                    >
                      Save
                    </Button>
                  </div>
                </form>
              ) : (
                msg.content || msg.text
              )}
            </div>

            {/* Timestamp and read status */}
            <div 
              className={`flex items-center mt-0.5 space-x-1.5 ${isMyMessage ? 'justify-start' : 'justify-end'}`}
              style={{
                float: isMyMessage ? 'left' : 'right',
                margin: isMyMessage ? '2px 8px 0 0' : '2px 0 0 8px',
                minWidth: '60px',
                textAlign: isMyMessage ? 'left' : 'right',
                whiteSpace: 'nowrap',
              }}
            >
             
              
              {/* Timestamp - always show exact time */}
              <span className={`text-[11px] font-medium ${isMyMessage ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}`}>
                {formatMessageTime(msg.createdAt || msg.timestamp, { exact: true })}
              </span>
            </div>

            {/* Reactions */}
            {hasReactions && (
              <div 
                className={`flex flex-wrap gap-1 mt-1.5 ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                style={{
                  clear: 'both',
                  marginLeft: isMyMessage ? 'auto' : '0',
                  marginRight: isMyMessage ? '0' : 'auto',
                  maxWidth: '100%'
                }}
              >
                {groupedReactions.map(({ reaction, count, hasReacted, loading }) => {
                  const isReacting = loading && reactingEmoji === reaction;
                  const emoji = REACTION_EMOJIS[reaction] || reaction;
                  const description = REACTION_DESCRIPTIONS[reaction] || reaction;
                  
                  return (
                    <Button
                      key={reaction}
                      variant="ghost"
                      size="sm"
                      disabled={reacting}
                      className={`h-6 px-1.5 text-xs transition-all duration-200 ${
                        hasReacted
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800' 
                          : 'bg-white/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600/80'
                      } ${isReacting ? 'opacity-70' : ''} backdrop-blur-sm`}
                      onClick={() => handleReactionClick(reaction)}
                      aria-label={`${description} (${count} reaction${count !== 1 ? 's' : ''})`}
                      title={`${description} (${count} reaction${count !== 1 ? 's' : ''})`}
                    >
                      <span className={`inline-flex items-center ${isReacting ? 'opacity-70' : ''}`}>
                        {isReacting ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <span>{emoji}</span>
                        )}
                        {count > 0 && <span className="ml-0.5">{count > 1 ? count : ''}</span>}
                      </span>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Message actions */}
          <div 
            className={`absolute ${isMyMessage ? 'right-full' : 'left-full'} bottom-1/2 flex space-x-0.5 bg-white/95 dark:bg-[#233138] rounded-full shadow-lg p-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 border border-gray-200 dark:border-gray-700 z-10 backdrop-blur-sm transform translate-y-1/2`}
            style={{
              ...(isMyMessage 
                ? { right: 'calc(100% + 4px)' }
                : { left: 'calc(100% + 4px)' }
              )
            }}
            data-testid="message-actions"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-300"
              onClick={() => onReply(msg)}
              aria-label="Reply to message"
              title="Reply"
              type="button"
            >
              <Reply className="h-3.5 w-3.5" />
            </Button>
            
            {/* Pin button - visible to all users */}
            <Button
              variant="ghost"
              size="icon"
              disabled={isPinning}
              className={`h-6 w-6 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 ${
                msg.isPinned 
                  ? 'text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300' 
                  : 'text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-300'
              } ${isPinning ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={handlePinClick}
              aria-label={msg.isPinned ? 'Unpin message' : 'Pin message'}
              title={msg.isPinned ? 'Unpin message' : 'Pin message'}
              type="button"
            >
              {isPinning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : msg.isPinned ? (
                <PinOff className="h-3.5 w-3.5" />
              ) : (
                <Pin className="h-3.5 w-3.5" />
              )}
            </Button>

            {/* Edit and delete buttons - only for message sender or admin */}
            {(isMyMessage || user?.isAdmin) && (
              <>
                {isMyMessage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-300"
                    onClick={handleEditClick}
                    title={isEditing ? 'Cancel edit' : 'Edit'}
                    type="button"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-300"
                  onClick={() => onDelete(msg._id || msg.id)}
                  aria-label="Delete message"
                  title="Delete"
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            
            <div className="relative" ref={emojiPickerRef}>
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 rounded-full ${showEmojiPicker ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker(!showEmojiPicker);
                }}
                aria-label="Add reaction"
                title="Add reaction"
                type="button"
              >
                <Smile className="h-3.5 w-3.5" />
              </Button>
              
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 flex flex-wrap gap-1 w-48 z-20 border border-gray-200 dark:border-gray-700">
                  {Object.entries(REACTION_EMOJIS).map(([key, emoji]) => (
                    <Button
                      key={key}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                      onClick={() => handleReactionClick(key)}
                      aria-label={`React with ${REACTION_DESCRIPTIONS[key] || key}`}
                      title={REACTION_DESCRIPTIONS[key] || key}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Avatar for sent messages (right side) */}
      {isMyMessage && showAvatar && (
        <div className="flex-shrink-0 self-end ml-2" style={{ marginBottom: '2px' }}>
          <div 
            className="h-10 w-10 rounded-full border-2 border-white dark:border-gray-800 shadow-sm bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold overflow-hidden"
            title={user?.data?.name || user?.name || 'Me'}
            data-testid="user-avatar"
          >
            {user?.data?.avatar || user?.avatar ? (
              <>
                <img
                  src={extractUserAvatar(user)}
                  className="h-full w-full object-cover"
                  alt={user?.data?.name || user?.name || 'User'}
                  onError={(e) => {
                    console.warn('User avatar failed to load, showing fallback:', {
                      user,
                      url: extractUserAvatar(user)
                    });
                    e.target.style.display = 'none';
                    const fallback = e.target.nextElementSibling;
                    if (fallback) {
                      fallback.style.display = 'flex';
                    }
                  }}
                />
                <div className="hidden h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
                  <span className="text-sm text-white">
                    {getUserInitials(user?.data?.name || user?.name || user?.data?.email || user?.email || 'Me')}
                  </span>
                </div>
              </>
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
                <span className="text-sm text-white">
                  {getUserInitials(user?.data?.name || user?.name || user?.data?.email || user?.email || 'Me')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(MessageItem);
