import React from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Users, Calendar, BookOpen, Lock, Globe, Loader2, Check, X } from "lucide-react";
import { getAvatarUrl } from "@/utils/avatarUtils";

const DIFFICULTY_COLORS = {
  beginner: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200",
  intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
  advanced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200"
};

const STATUS_COLORS = {
  open: "bg-green-500",
  almost_full: "bg-yellow-400",
  full: "bg-red-500",
  closed: "bg-red-500",
  ongoing: "bg-blue-500"
};

const STATUS_LABELS = {
  open: "Open",
  almost_full: "Almost Full",
  full: "Full",
  closed: "Closed",
  ongoing: "In Progress"
};

export default function GroupCard({ 
  group, 
  onJoin, 
  joinLoading, 
  isMember = false,
  className = "" 
}) {
    // Normalize status to lowercase and handle different status formats
  const normalizedStatus = (group.calculatedStatus || group.status || 'open').toLowerCase().replace(/\s+/g, '_');
  const difficulty = group.difficulty || "beginner";
  const difficultyClass = DIFFICULTY_COLORS[difficulty.toLowerCase()] || DIFFICULTY_COLORS.beginner;
  const difficultyDisplay = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  
  // Get status color and label with fallbacks
  const statusColor = STATUS_COLORS[normalizedStatus] || "bg-gray-400";
  const statusLabel = STATUS_LABELS[normalizedStatus] || "Unknown";
  
  // Log for debugging
  console.log('Status:', {
    originalStatus: group.status,
    calculatedStatus: group.calculatedStatus,
    normalizedStatus,
    statusColor,
    statusLabel
  });
  const memberCount = group.memberCount || group.members?.length || 0;
  const maxMembers = group.maxMembers || 10;
  const groupAvatar = getAvatarUrl(group.avatar);
  
  // Use first letters of words in group title, or 'G' as fallback
  const getInitials = (name) => {
    if (!name) return 'G';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };
  
  const groupAvatarPlaceholder = getInitials(group?.title);

  return (
    <Card 
      className={`
        group relative rounded-xl border border-gray-100 dark:border-gray-800/50 
        bg-white dark:bg-gray-900 flex flex-col h-full overflow-hidden
        transition-all duration-300 ease-in-out shadow-sm hover:shadow-lg
        hover:-translate-y-0.5 hover:border-gray-200 dark:hover:border-gray-700
        ${className}
      `}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 flex-shrink-0">
            {group.avatar ? (
              <>
                <img
                  src={groupAvatar}
                  alt={group.title ? `${group.title} group avatar` : 'Group avatar'}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="h-full w-full hidden items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold">
                  {groupAvatarPlaceholder}
                </div>
              </>
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold">
                {groupAvatarPlaceholder}
              </div>
            )}
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <Badge 
              className={`${difficultyClass} text-xs font-medium whitespace-nowrap`}
              title={`Difficulty: ${difficultyDisplay}`}
            >
              {difficultyDisplay}
            </Badge>
            
            <h3 
              className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mt-1"
              title={group.title}
            >
              {group.title}
            </h3>
            
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span 
                className={`inline-block h-2 w-2 rounded-full ${statusColor} flex-shrink-0`}
                aria-label={`Status: ${statusLabel}`}
                title={statusLabel}
              />
              <span>{statusLabel}</span>
            </div>
            
            {group.subject && (
              <div className="flex items-center gap-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate max-w-[200px]" title={group.subject}>
                  {group.subject}
                </span>
              </div>
            )}
            
            <div className="flex flex-wrap gap-3 mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                <span className="whitespace-nowrap">
                  {memberCount}/{maxMembers}
                  {normalizedStatus === 'almost_full' && (
                    <span className="ml-1 text-yellow-600 dark:text-yellow-400 font-medium">
                      (Full Soon)
                    </span>
                  )}
                  {normalizedStatus === 'full' && (
                    <span className="ml-1 text-red-600 dark:text-red-400 font-medium">
                      (Full)
                    </span>
                  )}
                </span>
              </div>
              
              {group.nextSession && (
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {new Date(group.nextSession).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: new Date(group.nextSession).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 md:p-5 pt-1 sm:pt-2 flex-1 flex flex-col transition-colors duration-300">
        {group.description && (
          <p 
            className="text-gray-600 dark:text-gray-300 text-sm mb-3 line-clamp-3 transition-colors duration-300 
            group-hover:text-gray-700 dark:group-hover:text-gray-200"
            title={group.description.length > 120 ? group.description : undefined}
          >
            {group.description}
          </p>
        )}
        
        {group.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2 sm:mb-3 overflow-hidden max-h-16">
            {group.tags.map((tag, i) => (
              <span 
                key={i} 
                className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-full inline-block"
                title={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {group.privacy && (
          <div className="mt-auto pt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center">
            {group.privacy === 'private' ? (
              <Lock className="h-3 w-3 mr-1" />
            ) : (
              <Globe className="h-3 w-3 mr-1" />
            )}
            {group.privacy === 'private' ? 'Private Group' : 'Public Group'}
          </div>
        )}
      </CardContent>
      
      {onJoin && (
        <CardFooter className="p-3 sm:p-4 md:p-5 pt-0 mt-2 sm:mt-3">
          <div className="w-full transition-shadow duration-300">
            {console.log('GroupCard Button State:', {
              groupId: group.id,
              groupTitle: group.title,
              isMember,
              joinLoading,
              isFull: normalizedStatus === 'full',
              disabled: isMember || joinLoading || normalizedStatus === 'full',
              hasOnJoin: !!onJoin
            })}
            
            {isMember ? (
              <Button
                disabled={true}
                className="w-full font-bold text-white text-sm sm:text-base
                  shadow-md
                  transition-all duration-200 ease-in-out
                  flex items-center justify-center
                  bg-gradient-to-r from-indigo-500/70 to-purple-500/70
                  cursor-not-allowed"
                size="sm"
              >
                <Check className="h-4 w-4 mr-2" />
                Joined
              </Button>
            ) : normalizedStatus === 'full' ? (
              <Button
                disabled={true}
                className="w-full font-bold text-white text-sm sm:text-base
                  shadow-md
                  transition-all duration-200 ease-in-out
                  flex items-center justify-center
                  bg-gradient-to-r from-indigo-500/50 to-purple-500/50
                  cursor-not-allowed"
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                Group Full
              </Button>
            ) : (
              <Button
                onClick={() => onJoin(group.id)}
                disabled={joinLoading}
                className={`w-full font-bold text-white text-sm sm:text-base
                  shadow-md hover:shadow-lg active:scale-[0.98]
                  transition-all duration-200 ease-in-out
                  flex items-center justify-center relative group/button
                  bg-gradient-to-r from-indigo-500 to-purple-500 
                  hover:from-indigo-600 hover:to-purple-600`}
                size="sm"
                aria-disabled={joinLoading}
              >
                {joinLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <span className="inline-flex items-center relative pr-5">
                    <span className="relative">
                      Join Group
                      <span className="absolute -right-5 top-1/2 -translate-y-1/2 opacity-0 -translate-x-1 
                        group-hover/button:translate-x-0 group-hover/button:opacity-100 
                        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1.4)]">
                        &rarr;
                      </span>
                    </span>
                  </span>
                )}
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
