import React, { useEffect, useMemo, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useGroups } from '@/hooks/useGroups';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MapPin, LinkIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateSession, useUpdateSession } from '@/hooks/useSchedule';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Session validation schema
const sessionSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long'),
  description: z.string().optional(),
  groupId: z.string().min(1, 'You must select a group'),
  scheduledDate: z.string().min(1, 'Date is required'),
  scheduledTime: z.string().min(1, 'Time is required'),
  duration: z.coerce.number().min(15, 'Duration must be at least 15 minutes'),
  isOnline: z.boolean().default(false),
  location: z.string().optional(),
  meetingLink: z.string().url('Must be a valid URL').optional().or(z.literal(''))
}).refine(data => data.isOnline ? !!data.meetingLink : !!data.location, {
  message: 'Location or meeting link is required',
  path: ['location']
});

export default function StudySessionDialog({ 
  open, 
  onOpenChange, 
  session, 
  onSave,
  isLoading: externalIsLoading 
}) {
  const { user } = useAuth();
  const isEditMode = Boolean(session);
  const createMutation = useCreateSession();
  const updateMutation = useUpdateSession();
  const isLoading = externalIsLoading || createMutation.isPending || updateMutation.isPending;

  const { data: groupsData, isLoading: isLoadingGroups } = useGroups();
  
  // Only show groups where the user is the creator (can create/edit sessions)
  const userGroups = useMemo(() => 
    groupsData?.filter(g => g.creator?._id === user?.data?._id) || [],
    [groupsData, user?.data?._id]
  );

  // Set default values for create mode
  const defaultValues = useMemo(() => ({
    title: '',
    description: '',
    groupId: userGroups.length === 1 ? userGroups[0]._id : '',
    scheduledDate: format(new Date(), 'yyyy-MM-dd'),
    scheduledTime: format(new Date(Date.now() + 60 * 60 * 1000), 'HH:00'), // 1 hour from now
    duration: 60, // 1 hour
    isOnline: false,
    location: '',
    meetingLink: ''
  }), [userGroups]);
  
  // Initialize form with useForm hook
  
  
 
  
 
  
  // Initialize form with useForm hook
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    register,
    formState: { errors, isDirty }
  } = useForm({
    resolver: zodResolver(sessionSchema),
    mode: 'onChange',
    defaultValues: defaultValues
  });
  
  // Watch for isOnline changes to update validation
  const isOnline = watch('isOnline');

  // Handle form initialization and reset when dialog opens/closes or session changes
  useEffect(() => {
    if (!open) return;
    
    if (isEditMode && session) {
      console.log('[Debug] Initializing form with session data:', session);
      
      // Parse the session data
      const startTime = session.scheduledDate ? new Date(session.scheduledDate) : new Date();
      const groupId = session.group?._id || session.groupId || '';
      
      // Prepare form values
      const formValues = {
        title: session.title || '',
        description: session.description || '',
        groupId: groupId,
        sessionType: session.sessionType || 'discussion',
        scheduledDate: format(startTime, 'yyyy-MM-dd'),
        scheduledTime: format(startTime, 'HH:mm'),
        duration: session.duration || 60,
        maxAttendees: session.maxAttendees || '',
        isOnline: session.isOnline || false,
        location: session.location || '',
        meetingLink: session.meetingLink || '',
        tags: Array.isArray(session.tags) 
          ? session.tags.join(', ') 
          : (session.tags || '')
      };
      
      // Log the values being set
      console.log('[Debug] Setting form values:', formValues);
      
      // Reset form with the prepared values
      reset(formValues);
    } else {
      // For new session, use default values
      console.log('[Debug] Initializing new session form');
      reset(defaultValues);
    }
  }, [open, isEditMode, session, reset, defaultValues]);
  // Handle form submission
  const onSubmit = async (data) => {
    try {
      if (isEditMode && session?._id) {
        await updateMutation.mutateAsync({
          id: session._id,
          ...data
        });
      } else {
        await createMutation.mutateAsync(data);
      }
      
      // Close the dialog on success
      onOpenChange(false);
      
      // Show success message
      toast.success(`Session ${isEditMode ? 'updated' : 'created'} successfully!`);
      
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error('Error submitting form:', error);
    }
  };

  
  // Handle dialog close - moved after form initialization
  const handleOpenChange = useCallback((isOpen) => {
    if (!isOpen) {
      // Reset form when closing
      reset();
    }
    onOpenChange(isOpen);
  }, [onOpenChange, reset]);

  // Remove duplicate form declaration - using the one at the top of the component

  useEffect(() => {
    if (open) {
      if (isEditMode && session) {
        console.log('[Debug] Session data for edit:', session);
        const scheduledDateTime = new Date(session.scheduledDate);
        
        // Get the group ID, handling both populated group object and direct ID
        const groupId = session.group?._id || session.groupId || '';
        
        console.log('[Debug] Setting form values for edit mode. Group ID:', groupId);
        console.log('[Debug] Available user groups:', userGroups);
        
        // Ensure the group exists in user's groups
        const groupExists = userGroups.some(g => g._id === groupId);
        
        if (!groupExists && userGroups.length > 0) {
          console.warn(`[Debug] Group ${groupId} not found in user's groups. Falling back to first available group.`);
        }
        
        const defaultGroupId = groupExists ? groupId : (userGroups[0]?._id || '');
        
        const formValues = {
          title: session.title || '',
          description: session.description || '',
          groupId: defaultGroupId,
          scheduledDate: format(scheduledDateTime, 'yyyy-MM-dd'),
          scheduledTime: format(scheduledDateTime, 'HH:mm'),
          duration: session.duration || 60,
          isOnline: session.isOnline || false,
          location: session.location || '',
          meetingLink: session.meetingLink || ''
        };
        
        console.log('[Debug] Resetting form with values:', formValues);
        reset(formValues);
      } else {
        // For new sessions, set default group if user has only one group
        const defaultGroupId = (!isLoadingGroups && userGroups.length === 1) ? userGroups[0]._id : '';
        reset({
          title: '',
          description: '',
          groupId: defaultGroupId,
          scheduledDate: format(new Date(), 'yyyy-MM-dd'),
          scheduledTime: format(new Date(Date.now() + 60 * 60 * 1000), 'HH:00'),
          duration: 60,
          isOnline: false,
          location: '',
          meetingLink: ''
        });
      }
    }
  }, [session, isEditMode, open, reset, userGroups, isLoadingGroups]);

  const handleFormSubmit = (data) => {
    console.log('[Debug] Form data on submit:', data);

    try {
      // Format the date and time properly
      const dateStr = new Date(data.scheduledDate).toISOString().split('T')[0];
      const timeStr = data.scheduledTime;
      
      // Create date objects for time calculations
      const startTime = new Date(`${dateStr}T${timeStr}`);
      
      // Validate the date
      if (isNaN(startTime.getTime())) {
        throw new Error('Invalid date or time format');
      }
      
      const endTime = new Date(startTime.getTime() + (Number(data.duration) * 60000));

      // Prepare the data object with all required fields
      const processedData = {
        title: data.title,
        description: data.description,
        groupId: data.groupId,
        scheduledDate: startTime.toISOString(),
        startTime: startTime.toISOString(), // Add startTime in ISO format
        endTime: endTime.toISOString(),     // Add endTime in ISO format
        duration: Number(data.duration),
        isOnline: data.isOnline,
        ...(data.isOnline 
          ? { meetingLink: data.meetingLink }
          : { location: data.location }
        )
      };

      console.log('[Debug] Processed data for save:', processedData);
      
      onSave(processedData);
    } catch (error) {
      console.error('Error processing form data:', error);
      // Show error to user
      toast.error('Error processing form data. Please try again.');
    }
  };

  const handleCancel = () => {
    if (onOpenChange) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog 
      open={!!open} 
      onOpenChange={(isOpen) => {
        if (onOpenChange) {
          onOpenChange(isOpen);
        } else if (!isOpen) {
          // If onOpenChange is not provided, we still need to handle closing
          // This is a fallback for when parent component manages the state differently
          handleCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Session' : 'Create a New Session'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-6 py-4">
          
          <div className="grid gap-2">
            <Label htmlFor="group">Group</Label>
            <Controller
              name="groupId"
              control={control}
              render={({ field: { onChange, value } }) => {
                // Log the current value and available groups for debugging
                console.log('[Debug] Group Select - Current value:', value, 'Available groups:', userGroups);
                
                // Ensure the value is a string for comparison
                const selectedValue = value ? value.toString() : '';
                
                return (
                  <Select 
                    onValueChange={onChange} 
                    value={selectedValue}
                    disabled={isLoadingGroups || userGroups.length === 0}
                  >
                    <SelectTrigger id="group">
                      <SelectValue 
                        placeholder={
                          isLoadingGroups 
                            ? 'Loading groups...' 
                            : userGroups.length === 0 
                              ? 'No groups available' 
                              : 'Select a group'
                        } 
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {userGroups.map((group) => {
                        const groupIdStr = group._id.toString();
                        return (
                          <SelectItem 
                            key={groupIdStr} 
                            value={groupIdStr}
                          >
                            {group.title}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                );
              }}
            />
            {errors.groupId && <p className="text-red-500 text-xs mt-1">{errors.groupId.message}</p>}
            {userGroups.length === 0 && !isLoadingGroups && (
              <p className="text-xs text-orange-500 mt-1">You need to create a group first before creating a session.</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register('title')} />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register('description')} placeholder="What will this session cover?" />
          </div>





          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="scheduledDate">Date</Label>
              <Input id="scheduledDate" type="date" {...register('scheduledDate')} />
              {errors.scheduledDate && <p className="text-red-500 text-xs mt-1">{errors.scheduledDate.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scheduledTime">Time</Label>
              <Input id="scheduledTime" type="time" {...register('scheduledTime')} />
              {errors.scheduledTime && <p className="text-red-500 text-xs mt-1">{errors.scheduledTime.message}</p>}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input 
              id="duration" 
              type="number" 
              min="15"
              step="15"
              {...register('duration')} 
            />
            {errors.duration && <p className="text-red-500 text-xs mt-1">{errors.duration.message}</p>}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isOnline"
              {...register('isOnline')}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <Label htmlFor="isOnline">Online Session</Label>
          </div>

          {isOnline ? (
            <div className="grid gap-2">
              <Label htmlFor="meetingLink" className="flex items-center"><LinkIcon className="h-4 w-4 mr-2"/>Meeting Link</Label>
              <Input id="meetingLink" {...register('meetingLink')} placeholder="https://zoom.us/..." />
              {errors.meetingLink && <p className="text-red-500 text-xs mt-1">{errors.meetingLink.message}</p>}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="location" className="flex items-center"><MapPin className="h-4 w-4 mr-2"/>Location</Label>
              <Input id="location" {...register('location')} placeholder="e.g., Library Room 401" />
              {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location.message}</p>}
            </div>
          )}
          
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isEditMode ? 'Saving...' : 'Creating...'}</>
              ) : (
                isEditMode ? 'Save Changes' : 'Create Session'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
