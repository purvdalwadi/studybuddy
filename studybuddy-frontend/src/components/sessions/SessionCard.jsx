import React from 'react';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';
import { Clock, MapPin, Users, Tag, Calendar, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SessionCard({ session, onJoin }) {
  const startTime = new Date(session.scheduledDate);
  const endTime = new Date(startTime.getTime() + (session.duration * 60000));
  
  const getDateBadge = (date) => {
    if (isPast(date)) return { text: 'Completed', variant: 'secondary' };
    if (isToday(date)) return { text: 'Today', variant: 'primary' };
    if (isTomorrow(date)) return { text: 'Tomorrow', variant: 'outline' };
    return { text: format(date, 'MMM d'), variant: 'outline' };
  };

  const getSessionTypeBadge = (type) => {
    const types = {
      lecture: { text: 'Lecture', variant: 'blue' },
      discussion: { text: 'Discussion', variant: 'green' },
      qna: { text: 'Q&A', variant: 'purple' },
      workshop: { text: 'Workshop', variant: 'orange' },
      review: { text: 'Review', variant: 'red' },
      other: { text: 'Other', variant: 'gray' },
    };
    return types[type] || types.other;
  };

  const dateBadge = getDateBadge(startTime);
  const sessionType = getSessionTypeBadge(session.sessionType || 'other');

  return (
    <div 
      className={`bg-white dark:bg-gray-900 rounded-xl shadow-md overflow-hidden border ${
        isPast(startTime) 
          ? 'opacity-70 border-gray-200 dark:border-gray-700' 
          : 'border-gray-100 dark:border-gray-800 hover:shadow-lg transition-shadow'
      }`}
      aria-label={`Session: ${session.title}`}
    >
      <div className="p-5 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
              {session.title}
            </h3>
            {session.groupName && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {session.groupName}
              </p>
            )}
          </div>
          <Badge variant={dateBadge.variant}>
            {dateBadge.text}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Calendar className="h-4 w-4" />
          <span>{format(startTime, 'EEE, MMM d, yyyy')}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Clock className="h-4 w-4" />
          <span>
            {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
            {' '}({session.duration} min)
          </span>
        </div>

        {session.location && (
          <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{session.location}</span>
          </div>
        )}

        {session.isOnline && session.meetingLink && (
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
            <Video className="h-4 w-4" />
            <a 
              href={session.meetingLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Join Online Meeting
            </a>
          </div>
        )}

        {(session.tags?.length > 0) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant={sessionType.variant} className="text-xs">
              {sessionType.text}
            </Badge>
            {session.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {session.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{session.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}

        <div className="pt-2">
          <Button 
            variant={isPast(startTime) ? 'outline' : 'default'}
            className="w-full mt-2"
            onClick={() => onJoin?.(session)}
            disabled={isPast(startTime) && !session.meetingLink}
          >
            {isPast(startTime) ? 'View Details' : 'Join Session'}
          </Button>
        </div>
      </div>
    </div>
  );
}
