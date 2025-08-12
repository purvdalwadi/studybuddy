import React, { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isPast, isFuture, startOfDay, endOfDay, addDays, format, isSameDay, isWithinInterval, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar as CalendarIcon, Plus, Loader2, ServerCrash, Users, CalendarDays, Filter, ChevronLeft, ChevronRight,ChevronDown, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import SessionCard from '@/components/sessions/SessionCard';
import StudySessionDialog from '@/components/sessions/StudySessionDialog';
import { 
  useSessions, 
  useUpcomingSessions, 
  useSessionsByDateRange,
  useCreateSession, 
  useUpdateSession, 
  useDeleteSession 
} from '@/hooks/useSchedule';
import { toast } from 'sonner';

const SessionList = ({ sessions, onEdit, onDelete, noSessionsMessage, showRelativeTime = false }) => {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-16">
        <Users className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No sessions</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{noSessionsMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <SessionCard
          key={session._id}
          session={session}
          onEdit={onEdit}
          onDelete={onDelete}
          showRelativeTime={showRelativeTime}
        />
      ))}
    </div>
  );
};

const SESSION_FILTERS = {
  ALL: 'all',
  ONLINE: 'online',
  IN_PERSON: 'in_person',
  MY_SESSIONS: 'my_sessions'
};

export default function Schedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [dateRange, setDateRange] = useState({
    from: startOfDay(new Date()),
    to: endOfDay(addDays(new Date(), 7))
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState(SESSION_FILTERS.ALL);
  
  // Ensure dateRange is never null
  const safeDateRange = dateRange || {
    from: startOfDay(new Date()),
    to: endOfDay(addDays(new Date(), 7))
  };

  // Fetch sessions with date range and filters
  const { data: sessions = [], isLoading, isError, refetch } = useSessionsByDateRange(
    safeDateRange.from,
    safeDateRange.to,
    { 
      search: searchQuery,
      filter: sessionFilter !== SESSION_FILTERS.ALL ? sessionFilter : undefined,
      userId: sessionFilter === SESSION_FILTERS.MY_SESSIONS ? user?.data?._id : undefined
    }
  );

  // Fetch upcoming sessions for the sidebar
  const { data: upcomingSessions = [] } = useUpcomingSessions({
    limit: 3,
    excludeFull: true,
    userId: user?.data?._id
  });

  const { mutate: createSession, isLoading: isCreating } = useCreateSession({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create session');
    }
  });
  
  const { mutate: updateSession, isLoading: isUpdating } = useUpdateSession({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update session');
    }
  });
  
  const { mutate: deleteSession } = useDeleteSession({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete session');
    }
  });

  const handleCreateNew = useCallback(() => {
    setEditingSession(null);
    setIsDialogOpen(true);
  }, []);

  const handleEdit = useCallback((session) => {
    setEditingSession(session);
    setIsDialogOpen(true);
  }, []);

  const handleDelete = useCallback((sessionId) => {
    if (window.confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      deleteSession(sessionId);
    }
  }, [deleteSession]);

  const handleSave = useCallback((sessionData) => {
    if (editingSession) {
      updateSession({ 
        id: editingSession._id, 
        ...sessionData 
      });
    } else {
      createSession(sessionData);
    }
    setIsDialogOpen(false);
    setEditingSession(null);
  }, [createSession, updateSession, editingSession]);

  // Handle date range selection
  const handleDateRangeSelect = useCallback((range) => {
    if (range?.from) {
      setDateRange({
        from: startOfDay(range.from),
        to: range.to ? endOfDay(range.to) : endOfDay(range.from)
      });
    } else {
      // Reset to default range if cleared
      setDateRange({
        from: startOfDay(new Date()),
        to: endOfDay(addDays(new Date(), 7))
      });
    }
  }, []);

  // Unified filter function
  const filterSessions = useCallback((sessions, { search = '', filter = SESSION_FILTERS.ALL, dateRange, userId }) => {
    const now = new Date();
    const searchLower = search.toLowerCase();
    
    return sessions.filter(session => {
      // Apply search filter
      const matchesSearch = 
        session.title?.toLowerCase().includes(searchLower) ||
        session.description?.toLowerCase().includes(searchLower) ||
        session.group?.name?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
      
      // Apply type filter
      if (filter === SESSION_FILTERS.ONLINE && !session.isOnline) return false;
      if (filter === SESSION_FILTERS.IN_PERSON && session.isOnline) return false;
      if (filter === SESSION_FILTERS.MY_SESSIONS && session.createdBy?._id !== userId) return false;
      
      // Apply date range filter if provided
      const sessionDate = new Date(session.scheduledDate);
      if (dateRange?.from && dateRange?.to) {
        if (!isWithinInterval(sessionDate, { start: dateRange.from, end: dateRange.to })) {
          return false;
        }
      }
      
      return true;
    });
  }, []);

  // Categorize sessions with unified filtering
  const { ongoing, upcoming, mySessions, past } = useMemo(() => {
    const now = new Date();
    const filteredSessions = filterSessions(sessions, { 
      search: searchQuery,
      filter: sessionFilter,
      dateRange,
      userId: user?.data?._id 
    });
    
    return {
      ongoing: filteredSessions.filter(s => {
        const start = new Date(s.scheduledDate);
        const end = new Date(start.getTime() + (s.duration * 60000));
        return start <= now && now <= end;
      }),
      upcoming: filteredSessions.filter(s => new Date(s.scheduledDate) > now),
      mySessions: filteredSessions.filter(s => s.createdBy?._id === user?.data?._id),
      past: filteredSessions.filter(s => {
        const end = new Date(new Date(s.scheduledDate).getTime() + (s.duration * 60000));
        return end < now;
      })
    };
  }, [sessions, searchQuery, sessionFilter, dateRange, user?.data?._id, filterSessions]);

  return (
    <>
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Study Schedule</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage and join study sessions with your groups</p>
          </div>
          <Button onClick={handleCreateNew} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Session
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative w-full sm:w-64">
              <Input
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            
            <div className="flex flex-1 gap-2 w-full sm:w-auto">
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2 opacity-50" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SESSION_FILTERS.ALL}>All Sessions</SelectItem>
                  <SelectItem value={SESSION_FILTERS.ONLINE}>Online</SelectItem>
                  <SelectItem value={SESSION_FILTERS.IN_PERSON}>In Person</SelectItem>
                  <SelectItem value={SESSION_FILTERS.MY_SESSIONS}>My Sessions</SelectItem>
                </SelectContent>
              </Select>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[300px] justify-start text-left font-normal h-12 px-4",
                      "hover:bg-accent/5 transition-colors duration-200 border-border/50",
                      "relative overflow-hidden group"
                    )}
                  >
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    <CalendarDays className="h-4 w-4 mr-3 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-xs font-medium text-muted-foreground mb-0.5 truncate">Date Range</div>
                      <div className="text-sm font-medium truncate">
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <span className="flex items-center">
                              <span className="font-semibold">
                                {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
                              </span>
                              {isSameDay(dateRange.from, dateRange.to) && (
                                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-accent/50 text-accent-foreground">
                                  Single day
                                </span>
                              )}
                            </span>
                          ) : (
                            format(dateRange.from, 'MMM d, yyyy')
                          )
                        ) : (
                          <span className="text-muted-foreground">Select date range</span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0 rounded-xl shadow-xl border border-border/50 bg-background/95 backdrop-blur-sm" 
                  align="start"
                  sideOffset={8}
                >
                  <div className="p-4 border-b border-border/50">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Select Date Range</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDateRange({
                            from: startOfDay(new Date()),
                            to: endOfDay(new Date())
                          });
                        }}
                        className="h-8 text-xs justify-start"
                      >
                        <span className="mr-1">📅</span> Today
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDateRange({
                            from: startOfDay(addDays(new Date(), 1)),
                            to: endOfDay(addDays(new Date(), 1))
                          });
                        }}
                        className="h-8 text-xs justify-start"
                      >
                        <span className="mr-1">📅</span> Tomorrow
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDateRange({
                            from: startOfDay(new Date()),
                            to: endOfDay(addDays(new Date(), 6))
                          });
                        }}
                        className="h-8 text-xs justify-start"
                      >
                        <span className="mr-1">📆</span> This Week
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = new Date();
                          setDateRange({
                            from: startOfMonth(today),
                            to: endOfMonth(today)
                          });
                        }}
                        className="h-8 text-xs justify-start"
                      >
                        <span className="mr-1">📅</span> This Month
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 pt-0">
                    <div className="relative">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from || new Date()}
                        selected={dateRange}
                        onSelect={handleDateRangeSelect}
                        numberOfMonths={window.innerWidth < 768 ? 1 : 2}
                        className="p-0"
                        classNames={{
                          caption: "flex justify-center relative items-center pt-1 pb-4",
                          caption_label: "text-sm font-medium",
                          nav: "flex items-center",
                          nav_button: "h-8 w-8 p-0 rounded-full hover:bg-accent/50",
                          nav_button_previous: "absolute left-1",
                          nav_button_next: "absolute right-1",
                          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-xs",
                          cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent/50",
                          day: "h-9 w-9 p-0 font-normal rounded-md aria-selected:opacity-100 hover:bg-accent/50",
                          day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-medium",
                          day_today: "bg-accent/50 text-accent-foreground font-medium",
                          day_outside: "text-muted-foreground opacity-50",
                          day_disabled: "text-muted-foreground opacity-30",
                          day_range_middle: "aria-selected:bg-accent/30 aria-selected:text-foreground",
                          day_range_end: "font-medium",
                          day_range_start: "font-medium",
                          day_hidden: "invisible"
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                      <div className="text-xs text-muted-foreground">
                        {dateRange?.from && dateRange?.to ? (
                          <span>
                            {format(dateRange.from, 'MMM d, yyyy')} - {format(dateRange.to, 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span>Select a date range</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDateRange({
                              from: startOfDay(new Date()),
                              to: endOfDay(addDays(new Date(), 7))
                            });
                          }}
                          className="h-8 text-xs"
                        >
                          Reset
                        </Button>
                        <PopoverClose asChild>
                          <Button size="sm" className="h-8 text-xs">
                            Apply
                          </Button>
                        </PopoverClose>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              {(searchQuery || sessionFilter !== SESSION_FILTERS.ALL || dateRange) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery('');
                    setSessionFilter(SESSION_FILTERS.ALL);
                    setDateRange({
                      from: startOfDay(new Date()),
                      to: endOfDay(addDays(new Date(), 7))
                    });
                  }}
                  className="shrink-0"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          </div>
          
          {/* Active Filters */}
          <div className="flex flex-wrap gap-2">
            {searchQuery && (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Search: {searchQuery}
                <button
                  onClick={() => setSearchQuery('')}
                  className="ml-2 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            
            {sessionFilter !== SESSION_FILTERS.ALL && (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                {sessionFilter === SESSION_FILTERS.ONLINE && 'Online'}
                {sessionFilter === SESSION_FILTERS.IN_PERSON && 'In Person'}
                {sessionFilter === SESSION_FILTERS.MY_SESSIONS && 'My Sessions'}
                <button
                  onClick={() => setSessionFilter(SESSION_FILTERS.ALL)}
                  className="ml-2 rounded-full p-0.5 hover:bg-purple-200 dark:hover:bg-purple-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            
            {dateRange?.from && (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {format(dateRange.from, 'MMM d')}
                {dateRange.to && ` - ${format(dateRange.to, 'MMM d')}`}
                <button
                  onClick={() => setDateRange({
                    from: startOfDay(new Date()),
                    to: endOfDay(addDays(new Date(), 7))
                  })}
                  className="ml-2 rounded-full p-0.5 hover:bg-green-200 dark:hover:bg-green-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-lg">
                    <CalendarIcon className="h-5 w-5 mr-2" />
                    {format(currentMonth, 'MMMM yyyy')}
                  </CardTitle>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="h-8 flex items-center justify-center">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 35 }).map((_, index) => {
                      const date = addDays(
                        startOfMonth(currentMonth),
                        index - startOfMonth(currentMonth).getDay()
                      );
                      const daySessions = sessions.filter(session => 
                        isSameDay(new Date(session.scheduledDate), date)
                      );
                      const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                      const isTodayDate = isSameDay(date, new Date());
                      const hasSessions = daySessions.length > 0;
                      
                      return (
                        <div
                          key={date.toString()}
                          onClick={() => setSelectedDate(date)}
                          className={cn(
                            'h-10 rounded-md flex flex-col items-center justify-center text-sm cursor-pointer transition-colors',
                            !isCurrentMonth && 'text-gray-400 dark:text-gray-600',
                            isTodayDate && 'font-bold',
                            isSameDay(date, selectedDate) 
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800',
                            hasSessions && 'relative after:absolute after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-blue-500'
                          )}
                        >
                          {date.getDate()}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Selected Date Sessions */}
                {selectedDate && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium">
                      {isSameDay(selectedDate, new Date()) ? 'Today' : format(selectedDate, 'MMMM d, yyyy')}
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {sessions
                        .filter(session => isSameDay(new Date(session.scheduledDate), selectedDate))
                        .map(session => (
                          <div 
                            key={session._id}
                            className="p-2 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                            onClick={() => handleEdit(session)}
                          >
                            <div className="font-medium">{session.title}</div>
                            <div className="text-gray-500 dark:text-gray-400">
                              {format(new Date(session.scheduledDate), 'h:mm a')}
                            </div>
                          </div>
                        ))}
                      {sessions.filter(session => isSameDay(new Date(session.scheduledDate), selectedDate)).length === 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                          No sessions scheduled
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Tabs defaultValue="upcoming" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="my-sessions">My Sessions</TabsTrigger>
                <TabsTrigger value="past">Past</TabsTrigger>
              </TabsList>
              <Card className="mt-4">
                <CardContent className="p-6">
                  {isLoading ? (
                    <div className="flex justify-center items-center h-48">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : isError ? (
                    <div className="text-center py-16 text-red-500">
                      <ServerCrash className="mx-auto h-12 w-12" />
                      <h3 className="mt-2 text-sm font-medium">Error loading sessions</h3>
                      <p className="mt-1 text-sm">Please try refreshing the page.</p>
                    </div>
                  ) : (
                    <>
                      <TabsContent value="ongoing">
                        <SessionList 
                          sessions={ongoing} 
                          onEdit={handleEdit} 
                          onDelete={handleDelete} 
                          noSessionsMessage="No ongoing sessions right now." 
                        />
                      </TabsContent>
                      <TabsContent value="upcoming">
                        <SessionList 
                          sessions={upcoming} 
                          onEdit={handleEdit} 
                          onDelete={handleDelete} 
                          noSessionsMessage="No upcoming sessions found."
                          showRelativeTime={false}
                        />
                      </TabsContent>
                      <TabsContent value="my-sessions">
                        <SessionList 
                          sessions={mySessions} 
                          onEdit={handleEdit} 
                          onDelete={handleDelete} 
                          noSessionsMessage="You haven't created any sessions yet."
                          showRelativeTime={true}
                        />
                      </TabsContent>
                      <TabsContent value="past">
                        <SessionList 
                          sessions={past} 
                          onEdit={handleEdit} 
                          onDelete={handleDelete} 
                          noSessionsMessage="No past sessions found."
                          showRelativeTime={true}
                        />
                      </TabsContent>
                    </>
                  )}
                </CardContent>
              </Card>
            </Tabs>
          </div>
        </div>
      </div>

      <StudySessionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSave}
        session={editingSession}
        isLoading={isCreating || isUpdating}
      />
    </>
  );
}
