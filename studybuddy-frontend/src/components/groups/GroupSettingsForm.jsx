import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { X, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAvatarUrl } from '@/utils/avatarUtils';

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
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    defaultValues: {
      title: group?.title || '',
      subject: group?.subject || '',
      university: group?.university || '',
      description: group?.description || '',
      difficulty: group?.difficulty || 'Beginner',
      maxMembers: group?.maxMembers || 10,
      meetingSchedule: group?.meetingSchedule || '',
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

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File is too large. Maximum size is 5MB.');
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    // Store the file in the form state
    setValue('avatar', file, { shouldValidate: true });
  };

  // Handle avatar removal
  const handleRemoveAvatar = () => {
    setAvatarPreview('');
    setValue('avatar', null, { shouldValidate: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
    try {
      setIsUploading(true);
      
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add all form fields
      formData.append('title', (data.title || '').trim());
      formData.append('subject', (data.subject || '').trim());
      formData.append('university', (data.university || '').trim());
      formData.append('description', (data.description || '').trim());
      formData.append('difficulty', data.difficulty || 'Beginner');
      formData.append('maxMembers', Number(data.maxMembers) || 10);
      
      // Add tags as an array
      if (tags?.length > 0) {
        const cleanedTags = tags.map(tag => tag.trim()).filter(Boolean);
        // Append each tag individually to send as array
        cleanedTags.forEach((tag, index) => {
          formData.append(`tags[${index}]`, tag);
        });
      }
      
      // Add meeting schedule if present
      if (data.meetingSchedule?.trim()) {
        formData.append('meetingSchedule', data.meetingSchedule.trim());
      }
      
      // Add avatar file if present
      if (data.avatar instanceof File) {
        formData.append('avatar', data.avatar);
      } else if (data.avatar === null) {
        // Explicitly set avatar to null for removal
        formData.append('avatar', 'null');
      }
      
      // Add system fields
      formData.append('isActive', group?.isActive !== false);
      
      // Call the onSave callback with FormData
      await onSave(formData);
      
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error(error.response?.data?.message || 'Failed to update group');
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

  // Watch form values for real-time validation
  const watchedValues = watch();
  // Watch the difficulty field with a default value
  const currentDifficulty = watch('difficulty', group?.difficulty || 'Beginner');
  
  // Ensure group is always an object
  const safeGroup = group || {};
  
  // Set up form with avatar field
  const avatar = watch('avatar');
  const currentAvatar = avatarPreview || (group?.avatar ? getAvatarUrl(group.avatar) : '');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Avatar Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Group Avatar</label>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              {currentAvatar ? (
                <img 
                  src={currentAvatar} 
                  alt="Group avatar" 
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
                  <Users className="h-10 w-10" />
                </div>
              )}
            </Avatar>
            
            {/* Remove button */}
            {currentAvatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600 focus:outline-none"
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <div className="flex-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={ALLOWED_FILE_TYPES.join(',')}
              className="hidden"
              disabled={isUploading}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full sm:w-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              {currentAvatar ? 'Change Avatar' : 'Upload Avatar'}
            </Button>
            <p className="mt-1 text-xs text-gray-500">
              JPG, PNG, or WebP. Max 5MB.
            </p>
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
