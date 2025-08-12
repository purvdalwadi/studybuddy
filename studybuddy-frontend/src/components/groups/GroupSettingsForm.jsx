import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { X, Upload, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { getAvatarUrl } from '@/utils/avatarUtils';

// Helper function to get initials from group title
const getInitials = (title) => {
  if (!title) return 'GP'; // Default to 'GP' for Group if no title
  return title
    .split(' ')
    .filter(word => word.length > 0) // Filter out empty strings from multiple spaces
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Validation schema matching backend model requirements
const groupSchema = {
  title: { 
    required: 'Title is required', 
    minLength: { value: 3, message: 'Title must be at least 3 characters' },
    maxLength: { value: 100, message: 'Title cannot exceed 100 characters' },
    validate: value => (value || '').trim().length > 0 || 'Title cannot be empty'
  },
  subject: { 
    required: 'Subject is required',
    validate: value => (value || '').trim().length > 0 || 'Subject cannot be empty'
  },
  university: { 
    required: 'University is required',
    validate: value => (value || '').trim().length > 0 || 'University cannot be empty'
  },
  description: { 
    required: 'Description is required', 
    minLength: { value: 10, message: 'Description must be at least 10 characters' },
    maxLength: { value: 1000, message: 'Description cannot exceed 1000 characters' },
    validate: value => (value || '').trim().length > 0 || 'Description cannot be empty'
  },
  difficulty: { 
    required: 'Please select a difficulty level',
    validate: value => ['Beginner', 'Intermediate', 'Advanced'].includes(value) || 'Invalid difficulty level'
  },
  maxMembers: { 
    required: 'Please specify maximum members', 
    min: { value: 2, message: 'Minimum 2 members required' }, 
    max: { value: 50, message: 'Maximum 50 members allowed' },
    valueAsNumber: true
  },
  tags: {
    validate: value => !value || value.length <= 8 || 'Maximum 8 tags allowed'
  }
};

export default function GroupSettingsForm({ group = {}, onSave, onCancel }) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    watch,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: {
      title: group?.title || '',
      subject: group?.subject || '',
      university: group?.university || '',
      description: group?.description || '',
      difficulty: group?.difficulty || 'Beginner',
      maxMembers: group?.maxMembers || 10,
      meetingSchedule: group?.meetingSchedule || '',
      avatar: group?.avatar || null,  // Initialize avatar field
    }
  });

  const [tags, setTags] = useState(Array.isArray(group?.tags) ? group.tags : []);
  const [tagInput, setTagInput] = useState('');
  // Initialize avatar preview with proper URL handling
  const [avatarPreview, setAvatarPreview] = useState(
    group?.avatar ? getAvatarUrl(group.avatar) : ''
  );
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Handle file selection with enhanced validation and error handling
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate file size with user-friendly message
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File is too large. Maximum size is 5MB.');
      return;
    }

    // Validate image dimensions
    const img = new Image();
    img.onload = () => {
      const minDimension = 100; // Minimum width/height in pixels
      if (img.width < minDimension || img.height < minDimension) {
        toast.error(`Image should be at least ${minDimension}x${minDimension} pixels`);
        return;
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      setValue('avatar', file, { shouldValidate: true });
      
      console.log('Selected file:', {
        name: file.name,
        size: file.size,
        type: file.type,
        dimensions: { width: img.width, height: img.height }
      });
    };
    
    img.onerror = () => {
      console.error('Error loading image file');
      toast.error('Failed to load the selected image. Please try another file.');
    };
    
    img.src = URL.createObjectURL(file);
  };

  // Handle avatar removal with confirmation and feedback
  const handleRemoveAvatar = () => {
    console.log('[handleRemoveAvatar] Starting avatar removal', { currentAvatar });
    
    // If there's an existing avatar, show confirmation
    if (currentAvatar) {
      if (window.confirm('Are you sure you want to remove the group avatar?')) {
        console.log('[handleRemoveAvatar] User confirmed avatar removal');
        
        // Clear the preview
        setAvatarPreview('');
        
        // Set the avatar to null in the form
        console.log('[handleRemoveAvatar] Setting avatar to null in form');
        setValue('avatar', null, { 
          shouldValidate: true,
          shouldDirty: true
        });
        
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Log the current form state
        console.log('[handleRemoveAvatar] Current form values after removal:', {
          avatar: getValues('avatar'),
          allValues: getValues()
        });
        
        console.log('[handleRemoveAvatar] Avatar state after removal:', {
          avatarPreview,
          groupAvatar: group?.avatar,
          currentAvatar,
          hasPreview: !!avatarPreview,
          hasGroupAvatar: !!group?.avatar,
          avatarUrl: group?.avatar ? getAvatarUrl(group.avatar) : 'no avatar url'
        });
        
        toast.success('Avatar removed successfully');
      }
    } else {
      console.log('[handleRemoveAvatar] No avatar to remove');
      setAvatarPreview('');
      setValue('avatar', null, { 
        shouldValidate: true,
        shouldDirty: true
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const onSubmit = async (data) => {
    if (isUploading) return; // Prevent multiple submissions
    
    try {
      setIsUploading(true);
      
      // Create FormData for file upload
      const formData = new FormData();
      
      // Helper to safely trim and add fields
      const addField = (name, value) => {
        if (value !== undefined && value !== null) {
          formData.append(name, typeof value === 'string' ? value.trim() : value);
        }
      };
      
      // Add all form fields
      addField('title', data.title);
      addField('subject', data.subject);
      addField('university', data.university);
      addField('description', data.description);
      addField('difficulty', data.difficulty || 'Beginner');
      addField('maxMembers', Number(data.maxMembers) || 10);
      
      // Add tags as an array if they exist
      if (tags?.length > 0) {
        const cleanedTags = tags
          .map(tag => typeof tag === 'string' ? tag.trim() : String(tag))
          .filter(Boolean);
          
        cleanedTags.forEach((tag, index) => {
          formData.append(`tags[${index}]`, tag);
        });
      }
      
      // Add meeting schedule if present
      if (data.meetingSchedule) {
        addField('meetingSchedule', data.meetingSchedule);
      }
      
      // Handle avatar
      if (data.avatar === null) {
        // Explicitly set avatar to null for removal
        formData.append('avatar', 'null');
      } else if (data.avatar instanceof File) {
        // Add the avatar file with metadata
        formData.append('avatar', data.avatar, data.avatar.name);
      }
      // If no avatar change, don't send the avatar field
      
      // Add system fields
      formData.append('isActive', group?.isActive !== false);
      
      // Log the form data being sent (without the actual file content)
      console.log('Submitting form with data:', {
        ...Object.fromEntries(formData.entries()),
        avatar: data.avatar instanceof File ? `File: ${data.avatar.name} (${(data.avatar.size / 1024).toFixed(2)} KB)` : data.avatar
      });
      
      // Call the onSave callback with FormData
      await onSave(formData);
      
      // Show success message if not already shown by parent
      toast.success('Group settings updated successfully');
      
    } catch (error) {
      console.error('Error updating group:', error);
      
      // Extract error message
      let errorMessage = 'Failed to update group settings';
      if (error.response) {
        // Handle validation errors from backend
        if (error.response.data?.errors) {
          errorMessage = Object.values(error.response.data.errors)
            .map(err => typeof err === 'string' ? err : err.message || 'Invalid field')
            .join('\n');
        } else {
          errorMessage = error.response.data?.message || errorMessage;
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      }
      
      toast.error(errorMessage);
      throw error; // Re-throw to allow parent component to handle if needed
    } finally {
      setIsUploading(false);
    }
  };

  const addTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 8) {
      // Limit tag length to 30 characters
      const finalTag = trimmedTag.length > 30 ? trimmedTag.substring(0, 30) : trimmedTag;
      setTags([...tags, finalTag]);
      setTagInput('');
    }
  };

  const removeTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  // Debug log to inspect the group prop
  console.log('GroupSettingsForm - group prop:', group);
  console.log('GroupSettingsForm - group title:', group?.title);
  
  // Helper function to safely get the group title
  const getGroupTitle = () => {
    return group?.title || 'Study Group';
  };
  
  // Watch form values for real-time validation
  const watchedValues = watch();
  // Watch the difficulty field with a default value
  const currentDifficulty = watch('difficulty', group?.difficulty || 'Beginner');
  
  // Ensure group is always an object
  const safeGroup = group || {};
  
  // Set up form with avatar field
  const avatar = watch('avatar');
  const isDefaultAvatar = (url) => {
    if (!url) return false;
    const urlStr = String(url).toLowerCase();
    return urlStr.includes('default-avatar') || 
           urlStr.includes('group-default') ||
           urlStr.endsWith('default-profile.png') ||
           urlStr.endsWith('default-avatar.png');
  };
  
  const hasCustomAvatar = (preview, avatarUrl) => {
    // If there's a preview, check if it's not a default avatar
    if (preview) {
      return !isDefaultAvatar(preview);
    }
    // If there's an avatar URL and it's not a default one, it's a custom avatar
    return avatarUrl && !isDefaultAvatar(avatarUrl);
  };
  
  // Only show avatar if it's a custom one, otherwise show initials
  const currentAvatar = hasCustomAvatar(avatarPreview, group?.avatar) 
    ? (avatarPreview || getAvatarUrl(group.avatar)) 
    : null;
  
  // Debug logging
  console.log('Avatar state:', {
    avatarPreview,
    groupAvatar: group?.avatar,
    currentAvatar,
    hasPreview: !!avatarPreview,
    hasGroupAvatar: !!group?.avatar,
    isDefaultAvatar: isDefaultAvatar(avatarPreview || group?.avatar),
    hasCustomAvatar: hasCustomAvatar(avatarPreview, group?.avatar),
    title: group?.title,
    initials: getInitials(group?.title || '')
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Enhanced Avatar Upload Section */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Group Avatar</label>
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-semibold shadow-md overflow-hidden">
                {currentAvatar ? (
                  <img 
                    src={currentAvatar} 
                    alt="Group avatar preview" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <span className="text-3xl" data-testid="group-initials">
                      {getInitials(getGroupTitle())}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 hover:bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full bg-white/80 hover:bg-white/90 text-gray-800"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              
              {/* Remove button - only shown when there's an avatar */}
              {currentAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1.5 text-white shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                  disabled={isUploading}
                  title="Remove avatar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              
              {/* Loading indicator */}
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                  <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {currentAvatar ? 'Change Photo' : 'Upload Photo'}
                </Button>
                
                {currentAvatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={handleRemoveAvatar}
                    disabled={isUploading}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
              
              <p className="text-xs text-gray-500">
                JPG, PNG, or WebP. Max 5MB. Recommended size: 400x400px or square
              </p>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={ALLOWED_FILE_TYPES.join(',')}
                className="hidden"
                disabled={isUploading}
              />
            </div>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <Input
          {...register('title', groupSchema.title)}
          error={errors.title?.message}
          placeholder="Group title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Subject</label>
        <Input
          {...register('subject', groupSchema.subject)}
          error={errors.subject?.message}
          placeholder="Subject or course name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">University</label>
        <Input
          {...register('university', groupSchema.university)}
          error={errors.university?.message}
          placeholder="University name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          {...register('description', groupSchema.description)}
          className="w-full px-3 py-2 border rounded-md min-h-[100px]"
          placeholder="Group description and goals"
        />
        {errors.description && (
          <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Difficulty Level</label>
        <Controller
          name="difficulty"
          control={control}
          rules={groupSchema.difficulty}
          render={({ field }) => {
            // Ensure the value is properly capitalized to match the expected format
            const normalizedValue = field.value ? 
              field.value.charAt(0).toUpperCase() + field.value.slice(1).toLowerCase() : 
              'Beginner';
              
            return (
              <Select 
                value={normalizedValue}
                onValueChange={(value) => {
                  field.onChange(value);
                  setValue('difficulty', value, { shouldValidate: true });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select difficulty level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            );
          }}
        />
        {errors.difficulty && (
          <p className="mt-1 text-sm text-red-600">{errors.difficulty.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, index) => (
            <div
              key={index}
              className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add a tag"
            className="flex-1"
          />
          <Button type="button" onClick={addTag} variant="outline">
            Add
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {tags.length}/8 tags added. Press Enter or click Add to add a tag.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Maximum Members
        </label>
        <Input
          type="number"
          min="2"
          max="50"
          {...register('maxMembers', {
            ...groupSchema.maxMembers,
            valueAsNumber: true,
          })}
          error={errors.maxMembers?.message}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Meeting Schedule (Optional)
        </label>
        <Input
          {...register('meetingSchedule')}
          placeholder="e.g., Every Monday at 6 PM"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button 
          type="submit" 
          className="w-full sm:w-auto"
          disabled={isUploading}
        >
          {isUploading ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button 
          type="button" 
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
