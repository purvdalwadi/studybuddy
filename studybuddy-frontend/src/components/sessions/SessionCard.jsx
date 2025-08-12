import React, { useState, useEffect } from 'react';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, differenceInSeconds ,differenceInDays} from 'date-fns';
import { Clock, MapPin, Users, Edit2, Trash2, UserCheck, Video, Crown, Loader2, UserX, User, Calendar, Users2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useSessionRSVP } from '@/hooks/useSchedule'; // Assuming this hook exists
import { cn } from '@/lib/utils';
import { getAvatarUrl } from '@/utils/avatarUtils'; // Assuming this utility exists

export default function SessionCard({ 
  session, 
  onEdit, 
  onDelete,
  className,
  showGroup = true,
  onRSVPUpdate,
  showRelativeTime = false
}) {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const rsvpMutation = useSessionRSVP();
  
  const isCreator = user?.data?._id === session.createdBy?._id;
  const isUpdatingRSVP = rsvpMutation.isPending;
  
  // Helper to get user ID from attendee (handles both populated and unpopulated user refs)
  const getAttendeeUserId = (attendee) => {
    if (!attendee) return null;
    return attendee.user?._id || attendee.user;
  };

  // Categorize attendees by RSVP status and find current user's RSVP
  const { attendeesByStatus, currentUserRSVP } = session.attendees?.reduce((acc, attendee) => {
    if (!attendee) return acc;
    
    // Handle both populated and unpopulated user refs
    const userId = getAttendeeUserId(attendee);
    if (!userId) return acc;
    
    // Check if this is the current user's RSVP
    if (user?.data?._id === userId) {
      acc.currentUserRSVP = { ...attendee, userId };
    }
    
    const status = attendee.rsvpStatus || 'not-going';
    if (!acc.attendeesByStatus[status]) {
      acc.attendeesByStatus[status] = [];
    }
    
    // Ensure we have user data for display
    const attendeeWithUser = {
      ...attendee,
      user: typeof attendee.user === 'string' ? { _id: attendee.user } : attendee.user
    };
    
    acc.attendeesByStatus[status].push(attendeeWithUser);
    return acc;
  }, { attendeesByStatus: {}, currentUserRSVP: null });
  
  const { going: goingAttendees = [], maybe: maybeAttendees = [], 'not-going': notGoingAttendees = [] } = attendeesByStatus || {};
  
  // Check if the optimistic update is in progress and update the counts accordingly
  const isOptimisticUpdate = rsvpMutation.isPending && rsvpMutation.variables?.sessionId === session._id;
  
  if (isOptimisticUpdate) {
    const { status } = rsvpMutation.variables;
    const oldStatus = currentUserRSVP?.rsvpStatus;
    
    // Remove from old status if exists
    if (oldStatus && oldStatus !== status) {
      const oldStatusList = attendeesByStatus[oldStatus] || [];
      const userIndex = oldStatusList.findIndex(a => getAttendeeUserId(a) === user?.data?._id);
      if (userIndex !== -1) {
        attendeesByStatus[oldStatus] = [
          ...oldStatusList.slice(0, userIndex),
          ...oldStatusList.slice(userIndex + 1)
        ];
      }
    }
    
    // Add to new status if not already there
    if (status && (!currentUserRSVP || oldStatus !== status)) {
      const newAttendee = {
        user: user?.data?._id,
        rsvpStatus: status,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (!attendeesByStatus[status]) {
        attendeesByStatus[status] = [];
      }
      
      attendeesByStatus[status].push(newAttendee);
    }
  }
  
  // Standardize time calculations
  const [currentTime, setCurrentTime] = useState(new Date());
  const sessionStart = new Date(session.scheduledDate);
  const sessionEnd = new Date(sessionStart.getTime() + (session.duration * 60000));
  
  // Update current time every second for countdown
  useEffect(() => {
    if (currentTime < sessionStart) {
      const timer = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [sessionStart]);
  
  // Only check against session end time to determine if session is in the past
  const isPastSession = currentTime > sessionEnd;
  // A session is only ongoing if it's not past and the current time is between start and end
  const isSessionOngoing = currentTime >= sessionStart && currentTime <= sessionEnd;
  
  // Calculate remaining time in seconds until session starts
  const secondsUntilStart = differenceInSeconds(sessionStart, currentTime);
  const showCountdown = secondsUntilStart > 0 && !isSessionOngoing && !isPastSession;
  
  // Calculate time components for countdown
  const days = Math.floor(secondsUntilStart / 86400);
  const hours = Math.floor((secondsUntilStart % 86400) / 3600);
  const minutes = Math.floor((secondsUntilStart % 3600) / 60);
  const seconds = secondsUntilStart % 60;
  
  const isFull = session.maxAttendees && goingAttendees.length >= session.maxAttendees;
  const spotsLeft = session.maxAttendees ? session.maxAttendees - goingAttendees.length : null;
  
  const handleRSVP = async (newStatus, e) => {
    if (e) e.stopPropagation();
    
    // Use the pre-calculated times
    if (isUpdatingRSVP || isDeleting || (isPastSession && !isSessionOngoing)) return;
    
    if (!user?.data?._id) {
      toast.error('Please log in to RSVP');
      return;
    }
    
    // Don't update if the status is the same
    if (currentUserRSVP?.rsvpStatus === newStatus) {
      return;
    }
    
    // Show loading state immediately
    const loadingToast = toast.loading('Updating RSVP...');
    
    try {
      await rsvpMutation.mutateAsync({
        sessionId: session._id,
        status: newStatus
      });
      
      // Show success message
      const statusText = newStatus === 'going' ? 'going' : newStatus === 'maybe' ? 'a maybe' : 'not going';
      toast.success(`You're now ${statusText} to this session`, { id: loadingToast });
      
      // Open meeting link if going to an online session
      if (newStatus === 'going' && session.isOnline && session.meetingLink) {
        setTimeout(() => {
          window.open(session.meetingLink, '_blank', 'noopener,noreferrer');
        }, 500);
      }
      
      // Notify parent component if needed
      if (onRSVPUpdate) {
        onRSVPUpdate(session._id, newStatus);
      }
    } catch (error) {
      // Show error message
      toast.error(error.response?.data?.message || 'Failed to update RSVP', { id: loadingToast });
      console.error('RSVP error:', error);
    }
  };
  
  const handleDeleteClick = async () => {
    if (window.confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      try {
        setIsDeleting(true);
        await onDelete?.(session._id);
        toast.success('Session deleted successfully');
      } catch (error) {
        toast.error('Failed to delete session');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Use the standardized time variables
  const startTime = sessionStart;
  const endTime = sessionEnd;
  
  const getDateBadge = (date) => {
    if (!date) return null;
    
    const sessionDate = new Date(date);
    const isSessionToday = isToday(sessionDate);
    const isSessionTomorrow = isTomorrow(sessionDate);
    
    if (isSessionOngoing) {
      return <Badge className="text-xs font-semibold whitespace-nowrap bg-green-50 text-green-700 border-green-200">Ongoing</Badge>;
    }
    if (isPastSession) {
      return <Badge variant="secondary" className="text-xs font-semibold whitespace-nowrap">Completed</Badge>;
    }
    if (showCountdown) {
      return (
        <Badge className="text-xs font-semibold whitespace-nowrap bg-amber-50 text-amber-700 border-amber-200">
          Starts in 
          {days > 0 && ` ${days}d`}
          {(days > 0 || hours > 0) && ` ${hours}h`}
          {(days > 0 || hours > 0 || minutes > 0) && ` ${minutes}m`}
          {` ${seconds}s`}
        </Badge>
      );
    }
    if (isSessionToday) {
      return <Badge className="text-xs font-semibold whitespace-nowrap bg-blue-50 text-blue-700 border-blue-200">Today</Badge>;
    }
    if (isSessionTomorrow) {
      return <Badge variant="outline" className="text-xs font-semibold whitespace-nowrap bg-purple-50 text-purple-700 border-purple-200">Tomorrow</Badge>;
    }
    return (
      <Badge variant="outline" className="text-xs font-semibold whitespace-nowrap">
        {format(sessionDate, 'MMM d')}
      </Badge>
    );
  };

  const renderCreatorActions = () => (
    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
      <Button variant="outline" size="sm" onClick={() => onEdit?.(session)} aria-label="Edit session">
        <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit
      </Button>
      <Button variant="destructive" size="sm" onClick={handleDeleteClick} disabled={isDeleting} aria-label="Delete session">
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
  
  const renderAttendeeActions = () => {
    // Use rsvpStatus instead of status to match the backend response
    const isAttending = currentUserRSVP?.rsvpStatus === 'going';
    const isNotAttending = currentUserRSVP?.rsvpStatus === 'not-going';
    const isMaybe = currentUserRSVP?.rsvpStatus === 'maybe';
    
    // Don't show any attendee actions for past sessions
    if (isPastSession) return null;
    
    // Don't show attendee actions if user is not logged in
    if (!user?.data?._id) return null;

    return (
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
        {isAttending ? (
          <div className="space-y-2">
            {session.isOnline && session.meetingLink && (
              <Button
                variant="outline"
                className="w-full text-sm h-9"
                onClick={() => window.open(session.meetingLink, '_blank', 'noopener,noreferrer')}
                aria-label="Join meeting"
              >
                <Video className="h-4 w-4 mr-2" />
                Join Meeting
              </Button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 text-sm h-9"
              onClick={(e) => handleRSVP('going', e)}
              disabled={isUpdatingRSVP}
              aria-label="Attend session"
            >
              {isUpdatingRSVP ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserCheck className="h-4 w-4 mr-2" />
              )}
              Attend
            </Button>
            <Button
              variant="outline"
              className="w-16 text-sm h-9"
              onClick={(e) => handleRSVP('not-going', e)}
              disabled={isUpdatingRSVP}
              aria-label="Decline to attend"
            >
              <UserX className="h-4 w-4" />
            </Button>
          </div>
        )}
        {isFull && !isAttending && (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
            This session is full. You will be added to the waitlist.
          </p>
        )}
      </div>
    );
  };
  
  return (
    <div 
      className={cn(
        'bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden border transition-all duration-200 flex flex-col h-full',
        isPastSession 
          ? 'opacity-90 border-gray-200 dark:border-gray-700/50'
          : 'border-gray-100 dark:border-gray-800/50 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700',
        className
      )}
      aria-label={`Session: ${session.title}`}
    >
      <div className="p-5 flex-1 flex flex-col">
        {/* Header Section */}
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-2 break-words mb-1">
              {session.title}
            </h3>
            <div className="flex items-center gap-2 flex-wrap text-sm text-gray-600 dark:text-gray-400">
              {isCreator && (
                <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 text-xs">
                  <Crown className="h-3 w-3 mr-1" />
                  Creator
                </Badge>
              )}
              {currentUserRSVP?.status === 'going' && !isCreator && (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300 text-xs">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Attending
                </Badge>
              )}
              {currentUserRSVP?.status === 'not-going' && (
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-300 text-xs">
                  <UserX className="h-3 w-3 mr-1" />
                  Not Attending
                </Badge>
              )}
            </div>
          </div>
          <div className="flex-shrink-0">
            {getDateBadge(startTime)}
          </div>
        </div>

        {/* Core Details Section */}
        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400 flex-1">
          {/* Date & Time */}
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-gray-500" />
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {format(startTime, 'MMM d, yyyy')}
            </span>
            <span className="mx-2">•</span>
            <span className="text-gray-700 dark:text-gray-300">
              {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
            </span>
            {showRelativeTime && isPastSession&&differenceInDays(startTime, new Date()) >= 0 && (
              <span className="ml-auto text-xs text-gray-500">
                ({formatDistanceToNow(startTime, { addSuffix: true })})
              </span>
           )}
          </div>

          {/* Location/Online */}
          <div className="flex items-center">
            {session.isOnline ? (
              <Video className="h-4 w-4 mr-2 text-blue-500" />
            ) : (
              <MapPin className="h-4 w-4 mr-2 text-blue-500" />
            )}
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {session.isOnline ? 'Online Meeting' : 'In-Person'}
            </span>
            <span className="ml-2 text-gray-700 dark:text-gray-300 truncate">
              {session.isOnline ? (session.meetingLink || 'No link provided') : (session.location || 'Location TBD')}
            </span>
          </div>
          
          {/* Creator */}
          <div className="flex items-center">
            <User className="h-4 w-4 mr-2 text-yellow-500" />
            <span className="font-medium text-gray-800 dark:text-gray-200">
              Creator:
            </span>
            <div className="flex items-center ml-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={getAvatarUrl(session.createdBy?.avatar)} />
                <AvatarFallback>
                  {session.createdBy?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="ml-2 text-gray-700 dark:text-gray-300">
                {session.createdBy?.name || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Attendees Section */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Users2 className="h-4 w-4 text-purple-500" />
              Attendees
            </h4>
            {!isPastSession && (
              <div className="flex items-center gap-2">
                {spotsLeft !== null && spotsLeft > 0 && !isFull && (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                    {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                  </span>
                )}
                {isFull && (
                  <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                    Session full
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* RSVP Status Counts with Interactive Buttons */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button
              onClick={(e) => handleRSVP('going', e)}
              disabled={isUpdatingRSVP}
              className={`text-center p-2 rounded-md transition-all ${
                currentUserRSVP?.rsvpStatus === 'going'
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-600 shadow-sm transform scale-[1.02]'
                  : 'bg-gray-50 dark:bg-gray-800/50 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
              } ${isUpdatingRSVP && currentUserRSVP?.rsvpStatus === 'going' ? 'opacity-80' : ''}`}
            >
              <div className="font-medium text-sm text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1">
                {isUpdatingRSVP && currentUserRSVP?.rsvpStatus === 'going' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className={`h-3 w-3 ${currentUserRSVP?.rsvpStatus === 'going' ? 'fill-blue-500' : ''}`} />
                )}
                <span className={`transition-opacity ${isUpdatingRSVP && currentUserRSVP?.rsvpStatus === 'going' ? 'opacity-70' : 'opacity-100'}`}>
                  {goingAttendees.length}
                </span>
              </div>
              <div className="text-xs text-blue-500 dark:text-blue-400">
                Going
              </div>
            </button>

            <button
              onClick={(e) => handleRSVP('maybe', e)}
              disabled={isUpdatingRSVP}
              className={`text-center p-2 rounded-md transition-all ${
                currentUserRSVP?.rsvpStatus === 'maybe'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-600 shadow-sm transform scale-[1.02]'
                  : 'bg-gray-50 dark:bg-gray-800/50 border border-transparent hover:border-yellow-200 dark:hover:border-yellow-800/50 hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10'
              } ${isUpdatingRSVP && currentUserRSVP?.rsvpStatus === 'maybe' ? 'opacity-80' : ''}`}
            >
              <div className="font-medium text-sm text-yellow-600 dark:text-yellow-400 flex items-center justify-center gap-1">
                {isUpdatingRSVP && currentUserRSVP?.rsvpStatus === 'maybe' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                <span className={`transition-opacity ${isUpdatingRSVP && currentUserRSVP?.rsvpStatus === 'maybe' ? 'opacity-70' : 'opacity-100'}`}>
                  {maybeAttendees.length}
                </span>
              </div>
              <div className="text-xs text-yellow-500 dark:text-yellow-400">
                Maybe
              </div>
            </button>

            <button
              onClick={(e) => handleRSVP('not-going', e)}
              disabled={isUpdatingRSVP}
              className={`text-center p-2 rounded-md transition-all ${
                !currentUserRSVP || currentUserRSVP?.rsvpStatus === 'not-going'
                  ? 'bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-300 dark:border-gray-600 shadow-sm transform scale-[1.02]'
                  : 'bg-gray-50 dark:bg-gray-800/50 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-100/50 dark:hover:bg-gray-700/30'
              } ${isUpdatingRSVP && (!currentUserRSVP || currentUserRSVP?.rsvpStatus === 'not-going') ? 'opacity-80' : ''}`}
            >
              <div className="font-medium text-sm text-gray-600 dark:text-gray-300 flex items-center justify-center gap-1">
                {isUpdatingRSVP && (!currentUserRSVP || currentUserRSVP?.rsvpStatus === 'not-going') ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                <span className={`transition-opacity ${isUpdatingRSVP && (!currentUserRSVP || currentUserRSVP?.rsvpStatus === 'not-going') ? 'opacity-70' : 'opacity-100'}`}>
                  {notGoingAttendees.length}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Not Going
              </div>
            </button>
          </div>
          
          {goingAttendees.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                <TooltipProvider>
                  {goingAttendees.slice(0, 5).map((attendee) => {
                    const attendeeId = attendee.user?._id || attendee.user;
                    const attendeeName = attendee.user?.name || 'User';
                    const attendeeAvatar = attendee.user?.avatar;
                    const isCurrentUser = attendeeId === user?.data?._id;
                    
                    return (
                      <Tooltip key={attendeeId}>
                        <TooltipTrigger asChild>
                          <Avatar className="h-7 w-7 border-2 border-background hover:z-10 cursor-pointer">
                            <AvatarImage src={getAvatarUrl(attendeeAvatar)} />
                            <AvatarFallback className="text-xs bg-gray-200 dark:bg-gray-700">
                              {attendeeName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="font-medium">{attendeeName}</p>
                          {isCurrentUser && (
                            <p className="text-xs text-gray-500">(You)</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
                {goingAttendees.length > 5 && (
                  <div className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-background flex items-center justify-center text-xs font-medium text-gray-500">
                    +{goingAttendees.length - 5}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No attendees yet. Be the first to join!
            </p>
          )}
        </div>
        
        {/* Action Buttons Section */}
        {user && (
          <div className="mt-4">
            {renderAttendeeActions()}
            {isCreator && renderCreatorActions()}
          </div>
        )}
      </div>
    </div>
  );
}