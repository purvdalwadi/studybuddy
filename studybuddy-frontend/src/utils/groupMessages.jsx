import { format } from 'date-fns';

export const formatMessageTime = (timestamp, options = {}) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  
  // Always return exact time in 12-hour format with AM/PM
  if (options.exact) {
    return format(date, 'h:mm a');
  }
  
  if (options.short) {
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    // If less than 24 hours, show time only
    if (diffInHours < 24) {
      return format(date, 'h:mm a');
    }
    // If less than 7 days, show day name
    if (diffInHours < 7 * 24) {
      return format(date, 'EEE h:mm a');
    }
    // Otherwise show short date with time
    return format(date, 'MM/dd/yyyy h:mm a');
  }
  
  // Default: show time with AM/PM
  return format(date, 'h:mm a');
};

export const formatDateHeader = (date) => {
  const today = new Date();
  const messageDate = new Date(date);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (messageDate.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return format(date, 'MMMM d, yyyy');
  }
};

/**
 * Groups messages by date and adds date separators
 * @param {Array} messages - Array of message objects
 * @returns {Array} Array of message groups with date separators
 */
export const groupMessagesByDate = (messages) => {
  if (!messages || !messages.length) return [];
  
  // Filter out any invalid messages
  const validMessages = messages.filter(msg => msg && (msg.createdAt || msg.timestamp));
  if (!validMessages.length) return [];
  
  // Sort messages by timestamp
  validMessages.sort((a, b) => {
    return new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp);
  });
  
  const grouped = [];
  const dateGroups = new Map();
  
  // First pass: group messages by date
  validMessages.forEach((msg) => {
    const msgDate = new Date(msg.createdAt || msg.timestamp);
    const dateStr = msgDate.toDateString();
    
    if (!dateGroups.has(dateStr)) {
      dateGroups.set(dateStr, {
        type: 'date',
        date: msgDate,
        id: `date-${dateStr}`,
        header: formatDateHeader(msgDate),
        dateStr: dateStr,
        messages: []
      });
    }
    
    dateGroups.get(dateStr).messages.push({
      ...msg,
      type: 'message',
      dateStr: dateStr
    });
  });
  
  // Second pass: build the final array with date headers and messages
  dateGroups.forEach((group, dateStr) => {
    // Only add date header if there are messages for this date
    if (group.messages.length > 0) {
      // Add date header
      const { messages, ...dateHeader } = group;
      grouped.push(dateHeader);
      
      // Add all messages for this date
      grouped.push(...group.messages);
    }
  });
  
  return grouped;
};

export const DateSeparator = ({ date, className = '' }) => {
  // Default classes for the date separator
  const defaultClasses = "relative flex items-center justify-center my-4";
  const defaultTextClasses = "relative px-3 bg-white dark:bg-gray-900 text-sm text-gray-500 dark:text-gray-400";
  
  // If custom className is provided, use it for the text element
  const textClasses = className 
    ? `relative px-3 bg-white dark:bg-gray-900 text-sm ${className}`
    : defaultTextClasses;
  
  return (
    <div className={defaultClasses}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
      </div>
      <div className={textClasses}>
        {date}
      </div>
    </div>
  );
};
