import React, { useState, useMemo, useCallback } from 'react';
import { format, isPast, isToday, isThisWeek, isAfter, startOfWeek, endOfWeek } from 'date-fns';
import { AlertCircle, Calendar, Filter, Search, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import StudySessionDialog from '@/components/sessions/StudySessionDialog';
import SessionCard from '@/components/sessions/SessionCard';
import { toast } from 'sonner';
import { 
  useSessions, 
  useUpcomingSessions, 
  useDeleteSession, 
  useSessionRSVP 
} from '@/hooks/useSchedule';

// Session type options
const SESSION_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'lecture', label: 'Lecture' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'qna', label: 'Q&A' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'review', label: 'Review' },
  { value: 'other', label: 'Other' },
];

// Time filter options
const TIME_FILTERS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'past', label: 'Past' },
];

export default function Schedule() {
  // State for filters and UI
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('upcoming');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);

  // Fetch sessions based on filters
  const { data: allSessions = [], isLoading, error } = useSessions({
    enabled: timeFilter !== 'upcoming' && timeFilter !== 'today' && timeFilter !== 'week'
  });

  // Fetch upcoming sessions when that filter is active
  const { data: upcomingSessions = [] } = useUpcomingSessions({
    limit: 50
  }, {
    enabled: timeFilter === 'upcoming' || timeFilter === 'today' || timeFilter === 'week'
  });

  // Use appropriate sessions based on filter
  const sessions = useMemo(() => {
    if (timeFilter === 'upcoming' || timeFilter === 'today' || timeFilter === 'week') {
      return upcomingSessions;
    }
    return allSessions;
  }, [timeFilter, allSessions, upcomingSessions]);

  // Filter sessions based on search, time, and type
  const filteredSessions = useMemo(() => {
    let result = Array.isArray(sessions) ? [...sessions] : [];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(session => 
        session.title.toLowerCase().includes(query) ||
        session.description?.toLowerCase().includes(query) ||
        session.tags?.some(tag => tag?.toLowerCase().includes(query))
      );
    }

    // Apply time filter
    const now = new Date();
    switch (timeFilter) {
      case 'today':
        result = result.filter(session => isToday(new Date(session.scheduledDate)));
        break;
      case 'week':
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        result = result.filter(session => 
          (isThisWeek(new Date(session.scheduledDate), { weekStartsOn: 1 }) ||
          isAfter(new Date(session.scheduledDate), now)) &&
          new Date(session.scheduledDate) >= weekStart &&
          new Date(session.scheduledDate) <= weekEnd
        );
        break;
      case 'past':
        result = result.filter(session => isPast(new Date(session.scheduledDate)));
        break;
      default: // 'upcoming' is handled by the query
        break;
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter(session => session.sessionType === typeFilter);
    }

    // Sort by date
    return result.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
  }, [sessions, searchQuery, timeFilter, typeFilter]);

  // Session mutations
  const { mutateAsync: deleteSession } = useDeleteSession();
  const { mutateAsync: handleRsvp } = useSessionRSVP();

  // Handle session actions
  const handleJoinSession = useCallback((session) => {
    if (session.isOnline && session.meetingLink) {
      window.open(session.meetingLink, '_blank');
    } else {
      toast.info('This is an in-person session. Please check the location details.');
    }
  }, []);

  const handleDeleteSession = useCallback(async () => {
    if (!sessionToDelete) return;
    
    try {
      await deleteSession(sessionToDelete._id);
      toast.success('Session deleted successfully');
      setSessionToDelete(null);
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session. Please try again.');
    }
  }, [sessionToDelete, deleteSession]);

  // Handle successful session creation
  const handleSessionCreated = useCallback((newSession) => {
    setIsCreateDialogOpen(false);
    toast.success('Session created successfully!');
    // The sessions will be refetched automatically by react-query
  }, []);

  // Debug: Log when component renders
  React.useEffect(() => {
    console.log('Schedule component rendered, isCreateDialogOpen:', isCreateDialogOpen);
  }, [isCreateDialogOpen]);

  return (
    <div className="p-4 md:p-8" aria-label="Schedule Page">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-extrabold text-primary-700 dark:text-primary-100">
            Study Schedule
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your upcoming study sessions
          </p>
        </div>
        <div className="flex-shrink-0">
          <Button 
            className="bg-primary-600 hover:bg-primary-700 text-white"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Session
          </Button>
          <StudySessionDialog
            onSuccess={handleSessionCreated}
            onError={(error) => console.error('Error creating session:', error)}
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          />
        </div>
      </div>

      <div className="mb-8">
        <div className="bg-gradient-to-br from-primary-50 to-blue-50 dark:from-gray-900 dark:to-blue-950/50 rounded-xl shadow-sm p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search sessions..."
                className="pl-10 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
              disabled={isLoading}
            >
              <Filter className="h-4 w-4" />
              {showFilters ? 'Hide Filters' : 'Filters'}
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Time Period
                </label>
                <Tabs
                  value={timeFilter}
                  onValueChange={setTimeFilter}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-4">
                    {TIME_FILTERS.map((filter) => (
                      <TabsTrigger 
                        key={filter.value} 
                        value={filter.value}
                        disabled={isLoading}
                      >
                        {filter.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Session Type
                </label>
                <Select 
                  value={typeFilter} 
                  onValueChange={setTypeFilter}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a session type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {timeFilter === 'past' ? 'Past Sessions' : 'Upcoming Sessions'}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'})
          </span>
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-foreground">
            Error loading sessions
          </h3>
          <p className="mt-2 text-muted-foreground">
            {error.message || 'Failed to load sessions. Please try again.'}
          </p>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={() => window.location.reload()}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Retry'
            )}
          </Button>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-foreground">
            No sessions found
          </h3>
          <p className="mt-2 text-muted-foreground">
            {searchQuery || timeFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your filters or search query.'
              : 'Create a new session to get started.'}
          </p>
          <StudySessionDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              toast.success('Session created successfully!');
            }}
            trigger={
              <Button 
                variant="primary"
                className="gap-2 whitespace-nowrap mt-6"
              >
                <Plus className="h-4 w-4" />
                Create Session
              </Button>
            }
          />
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-300px)] pr-4">
          <div className="space-y-4">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session._id}
                session={session}
                onJoin={() => handleJoinSession(session)}
                onDelete={() => setSessionToDelete(session)}
                onRSVP={async (attending) => {
                  try {
                    await handleRsvp({
                      sessionId: session._id,
                      attending
                    });
                    toast.success(attending ? 'Successfully joined the session!' : 'Successfully left the session');
                  } catch (error) {
                    console.error('Error updating RSVP:', error);
                    toast.error('Failed to update RSVP. Please try again.');
                  }
                }}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <AlertDialog
        open={!!sessionToDelete}
        onOpenChange={(open) => !open && setSessionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the session "{sessionToDelete?.title}" and all its data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
