import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useGroups } from '@/hooks/useGroups';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { X, Upload, Calendar, Clock, Users, MapPin, Link as LinkIcon, FileText, Tag, Check, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/authContext';  

const sessionSchema = z.object({
  // Required fields
  groupId: z.string().min(1, 'Group ID is required'),
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title cannot be more than 100 characters')
    .trim(),
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  scheduledTime: z.string().min(1, 'Scheduled time is required'),
  duration: z.number()
    .min(30, 'Minimum duration is 30 minutes')
    .max(480, 'Maximum duration is 8 hours'),
  
  // Optional fields with validation
  description: z.string()
    .max(1000, 'Description cannot be more than 1000 characters')
    .optional()
    .or(z.literal('')),
  location: z.string()
    .max(200, 'Location cannot be more than 200 characters')
    .optional()
    .or(z.literal('')),
  isOnline: z.boolean().default(false),
  meetingLink: z.string()
    .url('Please enter a valid URL')
    .optional()
    .or(z.literal('')),
  notes: z.string()
    .max(5000, 'Notes cannot be more than 5000 characters')
    .optional()
    .or(z.literal('')),
  
  // Status fields (managed by backend)
  status: z.enum(['scheduled', 'ongoing', 'completed', 'cancelled']).optional(),
  
  // Attendees will be managed separately
  attendees: z.array(z.any()).optional()
});

export default function StudySessionDialog({ 
  onSuccess, 
  onError, 
  open: propOpen, 
  onOpenChange: propOnOpenChange
}) {
  const currentUser = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  
  // Fetch user's groups
  const { data: groups = [], isLoading: isLoadingGroups } = useGroups({
    onSuccess: (data) => {
      console.log('Fetched groups:', data);
    },
    onError: (error) => {
      console.error('Error fetching groups:', error);
    }
  });

  // Debug log groups data
  console.log('Groups state:', { groups, isLoadingGroups });

  // Use propOpen if provided, otherwise use internal state
  const open = propOpen !== undefined ? propOpen : internalOpen;
  const setOpen = propOnOpenChange || setInternalOpen;

  
  const { 
    register, 
    handleSubmit, 
    control, 
    reset, 
    watch, 
    setValue, 
    formState: { errors } 
  } = useForm({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      groupId: '',
      title: '',
      description: '',
      scheduledDate: '',
      scheduledTime: '',
      duration: 60, // Default to 60 minutes
      location: '',
      isOnline: false,
      meetingLink: '',
      notes: '',
      status: 'scheduled',
    },
  });

  const isOnline = watch('isOnline');
  const tags = watch('tags') || [];
  const sessionType = watch('sessionType');

  const addTag = (e) => {
    e.preventDefault();
    if (tagInput.trim() && !tags.includes(tagInput) && tags.length < 5) {
      setValue('tags', [...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setValue('tags', tags.filter((tag) => tag !== tagToRemove));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedFiles.length > 5) {
      toast.error('You can only upload up to 5 files');
      return;
    }
    setSelectedFiles([...selectedFiles, ...files]);
    setValue('resources', [...(watch('resources') || []), ...files]);
  };

  const removeFile = (index) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
    setValue('resources', newFiles);
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      // Format date and time for API
      const formattedDate = new Date(data.scheduledDate);
      const [hours, minutes] = data.scheduledTime.split(':');
      formattedDate.setHours(parseInt(hours, 10));
      formattedDate.setMinutes(parseInt(minutes, 10));
      
      const sessionData = {
        groupId: data.groupId,
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
        scheduledDate: formattedDate.toISOString(),
        duration: Number(data.duration),
        isOnline: data.isOnline,
        meetingLink: data.isOnline ? data.meetingLink?.trim() : undefined,
        location: !data.isOnline ? data.location?.trim() : undefined,
        notes: data.notes?.trim() || undefined,
        status: 'scheduled',
      };

      // Call the API
      const response = await fetch('/api/study-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create session');
      }

      const result = await response.json();
      
      // Reset form and close dialog
      reset();
      setSelectedFiles([]);
      setOpen(false);
      
      // Call success callback
      if (onSuccess) onSuccess(result);
      
      toast.success('Your study session has been scheduled successfully');
    } catch (error) {
      console.error('Error creating session:', error);
      
      // Call error callback if provided
      if (onError) onError(error);
      
      toast.error(error.message || 'Failed to create session');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <h2 className="text-2xl font-bold text-primary-700 dark:text-primary-200">Schedule New Study Session</h2>
          <p className="text-sm text-gray-500">Fill in the details below to create a new study session</p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Group <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="groupId"
                  control={control}
                  render={({ field }) => (
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      required
                    >
                      <SelectTrigger className="w-full text-gray-900 dark:text-white">
                        <SelectValue placeholder="Select a group" className="text-gray-900 dark:text-white" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                        {isLoadingGroups ? (
                          <div className="p-2 text-sm text-gray-900 dark:text-white">Loading groups...</div>
                        ) : groups.length === 0 ? (
                          <div className="p-2 text-sm text-gray-900 dark:text-white">No groups found. Create a group first.</div>
                        ) : (
                          groups.map((group) => (
                            (group?.creator?.id === currentUser._id) && <SelectItem 
                              key={group._id} 
                              value={group._id}
                              className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {group.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.groupId?.message && (
                  <p className="mt-1 text-sm text-red-600">{errors.groupId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <Input 
                  placeholder="E.g., Calculus Study Session" 
                  {...register("title")} 
                  error={errors.title?.message} 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <Input 
                    type="date" 
                    {...register("scheduledDate")} 
                    error={errors.scheduledDate?.message} 
                    required 
                    className="flex-1"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Time <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <Input 
                    type="time" 
                    {...register("scheduledTime")} 
                    error={errors.scheduledTime?.message} 
                    required 
                    className="flex-1"
                    step="300" // 5 minute intervals
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <Input 
                    type="number" 
                    min={15} 
                    max={480} 
                    step={15}
                    {...register("duration", { valueAsNumber: true })} 
                    error={errors.duration?.message} 
                    required 
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <Textarea
                  placeholder="Any additional details about this session..."
                  rows={3}
                  {...register("notes")}
                  error={errors.notes?.message}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <Textarea
                  placeholder="What will this session cover?"
                  rows={4}
                  {...register("description")}
                  error={errors.description?.message}
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="isOnline"
                    {...register("isOnline")}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="isOnline" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    This is an online session
                  </label>
                </div>
                {isOnline && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <LinkIcon className="h-5 w-5 text-gray-400" />
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Meeting Link
                      </label>
                    </div>
                    <Input
                      placeholder="https://meet.google.com/..."
                      {...register("meetingLink")}
                      error={errors.meetingLink?.message}
                    />
                  </div>
                )}
                {isOnline ? (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <LinkIcon className="h-5 w-5 text-gray-400" />
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Meeting Link <span className="text-red-500">*</span>
                      </label>
                    </div>
                    <Input
                      placeholder="https://meet.google.com/..."
                      {...register("meetingLink")}
                      error={errors.meetingLink?.message}
                      required
                    />
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Location <span className="text-red-500">*</span>
                      </label>
                    </div>
                    <Input
                      placeholder="E.g., Library Room 302"
                      {...register("location")}
                      error={errors.location?.message}
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Location {!isOnline && <span className="text-red-500">*</span>}
                  </label>
                </div>
                <Input
                  placeholder="E.g., Library Room 302"
                  {...register("location")}
                  error={errors.location?.message}
                  required={!isOnline}
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Resources (Optional)
                  </label>
                </div>
                <div className="space-y-2">
                  <input
                    type="file"
                    id="resources"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="resources"
                    className="flex items-center justify-center w-full px-4 py-2 text-sm border border-dashed rounded-md cursor-pointer border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {selectedFiles.length > 0
                      ? `Add more files (${selectedFiles.length}/5)`
                      : "Upload files (max 5)"}
                  </label>
                  {selectedFiles.length > 0 && (
                    <div className="space-y-1">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 text-sm bg-gray-50 dark:bg-gray-800 rounded">
                          <span className="truncate max-w-[200px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button 
              type="submit" 
              variant="primary"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : 'Create Session'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => { setOpen(false); reset(); }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </DialogFooter>
          
        </form>
      </DialogContent>
    </Dialog>
  );
}
