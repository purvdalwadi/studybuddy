import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Settings, Trash2, Loader2 } from "lucide-react";

const DIFFICULTY_COLORS = {
  Beginner: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200",
  Intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
  Advanced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200",
  // Fallback for lowercase values
  beginner: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200",
  intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
  advanced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200"
};

// Helper function to get the normalized difficulty level
const getNormalizedDifficulty = (difficulty) => {
  if (!difficulty) return 'Beginner';
  if (typeof difficulty !== 'string') return 'Beginner';
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
};

export default function CreatedGroupCard({ 
  group, 
  onSettings, 
  onDelete, 
  onRemoveMember,
  isDeleting = false,
  currentUserId
}) {
  const [showMembers, setShowMembers] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  
  const isCreator = group?.creator?._id === currentUserId || group?.creator === currentUserId;
  
  const handleRemoveMember = async (memberId) => {
    if (!onRemoveMember) return;
    
    try {
      setRemovingMemberId(memberId);
      await onRemoveMember(memberId);
      // The toast will be shown by the parent component
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };
  
  // Get the current member count, falling back to the length of members array if not available
  const memberCount = group?.memberCount ?? group?.members?.length ?? 0;
  const navigate = useNavigate();

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-100 dark:border-gray-800 overflow-hidden h-full flex flex-col">
      <div className="p-4 sm:p-5 h-full flex flex-col">
        {/* Header with status indicator and title */}
        <div className="flex items-start gap-2 sm:gap-3 mb-3">
          <div 
            className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
              group.members?.length >= (group.maxMembers || 10) 
                ? 'bg-red-500' 
                : group.members?.length / (group.maxMembers || 10) > 0.8 
                  ? 'bg-yellow-500' 
                  : 'bg-green-500'
            }`}
          ></div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex-1 line-clamp-2 sm:line-clamp-1 break-words">
            {group.title}
          </h3>
          <Badge 
            variant="secondary" 
            className={`${DIFFICULTY_COLORS[group.difficulty] || DIFFICULTY_COLORS.Beginner} text-xs font-medium`}
          >
            {getNormalizedDifficulty(group.difficulty)}
          </Badge>
        </div>

        {/* Meta information */}
        <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>{group.subject || "General Study"}</span>
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>{group.members?.length || 0} members</span>
            <span className="mx-1.5 sm:mx-2 text-gray-300 dark:text-gray-600">•</span>
            
          </div>
          {group.nextSession && (
            <div className="flex items-center text-xs sm:text-sm text-gray-600 dark:text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Next: {new Date(group.nextSession).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {group.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-3 sm:mb-4">
            {group.tags.slice(0, 3).map((tag, i) => (
              <span 
                key={i} 
                className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs font-medium"
              >
                {tag}
              </span>
            ))}
            {group.tags.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                +{group.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Spacer to push actions to bottom */}
        <div className="flex-grow"></div>
        
        {/* Actions */}
        <div className="pt-3 sm:pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 space-y-2">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 text-xs sm:text-sm px-2 sm:px-3"
              onClick={() => {
                const groupId = group._id || group.id;
                if (groupId) {
                  navigate(`/messages/${groupId}`);
                } else {
                  console.error('Cannot navigate to chat: Missing group ID', group);
                }
              }}
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Chat
            </Button>
            <Button 
              variant="outline"
              size="sm" 
              className="flex-1 text-xs sm:text-sm px-2 sm:px-3"
              onClick={() => {
                if (group) {
                  onSettings(group);
                } else {
                  console.error('Cannot open settings: Invalid group data');
                }
              }}
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Settings
            </Button>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            className="w-full text-xs sm:text-sm"
            onClick={() => {
              const groupId = group._id || group.id;
              if (groupId) {
                onDelete(groupId);
              } else {
                console.error('Cannot delete group: Missing group ID', group);
              }
            }}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            )}
            Delete Group
          </Button>
        </div>
      </div>
    </div>
  );
}
